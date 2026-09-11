// SPDX-License-Identifier: MPL-2.0
/**
 * The spotlight provider registry (plans/99 M2) - the contract between the
 * overlay (components/spotlight.ts) and the domain providers (./providers/*).
 *
 * Providers federate at RUNTIME over data the client already holds (the synced
 * tool index, IndexedDB state/assets, static registries) - there is no
 * build-time unified index, so per-brand privacy holds by construction
 * (plans/99 principle 2). Hits NAVIGATE, they never mutate (principle 3).
 *
 * Group presentation is fixed (GROUP_ORDER) - spotlight groups; ranking happens
 * within a group only, by SearchHit.score (lib/search/match.ts scoring). Which
 * group a view "owns", and whether that view live-filters behind the overlay or
 * sends everything to it, is declared in ROUTE_DOMAIN (section 2a). Either way the own
 * group is HOISTED to the top of the overlay with the larger cap and
 * brand-highlighted, so the current view's results lead the panel even when it
 * occludes the cards behind. The `tier` still records whether the view
 * live-filters its cards ('live') or leaves them untouched ('overlay').
 */
import type { Lang } from '../../i18n.ts';

export type SearchGroupId = 'tools' | 'utilities' | 'projects' | 'catalog' | 'settings' | 'places' | 'docs' | 'ask';

export interface SearchHit {
  /** Inline SVG markup for the row glyph (lib/icons.ts `icon(...)`), or ''. */
  icon: string;
  /** Row title - already localized (t()/index-localized) plain text. */
  title: string;
  /** One-line context (category, folder path, section name) - plain text. */
  subtitle?: string;
  /** Navigation target: an in-app hash href, or a path for docs pages. */
  href: string;
  /** lib/search scoreHaystack value - orders rows within the group. */
  score: number;
}

export interface SearchProvider {
  id: SearchGroupId;
  /** Tokens come pre-folded from lib/search tokenize(); return the top hits up
   *  to `limit`, best score first. Must never throw for an empty result - and
   *  a provider that CAN'T serve (data missing, fetch failed) returns []. */
  search(tokens: readonly string[], limit: number): Promise<SearchHit[]>;
}

/** Fixed presentation order (plans/99 section 2a - no interleaved global ranking). The
 *  `ask` group is LAST: it is the fallback affordance ("ask Lolly about this")
 *  under whatever concrete hits the other providers found (plans/103 M0). */
export const GROUP_ORDER: readonly SearchGroupId[] = ['tools', 'utilities', 'projects', 'catalog', 'settings', 'places', 'docs', 'ask'];

/** Group headers - English t() keys, translated at render time. */
export const GROUP_LABELS: Record<SearchGroupId, string> = {
  tools: 'Tools',
  utilities: 'Utilities',
  projects: 'Projects',
  catalog: 'Catalogue',
  settings: 'Settings',
  places: 'Places',
  docs: 'Docs',
  ask: 'Ask Lolly',
};

/** section 2a - which group is a route's own domain, and its tier. Routes absent here
 *  (an unclaimed bar would only show on future M3 routes) show every group. */
export const ROUTE_DOMAIN: Record<string, { group: SearchGroupId; tier: 'live' | 'overlay' }> = {
  gallery: { group: 'tools', tier: 'live' },
  utilities: { group: 'utilities', tier: 'live' },
  catalog: { group: 'catalog', tier: 'live' },
  projects: { group: 'projects', tier: 'live' },  // plans/133 WP-9: typing live-filters the grid behind the overlay, like catalog
  profile: { group: 'settings', tier: 'overlay' },
  dashboard: { group: 'settings', tier: 'overlay' },
  docs: { group: 'docs', tier: 'overlay' },  // the in-app reader: docs hits lead, page never reshapes
};

/** "See all in <view> →" targets - the explicit ?q= handoff (plans/99 section 2a).
 *  Only the four list views have one; settings/places/docs groups end plain. */
export const GROUP_SEE_ALL: Partial<Record<SearchGroupId, (q: string) => string>> = {
  tools: (q) => `#/?q=${encodeURIComponent(q)}`,
  utilities: (q) => `#/u?q=${encodeURIComponent(q)}`,
  projects: (q) => `#/p?q=${encodeURIComponent(q)}`,
  catalog: (q) => `#/c?q=${encodeURIComponent(q)}`,
};

/** Per-group row caps (plans/99 section 2a). */
export const GROUP_CAP = 5;
export const OWN_GROUP_CAP = 8;

/** Overlay opens at ≥2 characters; below that it renders nothing (no recents in v1). */
export const MIN_QUERY_LENGTH = 2;

const providers: SearchProvider[] = [];

/** Register a provider (id-idempotent, so a re-init can't double a group). */
export function registerProvider(p: SearchProvider): void {
  if (!providers.some((x) => x.id === p.id)) providers.push(p);
}

/** Registered providers in GROUP_ORDER (unregistered groups simply absent). */
export function searchProviders(): readonly SearchProvider[] {
  return [...providers].sort((a, b) => GROUP_ORDER.indexOf(a.id) - GROUP_ORDER.indexOf(b.id));
}

/** Test seam - spotlight.test.ts swaps fake providers in. */
export function resetProviders(): void {
  providers.length = 0;
}

// Re-exported so provider modules stay parallel-authored without an i18n import
// dance; unused here beyond the type surface.
export type { Lang };
