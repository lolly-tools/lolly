// SPDX-License-Identifier: MPL-2.0
/** A bounded shared-library page beside device assets, with retained explicit selections. */
import { AssetBrowser, CatalogBrowseError, type BrowseFilters } from '../../catalog/browse.ts';
import { getInstanceBase } from '../../lib/instance.ts';
import { TYPE_FILTER_TYPES, parseCatQuery } from '../assets-filter.ts';
import { escape as esc } from '../../utils.ts';
import { t } from '../../i18n.ts';
import { updateRouteParams } from '../../lib/url-state.ts';
import { setSearchBarQuery } from '../../components/search-bar.ts';
import { buildAssetSourceTree, sourceNodeId, type AssetSourceNode } from '../../lib/asset-source-tree.ts';
import { assetListHead } from './layout.ts';
import type { CatCtx } from './context.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';

/**
 * Whether each instance provides shared browsing, as far as this page session has heard:
 * true once it returned a valid page or refused the visitor in JSON (a gated Work server asking
 * them to sign in), false after a 404 or a reply that is not JSON (a static host, or the HTML a
 * dev server falls back to). Keyed by instance base, so another instance is asked again. An
 * outage, a network error or a refusal with no JSON body answers neither way and is not kept.
 */
const answers = new Map<string, boolean>();

