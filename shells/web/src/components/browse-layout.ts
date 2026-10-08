// SPDX-License-Identifier: MPL-2.0
/**
 * Browse layouts (plan 302): how a browsing view draws its items, and how densely.
 *
 *   - Layout: Grid (the large preview cards every view has today), Card (a thumbnail
 *     beside the name and two detail lines, the dense mode for big libraries) or List
 *     (a table of rows). Grid is the default and carries no attribute, so a view at
 *     Grid renders exactly as it did before this module existed.
 *   - Density: Comfortable (the default, no attribute) or Compact, in every layout.
 *
 * Both are attributes on the element that already carries `data-card-size`
 * (`data-browse-layout`, `data-browse-density`), so a change is an attribute flip on
 * live tiles: previews, players, pages, selection, focus and scroll all survive the switch.
 * The CSS lives in styles/parts/browse-layout.css.
 *
 * Each view keeps its own choice (`lolly-layout-<view>`, `lolly-density-<view>`, both
 * absent at the default). A link may name a layout (`layout=card`); a link is read on
 * arrival and never saved. A docs capture always draws Grid and Comfortable unless its
 * link asks for a layout, so captures do not move.
 *
 * Markup and wiring only. The view decides what a change means for its own extras
 * (the favourites strip shows only in Grid, for example) through `onChange`.
 */
import { t } from '../i18n.ts';
import { segHtml } from '../lib/seg.ts';
import { captureNeutralPinned } from '../lib/capture-neutral.ts';
import { updateRouteParams } from '../lib/url-state.ts';
import { viewOptionsSection, type CardSizeView } from './view-options.ts';

export type BrowseLayout = 'grid' | 'card' | 'list';
export type BrowseDensity = 'comfortable' | 'compact';
/** Every view that browses items: the card-size views plus the asset picker. */
export type LayoutView = CardSizeView | 'picker';

export const BROWSE_LAYOUTS: readonly BrowseLayout[] = ['grid', 'card', 'list'];

const layoutKey = (view: LayoutView): string => `lolly-layout-${view}`;
const densityKey = (view: LayoutView): string => `lolly-density-${view}`;

/** `grid`, `card` or `list`. `preview` reads as Grid: Projects stored and linked that
 *  name before the three layouts shared one vocabulary. Anything else is null. */
export function parseLayout(value: unknown): BrowseLayout | null {
  if (value === 'grid' || value === 'preview') return 'grid';
  return value === 'card' || value === 'list' ? value : null;
}

export function parseDensity(value: unknown): BrowseDensity | null {
  return value === 'comfortable' || value === 'compact' ? value : null;
}

/** The keys Assets and Projects used before this module. Each move runs inside the
 *  first read that needs it and removes the old key, so it runs once and needs no
 *  marker. Only a non-default value is copied, and never over a newer choice. */
const LEGACY_LAYOUT: Partial<Record<LayoutView, string>> = { catalog: 'lolly-catalog-layout', projects: 'lolly:projectsView' };
const LEGACY_DENSITY: Partial<Record<LayoutView, string>> = { catalog: 'lolly-catalog-density' };

function moveLegacy(oldKey: string | undefined, newKey: string, keep: string): void {
  if (!oldKey) return;
  const old = localStorage.getItem(oldKey);
  if (old === null) return;
  if (old === keep && localStorage.getItem(newKey) === null) localStorage.setItem(newKey, keep);
  localStorage.removeItem(oldKey);
}

/**
 * The layout a view opens in: the link's `layout=` (Projects also reads its older
 * `view=`), then Grid under a docs capture, then the view's saved choice, then Grid.
 * `offered` is what this view can draw today; a value it cannot draw falls through.
 */
export function readLayout(view: LayoutView, query = '', offered: readonly BrowseLayout[] = BROWSE_LAYOUTS): BrowseLayout {
  const params = new URLSearchParams(query);
  const linked = parseLayout(params.get('layout')) ?? (view === 'projects' ? parseLayout(params.get('view')) : null);
  if (linked && offered.includes(linked)) return linked;
  if (captureNeutralPinned()) return 'grid';
  try {
    moveLegacy(LEGACY_LAYOUT[view], layoutKey(view), 'list');
    const saved = parseLayout(localStorage.getItem(layoutKey(view)));
    if (saved && offered.includes(saved)) return saved;
  } catch { /* storage off */ }
  return 'grid';
}

/** Remember a view's layout. Grid, the default, is stored as nothing. */
export function writeLayout(view: LayoutView, mode: BrowseLayout): void {
  try {
    if (mode === 'grid') localStorage.removeItem(layoutKey(view));
    else localStorage.setItem(layoutKey(view), mode);
  } catch { /* storage off */ }
}

/** The density a view opens in. A docs capture always draws Comfortable. */
export function readDensity(view: LayoutView): BrowseDensity {
  if (captureNeutralPinned()) return 'comfortable';
  try {
    moveLegacy(LEGACY_DENSITY[view], densityKey(view), 'compact');
    return parseDensity(localStorage.getItem(densityKey(view))) ?? 'comfortable';
  } catch { return 'comfortable'; }
}

