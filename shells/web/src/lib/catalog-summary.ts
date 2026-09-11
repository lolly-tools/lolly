// SPDX-License-Identifier: MPL-2.0
/**
 * Catalogue summary - a shared, read-only overview of what ships in this build:
 * the tools (grouped by category, tagged by status) and the brand-asset library
 * (grouped by type). Rendered on BOTH the Dashboard (#/d) and at the foot of the
 * Profile page (#/profile) from ONE source so the two can't drift.
 *
 * Every item type - tool category, tool status, and asset type - carries a
 * Lucide-house icon so the grid reads at a glance. The tools half is known
 * synchronously from window.__toolIndex; the brand-asset counts are filled in
 * after first paint by hydrateCatalogAssets() (a fetch of the asset index), so a
 * caller can paint immediately and the counts fade in when they land.
 *
 * Icon path data lives in lib/icons.ts (the shared registry - see
 * plans/76-component-audit.md recommendation 5); 'palette', 'filmStrip' (lottie),
 * 'shapes' (vector) and 'grid' (categoryOther) are deduped there against
 * lib/category-icons.ts's near-identical glyphs.
 */

import { escape } from '../utils.ts';
import { icon } from './icons.ts';
import { instanceFetch, instancePath } from './instance.ts';

/** The slice of a catalogue-index tool entry this summary reads (the index shape
 *  is a build artifact, not a domain type the engine owns - see PlatformTool /
 *  GalleryTool for the same local-projection precedent). */
export interface CatalogTool {
  id: string;
  category?: string;
  status?: string;
}

// One item-type key → shared-registry icon name each, plus a generic fallback
// for each family so a new category/status/type added to the data still
// renders with *an* icon rather than a blank tile.
const ICON = {
  // Tool categories.
  everyone: icon('globe'),
  designer: icon('paintbrush'),
  event: icon('calendar'),
  product: icon('box'),
  utility: icon('wrench'),
  categoryOther: icon('grid'),
  // Tool statuses.
  official: icon('badgeCheck'),
  experimental: icon('flask'),
  community: icon('users'),
  statusOther: icon('sunburst'),
  // Asset types.
  vector: icon('shapes'),
  raster: icon('image'),
  audio: icon('music'),
  lottie: icon('filmStrip'),
  model: icon('box'),
  lut: icon('sliders'),
  palette: icon('palette'),
  tokens: icon('tokens'),
  assetOther: icon('document'),
} as const;

const categoryIcon = (k: string): string => ICON[k as keyof typeof ICON] ?? ICON.categoryOther;
const statusIcon = (k: string): string =>
  k === 'official' || k === 'experimental' || k === 'community' ? ICON[k] : ICON.statusOther;
const assetIcon = (k: string): string =>
  ({ vector: ICON.vector, raster: ICON.raster, audio: ICON.audio, lottie: ICON.lottie, model: ICON.model, lut: ICON.lut, palette: ICON.palette, tokens: ICON.tokens })[k] ??
  ICON.assetOther;

// Friendlier display labels where the raw index key is terse/techy; everything
// else falls back to a capitalised key.
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const LABEL: Record<string, string> = {
  everyone: 'For everyone', utility: 'Utilities', product: 'Products', event: 'Events',
  raster: 'Raster', vector: 'Vector', lottie: 'Lottie', model: '3D', lut: 'LUTs', palette: 'Palettes', tokens: 'Tokens',
};
const label = (k: string): string => LABEL[k] ?? cap(k);

