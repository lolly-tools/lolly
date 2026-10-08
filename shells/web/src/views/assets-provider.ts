// SPDX-License-Identifier: MPL-2.0
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { escape as escapeText } from '../utils.ts';
import { t } from '../i18n.ts';
import { fold } from '../lib/search/match.ts';
import { parseCatQuery, withCatalogFacet, type CatalogFacet } from './assets-filter.ts';

export function providerNames(asset: AssetRef, key: string): string[] {
  const value = asset.meta?.[key];
  return [...new Set(Array.isArray(value) ? value.filter((name): name is string => typeof name === 'string' && !!name.trim()).map(name => name.trim()) : [])];
}

export interface ProviderGroup {
  key: string;
  label: string;
  source: string;
  items: AssetRef[];
}

export function providerCategory(asset: AssetRef): Omit<ProviderGroup, 'items'> | null {
  const provider = asset.meta?.provider;
  if (typeof provider !== 'string' || !provider) return null;
  const source = String(asset.meta?.providerLabel || provider);
  const label = providerNames(asset, 'providerSections')[0] || t('Uncategorised');
  return { key: `provider/${encodeURIComponent(provider)}/${encodeURIComponent(label)}`, label, source };
}

/** Each asset appears once, under its provider's primary category. */
export function providerGroups(assets: readonly AssetRef[]): ProviderGroup[] {
  const groups = new Map<string, ProviderGroup>();
  for (const asset of assets) {
    const category = providerCategory(asset);
    if (!category) continue;
    const group = groups.get(category.key) ?? { ...category, items: [] };
    group.items.push(asset);
    groups.set(category.key, group);
  }
  return [...groups.values()].sort((a, b) => a.source.localeCompare(b.source) || a.label.localeCompare(b.label));
}

export interface ProviderFacetOption { name: string; count: number }

/** A connected-library filter stays within that library when there is one source. */
export function withProviderFacet(assets: readonly AssetRef[], query: string, facet: CatalogFacet, value: string): string {
  let result = withCatalogFacet(query, facet, value);
  if (value && facet !== 'source' && !parseCatQuery(result).sources.length) {
    const sources = providerFacets(assets).source;
    if (sources.length === 1) result = withCatalogFacet(result, 'source', sources[0]!.name);
  }
  return result;
}

export function providerFacets(assets: readonly AssetRef[]): Record<CatalogFacet, ProviderFacetOption[]> {
  const counts: Record<CatalogFacet, Map<string, ProviderFacetOption>> = {
    source: new Map(), category: new Map(), collection: new Map(), tag: new Map(),
  };
  for (const asset of assets) {
    if (!asset.meta?.provider) continue;
    const names = {
      source: [String(asset.meta.providerLabel || asset.meta.provider)],
      category: providerNames(asset, 'providerSections'),
      collection: providerNames(asset, 'providerCollections'),
      tag: providerNames(asset, 'providerTags').filter(name => !name.startsWith('provider:')),
    };
    for (const facet of ['source', 'category', 'collection', 'tag'] as const) {
      const seen = new Set<string>();
      for (const name of names[facet]) {
        const key = fold(name);
        if (seen.has(key)) continue;
        seen.add(key);
        const option = counts[facet].get(key) ?? { name, count: 0 };
        option.count++;
        counts[facet].set(key, option);
      }
    }
  }
  return Object.fromEntries(Object.entries(counts).map(([facet, options]) => [facet,
    [...options.values()].sort((a, b) => a.name.localeCompare(b.name)),
  ])) as Record<CatalogFacet, ProviderFacetOption[]>;
}

export function providerBrowserHtml(assets: readonly AssetRef[], query: string): string {
  const facets = providerFacets(assets);
  if (!facets.source.length) return '';
  const parsed = parseCatQuery(query);
  const selected = { source: parsed.sources, category: parsed.categories, collection: parsed.collections, tag: parsed.tags };
  const labels = { source: t('Library'), category: t('Category'), collection: t('Collection'), tag: t('Tag') };
  const selects = (['source', 'category', 'collection', 'tag'] as const).filter(facet => facets[facet].length).map(facet => {
    const current = selected[facet][0];
    const options = [...facets[facet]];
    if (current && !options.some(option => fold(option.name) === current)) options.unshift({ name: current, count: 0 });
    return `<label class="cat-provider-filter"><span>${escapeText(labels[facet])}</span><select class="field-select" data-provider-facet="${facet}">
      <option value="">${t('All')}</option>${options.map(option => `<option value="${escapeText(option.name)}"${fold(option.name) === current ? ' selected' : ''}>${escapeText(option.name)} (${option.count})</option>`).join('')}
    </select></label>`;
  }).join('');
  const popular = [...facets.tag].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 8);
  return `<section class="cat-provider-browser" aria-label="${escapeText(t('Browse connected libraries'))}">
    <div class="cat-provider-heading"><h2>${facets.source.map(option => escapeText(option.name)).join(' · ')}</h2><span>${t('Browse categories, collections and tags')}</span></div>
    <div class="cat-provider-filters">${selects}${Object.values(selected).some(values => values.length) ? `<button type="button" class="btn" data-provider-clear>${t('Clear filters')}</button>` : ''}</div>
    ${popular.length ? `<div class="cat-provider-tags" role="group" aria-label="${escapeText(t('Popular tags'))}">${popular.map(option => `<button type="button" class="cat-tag${parsed.tags.includes(fold(option.name)) ? ' btn btn--primary' : ''}" data-provider-tag="${escapeText(option.name)}" aria-pressed="${parsed.tags.includes(fold(option.name))}">${escapeText(option.name)} <span>${option.count}</span></button>`).join('')}</div>` : ''}
  </section>`;
}