/** Remember a view's density. Comfortable, the default, is stored as nothing. */
export function writeDensity(view: LayoutView, density: BrowseDensity): void {
  try {
    if (density === 'comfortable') localStorage.removeItem(densityKey(view));
    else localStorage.setItem(densityKey(view), density);
  } catch { /* storage off */ }
}

/** Container attributes for markup: empty at the defaults. */
export const layoutAttr = (mode: BrowseLayout): string => mode === 'grid' ? '' : ` data-browse-layout="${mode}"`;
export const densityAttr = (density: BrowseDensity): string => density === 'compact' ? ' data-browse-density="compact"' : '';

/**
 * Switch a live container in place. Tiles name the element that describes them in
 * `data-describedby`; the description is wired only outside Grid, because a
 * description is read from hidden content too, and in Grid the detail cells are
 * hidden, so every Grid tile would announce text nobody can see.
 */
export function applyLayout(container: Element | null | undefined, mode: BrowseLayout): void {
  if (!container) return;
  if (mode === 'grid') container.removeAttribute('data-browse-layout');
  else container.setAttribute('data-browse-layout', mode);
  syncDescriptions(container, mode);
}

/** Wire or unwire each tile's description for `mode`; run after new tiles are drawn. */
export function syncDescriptions(root: Element | null | undefined, mode: BrowseLayout): void {
  for (const el of root?.querySelectorAll<HTMLElement>('[data-describedby]') ?? []) {
    if (mode === 'grid') el.removeAttribute('aria-describedby');
    else el.setAttribute('aria-describedby', el.dataset.describedby ?? '');
  }
}

export function applyDensity(container: Element | null | undefined, density: BrowseDensity): void {
  if (!container) return;
  if (density === 'compact') container.setAttribute('data-browse-density', 'compact');
  else container.removeAttribute('data-browse-density');
}

/**
 * The Layout section of View options: the layout segment, then `extra` (the card-size
 * slider and the density segment). `modes` is what this view offers today.
 */
export function layoutSection(group: string, value: BrowseLayout, modes: readonly BrowseLayout[] = BROWSE_LAYOUTS, extra = ''): string {
  const labels: Record<BrowseLayout, string> = { grid: t('Grid'), card: t('Card'), list: t('List') };
  return viewOptionsSection(t('Layout'), segHtml(group, modes.map(id => ({ id, label: labels[id] })), value, t('Layout'),
    { attr: 'data-layout-mode', extraClass: 'view-seg--layout' }) + extra);
}

/** The density segment, Comfortable | Compact, for the Layout section. `hidden` is for
 *  a layout that has no Compact form yet, so the segment never offers a choice that
 *  changes nothing. */
export function densityHtml(group: string, value: BrowseDensity, hidden = false): string {
  return segHtml(group, [
    { id: 'comfortable', label: t('Comfortable') },
    { id: 'compact', label: t('Compact') },
  ], value, t('Tile density'), { attr: 'data-density-mode', extraClass: 'view-seg--density', ...(hidden ? { groupAttr: 'hidden' } : {}) });
}

/**
 * Wire the layout segment inside `panel`. A press updates the buttons, hides the
 * card-size slider in List (rows take their height from density) and the Favourites
 * section outside Grid (the strip draws only there), remembers the choice, writes
 * `layout=` into the address (omitted at Grid) and hands the mode to the view.
 */
export function wireLayoutControl(panel: HTMLElement, o: { view: LayoutView; current: BrowseLayout; onChange(mode: BrowseLayout): void }): void {
  let current = o.current;
  const sync = (): void => {
    for (const b of panel.querySelectorAll<HTMLElement>('[data-layout-mode]')) b.setAttribute('aria-pressed', String(b.dataset.layoutMode === current));
    panel.querySelector('.view-options-size')?.toggleAttribute('hidden', current === 'list');
    panel.querySelector('[data-be-seg="featured-view"]')?.closest('.filter-pop-sort')?.toggleAttribute('hidden', current !== 'grid');
  };
  sync();
  panel.addEventListener('click', (event) => {
    const mode = parseLayout((event.target as Element | null)?.closest<HTMLElement>('[data-layout-mode]')?.dataset.layoutMode);
    if (!mode || mode === current) return;
    current = mode;
    sync();
    writeLayout(o.view, mode);
    // The picker is a modal with no address of its own. Projects drops its older
    // `view=` alias on the first change, so the address carries the layout under one name.
    if (o.view !== 'picker') updateRouteParams({ layout: mode === 'grid' ? null : mode, ...(o.view === 'projects' ? { view: null } : {}) });
    o.onChange(mode);
  });
}

/** Wire the density segment inside `panel`: press, remember, hand the value on. */
export function wireDensityControl(panel: HTMLElement, o: { view: LayoutView; current: BrowseDensity; onChange(density: BrowseDensity): void }): void {
  let current = o.current;
  panel.addEventListener('click', (event) => {
    const density = parseDensity((event.target as Element | null)?.closest<HTMLElement>('[data-density-mode]')?.dataset.densityMode);
    if (!density || density === current) return;
    current = density;
    for (const b of panel.querySelectorAll<HTMLElement>('[data-density-mode]')) b.setAttribute('aria-pressed', String(b.dataset.densityMode === current));
    writeDensity(o.view, density);
    o.onChange(density);
  });
}