export function remoteOps(cat: CatCtx) {
  const browser = new AssetBrowser();
  // An instance already known to have no shared library is neither asked nor shown again.
  if (answers.get(getInstanceBase()) === false) browser.supported = false;
  let signature = '', painted = '', disposed = false, timer: ReturnType<typeof setTimeout> | undefined;
  let pendingRefresh: ReturnType<typeof setTimeout> | undefined;
  let tag = new URLSearchParams(cat.params).get('tag') ?? '';
  const shared = (ref: AssetRef | undefined) => !!ref && (!!ref.meta?.provider || ref.id.startsWith('inst/'));
  const filters = (): BrowseFilters | null => {
    if (cat.projects?.active()) return null;
    if (['device', 'projects', 'catalog'].includes(cat.sourceSelection)) return null;
    const out: BrowseFilters = { scope: 'shared', q: cat.query, tag };
    if (cat.typeFilter !== 'all') out.types = [...TYPE_FILTER_TYPES[cat.typeFilter]].join(',');
    if (cat.sourceSelection !== 'all') {
      try {
        const node: unknown = JSON.parse(cat.sourceSelection);
        if (!Array.isArray(node) || typeof node[0] !== 'string') return null;
        out.source = node[0];
        if (node.length > 1) { out.taxonomyKind = node[1]; out.taxonomyId = node[2]; }
      } catch { return null; }
    }
    return out;
  };
  const reconcile = () => {
    if (browser.supported !== true) return;
    const retained = [...cat.assetById.values()].filter(ref => cat.selected.has(ref.id) && shared(ref));
    cat.allAssets = cat.allAssets.filter(ref => !shared(ref));
    cat.assetById = new Map([...cat.allAssets, ...browser.refs, ...retained].map(ref => [ref.id, ref]));
    cat.searchHaystack = null;
  };
  // The section shows only after this instance confirmed shared browsing, on this mount or an
  // earlier one. A JSON refusal confirms without a page, and the section then asks the visitor
  // to sign in; the 401/403 clean-up in load() runs once confirmed.
  const confirmed = () => browser.supported === true || (browser.supported === null && answers.get(getInstanceBase()) === true);
  const paint = () => { if (!disposed && cat.mounted) { reconcile(); cat.sections.renderBody(); cat.sources.mount(); } };
  // What the Sources rail reads from this module.
  const rail = () => JSON.stringify([!!browser.supported, browser.page?.facets.taxonomy ?? null, cat.sourceStatuses]);
  // Redraw only what a load changed. The body repaints when device groups lose shared records
  // or the answer changes a rule outside the section, such as an empty type filter falling back
  // to All. Otherwise the section is swapped in place, or left alone when its markup is the
  // same, as it always is while the section stays hidden.
  const refresh = (supported: boolean | null, sources: string) => {
    if (disposed || !cat.mounted) return;
    const count = cat.allAssets.length; reconcile();
    const answered = browser.supported !== supported;
    if (cat.allAssets.length !== count || (answered && (browser.supported !== false || supported === true || cat.filters.typeBucketEmpty()))) { paint(); return; }
    if (markup() !== painted && !cat.sections.renderShared()) { paint(); return; }
    if (rail() !== sources) cat.sources.mount();
  };
  const unsupportedQuery = () => { const query = parseCatQuery(cat.query); return query.tags.length || query.types.length || query.flags.length || query.categories.length || query.collections.length || query.sources.length; };
  const load = async (direction: 'reset' | 'next' | 'previous' | 'retry' = 'reset', live = false) => {
    const query = filters(); if (!query) return;
    let supported = browser.supported, sources = rail();
    if (unsupportedQuery()) { browser.page = null; browser.refs = []; browser.error = new CatalogBrowseError('Use the shared Type, Tag and source controls for exact filters. Search operators are not supported in shared browse.'); refresh(supported, sources); return; }
    const base = getInstanceBase(), operation = browser.load(query, direction, live);
    refresh(supported, sources); supported = browser.supported; sources = rail();
    const answer = await operation;
    if (disposed || !cat.mounted) return;
    if (!live && answer !== null) answers.set(base, answer);
    let dropped = false;
    if (confirmed() && (browser.error?.status === 401 || browser.error?.status === 403)) {
      for (const [id, ref] of cat.assetById) if (shared(ref)) { cat.assetById.delete(id); dropped = cat.selected.delete(id) || dropped; }
      cat.sections.closeDetails();
    }
    if (browser.page?.sources) {
      const merged = new Map(cat.sourceStatuses.map(source => [source.id, source]));
      for (const source of browser.page.sources) merged.set(source.id, source);
      cat.sourceStatuses = [...merged.values()];
    }
    if (dropped) paint(); else refresh(supported, sources);
    clearTimeout(pendingRefresh);
    if (browser.page?.sources?.some(source => source.status === 'pending')) pendingRefresh = setTimeout(() => { if (!disposed && cat.mounted) void load(); }, 3000);
  };
  const sync = () => {
    const query = filters(), key = JSON.stringify(query);
    if (key === signature) return;
    signature = key; clearTimeout(timer);
    browser.dispose();
    if (query && browser.supported !== false) timer = setTimeout(() => { void load(); }, 180);
  };
  const markup = () => {
    if (!filters() || !confirmed()) return '';
    const { page, loading, error } = browser;
    const status = loading ? t('Loading shared assets…') : error ? t(error.message)
      : page ? browser.mode === 'live' ? t('Live results are a limited candidate set. Use indexed browse for exact filters and counts.')
        : t('{shown} records on this page · {total} indexed matches', { shown: browser.refs.length, total: page.total.toLocaleString() })
      : t('Shared assets');
    const partial = page && page.complete !== true ? `<p class="cat-remote-note">${t('The source listing may be incomplete. Counts describe indexed records, not the entire upstream library.')}</p>` : '';
    const sources = page?.sources?.filter(source => source.status !== 'current' || source.truncated || source.incomplete) ?? [];
    const notes = sources.map(source => `<p class="cat-remote-note">${esc(source.label)}: ${t(source.status === 'unavailable' ? 'Unavailable' : source.status === 'pending' ? 'Syncing' : source.status === 'stale' ? 'Cached listing' : 'Incomplete listing')}</p>`).join('');
    const options = page?.facets.tags ?? [];
    const tags = new Map(options.map(value => [value.name, value.count])); if (tag && !tags.has(tag)) tags.set(tag, 0);
    const liveAllowed = !unsupportedQuery() && !!cat.query && cat.typeFilter === 'all' && !tag && !filters()?.taxonomyKind;
    return `<section class="cat-remote" data-shared-library aria-label="${t('Shared library')}" aria-busy="${loading}">
      <h2>${t('Shared library')}</h2>
      <p data-shared-query>${browser.mode === 'live' ? t('Search mode: live sources') : t('Search mode: indexed library')}${cat.query ? ` · ${esc(t('Search'))}: ${esc(cat.query)}` : ''}</p>
      ${browser.mode === 'indexed' ? `<p class="cat-remote-note">${t('Use the search bar to find names, descriptions, tags, organisation fields and saved text in the shared catalog.')}</p>` : ''}
      <div class="cat-remote-controls"><label>${t('Type')} <select class="field-input" data-shared-type>${['all', ...Object.keys(TYPE_FILTER_TYPES)].map(type => `<option value="${type}"${type === cat.typeFilter ? ' selected' : ''}>${t(({ all: 'All types', image: 'Images', vector: 'Vectors', motion: 'Motion', '3d': '3D', lut: 'LUTs', audio: 'Audio', text: 'Text and data', font: 'Fonts' } as Record<string, string>)[type]!)}</option>`).join('')}</select></label><label>${t('Tag')} <select class="field-input" data-shared-tag><option value="">${t('All tags')}</option>${[...tags].map(([name, count]) => `<option value="${esc(name)}"${name === tag ? ' selected' : ''}>${esc(name)} (${count})</option>`).join('')}</select></label>
      ${cat.query ? `<button type="button" class="btn btn--ghost" data-shared-action="clear-search">${t('Clear shared search')}</button>` : ''}
      <button type="button" class="btn btn--ghost" data-shared-action="refresh">${t('Refresh')}</button>
      <button type="button" class="btn btn--ghost" data-shared-action="live"${liveAllowed && !loading ? '' : ' disabled'} title="${t('Live search supports text and source only. Indexed browse supports exact filters.')}">${t('Search live sources')}</button>
      ${browser.mode === 'live' ? `<button type="button" class="btn" data-shared-action="refresh">${t('Indexed browse')}</button>` : ''}</div>
      <p role="${error ? 'alert' : 'status'}">${esc(status)}</p>${partial}${notes}<p class="cat-remote-note">${t('Shared assets are ordered by name. Previews do not establish original availability. File access is checked when opened.')}</p>
      ${page?.facets.truncated && Object.values(page.facets.truncated).some(Boolean) ? `<p class="cat-remote-note">${t('Only the most frequent filter values are listed.')}</p>` : ''}
      ${error ? `<button type="button" class="btn" data-shared-action="refresh">${t('Retry')}</button>` : ''}
      ${!loading && page ? `<div class="cat-grid">${assetListHead()}${browser.refs.filter(ref => !cat.hiddenSet.has(ref.id)).map(cat.thumbs.assetTile).join('')}</div>
      ${browser.refs.length === 0 ? `<p>${t(page.complete === true ? 'No indexed assets match these filters.' : 'No results are available in the current listing.')}</p>` : ''}
      <div class="cat-remote-controls" aria-label="${t('Shared asset pages')}"><button type="button" class="btn" data-shared-action="previous"${browser.index > 0 && browser.mode === 'indexed' ? '' : ' disabled'}>${t('Previous page')}</button><span>${t('Page {page}', { page: browser.index + 1 })}</span><button type="button" class="btn" data-shared-action="next"${page.nextCursor ? '' : ' disabled'}>${t('Next page')}</button></div>` : ''}
      ${browser.refs.some(ref => cat.selected.has(ref.id) && cat.assetById.get(ref.id)?.version !== ref.version) ? `<p class="cat-remote-note">${t('A selected asset has changed. Clear and select it again to use the latest listing.')}</p>` : ''}
      ${[...cat.selected].some(id => shared(cat.assetById.get(id)) && !browser.refs.some(ref => ref.id === id)) ? `<p class="cat-remote-note">${t('Your selection includes assets on other pages. Clear the selection before choosing a different batch.')}</p>` : ''}
    </section>`;
  };
  // Every paint of the section goes through here, so a later load knows what is on screen.
  const html = () => (painted = markup());
  const click = (event: Event) => {
    const action = (event.target as Element).closest<HTMLElement>('[data-shared-action]')?.dataset.sharedAction;
    if (action === 'clear-search') { event.preventDefault(); setSearchBarQuery(''); return; }
    if (action) { event.preventDefault(); void load(action === 'next' ? 'next' : action === 'previous' ? 'previous' : 'reset', action === 'live'); }
  };
  const change = (event: Event) => {
    const target = event.target as HTMLSelectElement;
    if (target.matches('[data-shared-type]')) {
      if (target.value === 'all' || Object.hasOwn(TYPE_FILTER_TYPES, target.value)) cat.typeFilter = target.value as typeof cat.typeFilter;
      updateRouteParams({ type: cat.typeFilter }); signature = ''; sync(); paint(); return;
    }
    if (!target.matches('[data-shared-tag]')) return;
    tag = target.value; updateRouteParams({ tag: tag || null }); signature = ''; sync(); paint();
  };
  const tree = (): AssetSourceNode[] => {
    const nodes = buildAssetSourceTree(cat.allAssets.filter(ref => !cat.hiddenSet.has(ref.id)), cat.sourceStatuses);
    if (!browser.supported) return nodes;
    const all = nodes.find(node => node.id === 'all'); if (all) delete all.count;
    for (const status of cat.sourceStatuses) {
      const root = nodes.find(node => node.id === sourceNodeId(status.id)); if (!root) continue;
      root.count = status.count;
      const facets = browser.page?.facets.taxonomy?.filter(node => node.source === status.id) ?? [];
      root.children = (['section', 'collection', 'folder'] as const).flatMap(kind => {
        const values = facets.filter(node => node.kind === kind);
        const byId = new Map(values.map(node => [node.id, { id: sourceNodeId(status.id, kind, node.id), label: node.name, count: node.count } as AssetSourceNode]));
        const children = values.filter(node => {
          const parent = node.parentId && byId.get(node.parentId), current = byId.get(node.id)!;
          if (!parent || parent === current) return true;
          const seen = new Set([node.id]); let ancestor: string | undefined = node.parentId;
          while (ancestor) { if (seen.has(ancestor)) return true; seen.add(ancestor); ancestor = values.find(value => value.id === ancestor)?.parentId; }
          parent.children ??= []; parent.children.push(current); return false;
        }).map(node => byId.get(node.id)!);
        return children.length ? [{ id: `${status.id}:${kind}:group`, label: kind === 'section' ? 'Sections' : kind === 'collection' ? 'Collections' : 'Folders', selectable: false, children }] : [];
      });
    }
    return nodes;
  };
  const restrictSources = (allowed: Set<string>) => {
    let changed = false;
    for (const [id, ref] of cat.assetById) if (typeof ref.meta?.provider === 'string' && !allowed.has(ref.meta.provider)) { cat.assetById.delete(id); cat.selected.delete(id); changed = true; }
    if (changed) { browser.refs = browser.refs.filter(ref => typeof ref.meta?.provider !== 'string' || allowed.has(ref.meta.provider)); browser.page = null; signature = ''; }
  };
  cat.viewEl.addEventListener('click', click); cat.viewEl.addEventListener('change', change);
  return { browser, sync, html, reconcile, shared, load, tree, restrictSources,
    dispose() { disposed = true; clearTimeout(timer); clearTimeout(pendingRefresh); browser.dispose(); cat.viewEl.removeEventListener('click', click); cat.viewEl.removeEventListener('change', change); },
  };
}
