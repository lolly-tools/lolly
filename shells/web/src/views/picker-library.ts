// SPDX-License-Identifier: MPL-2.0
/** Library category presentation shared by the picker's search and filter row. */
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { t } from '../i18n.ts';
import { escape as escapeHtml } from '../utils.ts';
import { categoryLabel, LIB_GROUPS, type LibGroup } from '../lib/asset-category.ts';
import { categoryGlyph } from '../lib/category-icons.ts';
import { icon } from '../lib/icons.ts';
import { providerGroups } from './assets-provider.ts';
import { buildSearchHaystack, matchesQuery } from './assets-filter.ts';
import type { IconTheme } from '../../../../engine/src/icon-theme.ts';

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

const CHEVRON = icon('chevronRight', { size: 13, strokeWidth: 2.5 });

/** One collapsible picker section: the library groups, their sub-groups, Recent and Favourites. */
export function pickerSectionHtml(
  g: { key: string; label: string }, count: string | number, strip: string, bodyHtml: string, collapsed: boolean,
): string {
  return `<section class="asset-picker-group${collapsed ? ' is-collapsed' : ''}" data-group="${escapeHtml(g.key)}">
      <div class="asset-picker-group-head">
        <button type="button" class="asset-picker-group-toggle" data-group-toggle="${escapeHtml(g.key)}" aria-expanded="${!collapsed}">
          <span class="asset-picker-group-chevron">${CHEVRON}</span>
          <span class="asset-picker-group-icon">${categoryGlyph(g.key)}</span>
          <span class="asset-picker-group-title">${escapeHtml(t(g.label))}</span>
          <span class="asset-picker-count">${count}</span>
        </button>
        ${strip}
      </div>
      <div class="asset-picker-group-body">${bodyHtml}</div>
    </section>`;
}

/** The icon colour strip: "Original", then one pairing per colourway; Original reads as active when none is chosen. */
export function pickerThemeStripHtml(iconThemes: readonly IconTheme[], activeTheme: string | null | undefined): string {
  // "Original" leads: the icon's own colours, which is the plain id. Then one pairing per
  // colourway of the design system (bridge/assets.ts _iconThemes).
  const original = !activeTheme;
  return `<div class="asset-picker-themes" role="group" aria-label="${escapeHtml(t('Theme'))}">`
    + `<span class="asset-picker-themes-label">${t('Colours')}</span>`
    + `<button type="button" class="asset-picker-theme asset-picker-theme--original${original ? ' is-active' : ''}" data-theme-id="" aria-pressed="${original}"><span>${t('Original')}</span></button>`
    + iconThemes.map((theme) => {
        const on = theme.id === activeTheme;
        return `<button type="button" class="asset-picker-theme${on ? ' is-active' : ''}" data-theme-id="${escapeHtml(theme.id)}" data-sfx="shimmer" aria-pressed="${on}">
            <span class="asset-picker-theme-duo" style="background:${escapeHtml(theme.previewBg ?? '#ffffff')}"><i style="background:${escapeHtml(theme.c2)}"></i><i style="background:${escapeHtml(theme.c1)}"></i></span>
            <span>${escapeHtml(theme.label ?? theme.id)}</span>
          </button>`;
      }).join('')
    + `</div>`;
}

/** Cards a library group draws before its Show more button (the Assets view's page size too). */
export const PICKER_PAGE_SIZE = 120;
