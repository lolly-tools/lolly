// SPDX-License-Identifier: MPL-2.0
/** Library category presentation shared by the picker's search and filter row. */
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { t } from '../i18n.ts';
import { escape as escapeHtml } from '../utils.ts';
import { categoryLabel, LIB_GROUPS, type LibGroup } from '../lib/asset-category.ts';
import { categoryGlyph } from '../lib/category-icons.ts';
import { providerGroups } from './assets-provider.ts';
import { buildSearchHaystack, matchesQuery } from './assets-filter.ts';

/** Cache native taxonomy text once per library load; counts and results agree. */
export class PickerLibrarySearch {
  private haystack: ReadonlyMap<string, string> | null = null;
  reset(): void { this.haystack = null; }
  filter(assets: readonly AssetRef[], query: string, category: (asset: AssetRef) => string): AssetRef[] {
    if (!query) return [...assets];
    this.haystack ??= buildSearchHaystack(assets, category);
    return assets.filter(asset => matchesQuery(asset, query, this.haystack!));
  }
}

export function pickerLibraryGroups(
  candidates: readonly AssetRef[], buckets: ReadonlyMap<string, readonly AssetRef[]>, labels: Map<string, string>,
): LibGroup[] {
  const native = providerGroups(candidates);
  labels.clear();
  for (const group of native) labels.set(group.key, group.label);
  return [
    ...native.map(group => ({ key: group.key, label: `${group.source} · ${group.label}` })),
    ...LIB_GROUPS.filter(group => buckets.get(group.key)?.length),
  ];
}

export function pickerCategoryButtons(
  keys: readonly string[], collapsed: ReadonlySet<string>, labels: ReadonlyMap<string, string>,
): string {
  return keys.map(key => {
    const on = !collapsed.has(key), nativeLabel = labels.get(key);
    const label = nativeLabel ?? t(categoryLabel(key));
    return `<button type="button" class="asset-picker-catbtn${on ? ' is-active' : ''}${nativeLabel ? ' asset-picker-catbtn--named' : ''}" data-cat-filter="${escapeHtml(key)}" aria-pressed="${on}" aria-label="${escapeHtml(label)}" data-tip="${escapeHtml(label)}" data-tip-below>
      <span class="asset-picker-catbtn-glyph">${categoryGlyph(key)}</span>${nativeLabel ? `<span>${escapeHtml(label)}</span>` : ''}
    </button>`;
  }).join('');
}