/** Count items by a key, returned largest-group first. */
function countBy<T>(items: readonly T[], key: (t: T) => string): Array<[string, number]> {
  const counts: Record<string, number> = {};
  for (const it of items) {
    const k = key(it);
    counts[k] = (counts[k] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

// One icon tile: big count, glyph, label. Used for tool categories & asset types.
// Named .cat-stat-tile (component audit rec 10 follow-up) - .cat-tile alone
// collided with catalog.ts's unrelated asset card of the same name.
function tile(icon: string, count: number, name: string): string {
  return `
    <div class="cat-stat-tile">
      <span class="cat-stat-tile-icon">${icon}</span>
      <span class="cat-stat-tile-num">${count}</span>
      <span class="cat-stat-tile-label">${escape(name)}</span>
    </div>`;
}

// A compact icon chip for the secondary "by status" row.
// Named .cat-stat-tag (component audit M1.2 follow-up) - .cat-tag alone
// collided with catalog.ts's unrelated details-modal tag of the same name.
function tag(icon: string, count: number, name: string): string {
  return `<span class="cat-stat-tag"><span class="cat-stat-tag-icon">${icon}</span><strong>${count}</strong>${escape(name)}</span>`;
}

/**
 * The full catalogue-summary body: a "Tools" group (category tiles + status
 * chips, known synchronously) and a "Brand assets" group whose grid is a
 * placeholder until hydrateCatalogAssets() fills it. The caller wraps this in its
 * own section chrome (a Platform <details> panel / a Profile card).
 */
export function catalogSummaryBody(tools: readonly CatalogTool[], assets?: readonly { type?: string }[]): string {
  const byCategory = countBy(tools, (t) => t.category ?? 'other');
  const byStatus = countBy(tools, (t) => t.status ?? 'official');
  return `
    <div class="cat-summary">
      <section class="cat-group">
        <h3 class="cat-group-title">Tools <span class="cat-group-count">${tools.length}</span></h3>
        <div class="cat-grid">
          ${byCategory.map(([k, n]) => tile(categoryIcon(k), n, label(k))).join('') || '<p class="cat-empty">none loaded</p>'}
        </div>
        ${byStatus.length ? `<div class="cat-stat-tags">${byStatus.map(([k, n]) => tag(statusIcon(k), n, label(k))).join('')}</div>` : ''}
      </section>

      <section class="cat-group" data-asset-block>
        <h3 class="cat-group-title">Brand assets <span class="cat-group-count" data-asset-count${assets ? '' : ' hidden'}>${assets ? assets.length : ''}</span></h3>
        <div class="cat-grid" data-asset-grid>${assets ? countBy(assets, a => a.type ?? 'other').map(([k, n]) => tile(assetIcon(k), n, label(k))).join('') || '<p class="cat-empty">No assets yet</p>' : '<p class="cat-empty">reading…</p>'}</div>
      </section>
    </div>`;
}

interface AssetSummary {
  total: number;
  byType: Array<[string, number]>;
}

// Brand-asset catalogue summary - best-effort; absent offline is fine. No
// `cache: 'no-store'` so a repeat visit reuses the HTTP cache (these figures only
// feed the read-only counts).
async function fetchAssetSummary(): Promise<AssetSummary | null> {
  try {
    const resp = await instanceFetch(instancePath('/catalog/assets/index.json'));
    if (!resp.ok) return null;
    // Response.json() is `any` in lib.dom; the parsed index is an array of
    // entries or an object wrapping one under `assets`.
    const idx = await resp.json();
    const arr = Array.isArray(idx) ? idx : idx.assets ?? [];
    return { total: arr.length, byType: countBy(arr, (a: { type?: string }) => a.type ?? 'other') };
  } catch {
    return null;
  }
}

/**
 * Fill the "Brand assets" group inside a rendered summary (found under `root`).
 * Safe to call after the caller has moved on: it writes nothing when the target
 * is gone. Returns once the fetch resolves (best-effort; leaves the placeholder
 * on failure).
 */
export async function hydrateCatalogAssets(root: HTMLElement): Promise<void> {
  const block = root.querySelector<HTMLElement>('[data-asset-block]');
  if (!block) return;
  const grid = block.querySelector<HTMLElement>('[data-asset-grid]');
  const assets = await fetchAssetSummary();
  if (!grid || !block.isConnected) return;
  if (!assets) {
    grid.innerHTML = '<p class="cat-empty">unavailable offline</p>';
    return;
  }
  const count = block.querySelector<HTMLElement>('[data-asset-count]');
  if (count) {
    count.textContent = String(assets.total);
    count.hidden = false;
  }
  grid.innerHTML = assets.byType.map(([k, n]) => tile(assetIcon(k), n, label(k))).join('');
  grid.classList.add('cat-hydrated');
}
