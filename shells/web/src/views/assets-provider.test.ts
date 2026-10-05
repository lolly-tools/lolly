// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { providerBrowserHtml, providerFacets, providerGroups } from './assets-provider.ts';
import { buildSearchHaystack, matchesQuery, parseCatQuery, withCatalogFacet } from './assets-filter.ts';

const asset = (id: string, meta: Record<string, unknown> = {}): AssetRef => ({ source: 'library', id, type: 'raster', format: 'png', url: '', meta });
const logo = asset('ext/suse/logo', { provider: 'suse', providerLabel: 'SUSE Resource Library', providerSections: ['Standard Logos'], providerCollections: ['Logo Kit'], providerTags: ['SUSE Virtualization', 'SUSE Virtualization'], tags: ['provider:suse', 'Standard Logos', 'SUSE Virtualization'], name: 'Primary mark' });
const video = asset('ext/suse/video', { provider: 'suse', providerLabel: 'SUSE Resource Library', providerSections: ['Videos'], providerCollections: ['Media Kit'], providerTags: ['SUSE AI'], tags: ['SUSE AI'] });

test('provider groups keep primary categories distinct and each asset appears once', () => {
  const other = asset('other', { provider: 'other', providerLabel: 'Other library', providerSections: ['Standard Logos', 'Extra'] });
  const groups = providerGroups([logo, video, other, asset('pack-logo')]);
  assert.equal(groups.length, 3);
  assert.equal(new Set(groups.flatMap(group => group.items.map(item => item.id))).size, 3);
  assert.deepEqual(groups.find(group => group.source === 'Other library')?.items.map(item => item.id), ['other']);
  assert.equal(providerGroups([logo])[0]?.key, 'provider/suse/Standard%20Logos');
});

test('facet counts deduplicate tags and ignore uploads, pack assets and internal tags', () => {
  const facets = providerFacets([logo, video, asset('user/image', { tags: ['private'] })]);
  assert.deepEqual(facets.tag, [{ name: 'SUSE AI', count: 1 }, { name: 'SUSE Virtualization', count: 1 }]);
  assert.deepEqual(facets.source, [{ name: 'SUSE Resource Library', count: 2 }]);
  assert.deepEqual(facets.collection.map(option => option.name), ['Logo Kit', 'Media Kit']);
});

test('quoted facets combine with text and type filters and survive editing another facet', () => {
  let query = withCatalogFacet('primary type:image', 'category', 'Standard Logos');
  query = withCatalogFacet(query, 'collection', 'Logo Kit');
  query = withCatalogFacet(query, 'tag', 'SUSE Virtualization');
  query = withCatalogFacet(query, 'source', 'SUSE Resource Library');
  const haystack = buildSearchHaystack([logo, video], () => 'Images');
  assert.equal(matchesQuery(logo, query, haystack), true);
  assert.equal(matchesQuery(video, query, haystack), false);
  assert.deepEqual(parseCatQuery(query).tags, ['suse virtualization']);
  assert.equal(matchesQuery(logo, withCatalogFacet(query, 'category', 'Videos'), haystack), false);
  assert.deepEqual(parseCatQuery(withCatalogFacet(query, 'tag', '')).text, ['primary']);
});

test('names containing quotes and backslashes round trip without becoming text terms', () => {
  const name = 'Campaign "A" \\ EU';
  const query = withCatalogFacet('type:image', 'tag', name);
  const parsed = parseCatQuery(query);
  assert.deepEqual(parsed.tags, [name.toLowerCase()]);
  assert.deepEqual(parsed.text, []);
});

test('plain search includes collections and categories and tolerates missing metadata', () => {
  const haystack = buildSearchHaystack([logo, video, asset('bare')], () => 'Images');
  assert.equal(matchesQuery(logo, 'logo kit', haystack), true);
  assert.equal(matchesQuery(logo, 'standard logos', haystack), true);
  assert.equal(matchesQuery(video, 'logo kit', haystack), false);
  assert.equal(matchesQuery(asset('bare'), 'category:Videos', haystack), false);
});

test('browser markup escapes provider names and offers all tags, with no panel for pack-only libraries', () => {
  const unsafe = asset('unsafe', { provider: 'x', providerLabel: '<script>bad</script>', providerSections: ['" onfocus="bad'], providerTags: ['<img src=x>'] });
  const html = providerBrowserHtml([unsafe, logo], 'tag:"SUSE Virtualization"');
  assert.ok(!html.includes('<script>') && !html.includes('<img src=x>'));
  assert.ok(html.includes('data-provider-facet="category"'));
  assert.ok(html.includes('data-provider-facet="tag"'));
  assert.ok(html.includes('aria-pressed="true"'));
  assert.equal(providerBrowserHtml([asset('pack')], ''), '');
});
