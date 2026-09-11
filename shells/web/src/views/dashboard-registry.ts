// SPDX-License-Identifier: MPL-2.0
/**
 * Dashboard destination registry (plans/99 M2) - the single source of truth for
 * every deep-linkable dashboard destination: the four primary tabs, each
 * `data-flag` section, and the capability groups.
 *
 * Three consumers read the SAME array, which is the whole point:
 *  - views/dashboard.ts renders its section markup from it (`dashFlag(id)`
 *    interpolation - no literal data-flag strings survive in that file, pinned
 *    by dashboard-registry.test.ts), so `applyDeepLink` consumes DOM attributes
 *    that originate here by construction;
 *  - the spotlight settings provider (lib/search/providers/settings.ts) turns
 *    each entry into a search hit ("palette" typed in the bottom bar anywhere
 *    lands on the dashboard's colour section) - a section rename can therefore
 *    never leave search pointing at a retired flag;
 *  - the co-located test walks it both ways (registry ⇄ dashboard.ts markup).
 *
 * DELIBERATELY dependency-free: labels are English t() keys translated at
 * render/search time by the consumer, and the capability-group rows are a
 * distilled copy of lib/capabilities-data.ts's {id, flag, title} - copied, not
 * imported, because that module carries ~300 prose strings plus icon markup and
 * is lazy-loaded by design (one tab of one view; see capabilitiesSection() in
 * dashboard.ts). dashboard-registry.test.ts imports both and fails on any
 * drift - the same two-copies guard the schemas use.
 */

export interface DashSection {
  /** DOM id of the section (`dash-…`, `cap-…`) or, for a tab entry, its panel (`dpanel-…`). */
  id: string;
  /** Space-separated deep-link keyword alternates - rendered as the section's
   *  `data-flag` (any one of them in the hash query opens + scrolls to it, see
   *  applyDeepLink). `''` marks a TAB entry: no data-flag anywhere, deep-linked
   *  as `#/d?tab=<tab>` instead. */
  flag: string;
  /** English t() key matching the section's visible heading (or tab label). */
  label: string;
  /** The primary tab that owns the destination (the ?tab= key). */
  tab?: string;
}

export const DASH_SECTIONS: ReadonlyArray<DashSection> = [
  // ── Primary tabs (flag: '' - see DashSection.flag). Order IS the tab-bar
  // order: views/dashboard.ts derives its DASH_TABS from these rows.
  { id: 'dpanel-device', flag: '', label: 'This device', tab: 'device' },
  { id: 'dpanel-brand', flag: '', label: 'Design system', tab: 'brand' },
  { id: 'dpanel-caps', flag: '', label: 'Capabilities', tab: 'caps' },
  { id: 'dpanel-activity', flag: '', label: 'Activity & stats', tab: 'activity' },

  // ── This device
  { id: 'dash-device', flag: 'device', label: 'This Machine', tab: 'device' },
  { id: 'dash-sound', flag: 'sound audio neurospicy focus volume', label: 'Sound', tab: 'device' },
  { id: 'dash-storage', flag: 'storage', label: 'Storage', tab: 'device' },

  // ── Design system
  { id: 'dash-brand', flag: 'brand logo colour colours palette fonts', label: 'Your brand', tab: 'brand' },
  { id: 'dash-lock', flag: 'lock locked fixed brand', label: 'Brand locked', tab: 'brand' },
  { id: 'dash-palette-wheel', flag: 'color colour colours palette wheel greys neutrals', label: 'Palette on the wheel', tab: 'brand' },
  { id: 'dash-typedemo', flag: 'type typography font motion kinetic', label: 'Type in motion', tab: 'brand' },
  { id: 'dash-palette', flag: 'color colour colours', label: 'Colour palette', tab: 'brand' },
  { id: 'dash-tokens', flag: 'tokens radius spacing shadow gradient', label: 'Brand tokens', tab: 'brand' },
  { id: 'dash-print', flag: 'print cmyk', label: 'Print & CMYK', tab: 'brand' },

  // ── Activity & stats
  { id: 'dash-catalogue', flag: 'catalog catalogue', label: 'Catalogue', tab: 'activity' },
  { id: 'dash-activity', flag: 'activity', label: 'Your activity', tab: 'activity' },
  { id: 'dash-recent', flag: 'recent creations', label: 'Recent creations', tab: 'activity' },
  { id: 'dash-exports', flag: 'exports downloads latest', label: 'Latest exports', tab: 'activity' },

  // ── Capability groups (distilled copy of CAPABILITY_SECTIONS - see the
  // module header for why copied; drift pinned by dashboard-registry.test.ts).
  // dashboard.ts renders these from the data module itself, not from here.
  { id: 'cap-experiences', flag: 'experiences', label: 'Experiences', tab: 'caps' },
  { id: 'cap-platforms', flag: 'platforms', label: 'Platforms & runtimes', tab: 'caps' },
  { id: 'cap-formats', flag: 'formats', label: 'Export formats', tab: 'caps' },
  { id: 'cap-import', flag: 'import', label: 'Import formats', tab: 'caps' },
  { id: 'cap-print', flag: 'print', label: 'Print production', tab: 'caps' },
  { id: 'cap-automation', flag: 'automation', label: 'Automation & AI', tab: 'caps' },
  { id: 'cap-determinism', flag: 'determinism', label: 'Determinism & reproducibility', tab: 'caps' },
  { id: 'cap-brand', flag: 'brand', label: 'Brand & design system', tab: 'caps' },
  { id: 'cap-privacy', flag: 'privacy', label: 'Privacy & data ownership', tab: 'caps' },
  { id: 'cap-security', flag: 'security encryption', label: 'Security & access control', tab: 'caps' },
  { id: 'cap-architecture', flag: 'architecture', label: 'Architecture (for builders)', tab: 'caps' },
];

const byId = new Map(DASH_SECTIONS.map((s) => [s.id, s]));

/**
 * The data-flag keyword list for a section id - dashboard.ts's template
 * interpolation point. Unknown ids return '' (an empty data-flag renders inert
 * rather than crashing the view); the co-located test pins every id dashboard.ts
 * actually asks for, so a typo fails the suite, not the render.
 *
 * The section's own id is APPENDED as a flag token: keyword flags collide
 * across sections ('print' belongs to both dash-print and cap-print, 'color'
 * to both palette sections), and applyDeepLink resolves a flag to the FIRST
 * DOM-order owner - so a keyword href can land on the wrong section. Ids are
 * unique by construction, which makes `#/d?<id>` an exact address.
 */
export function dashFlag(id: string): string {
  const flag = byId.get(id)?.flag;
  return flag ? `${flag} ${id}` : '';
}

/** A registry entry's deep-link href - sections by their own unique id
 *  (`#/d?dash-storage` - dashFlag() plants the id as a flag token, see above),
 *  tab entries by their tab key (`#/d?tab=brand`). Shared by the settings
 *  provider so hit hrefs and applyDeepLink cannot diverge. */
export function dashHref(entry: DashSection): string {
  return entry.flag ? `#/d?${encodeURIComponent(entry.id)}` : `#/d?tab=${encodeURIComponent(entry.tab ?? '')}`;
}
