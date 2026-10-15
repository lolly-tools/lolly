// SPDX-License-Identifier: MPL-2.0
/** Bounded Work catalog reads. Browse metadata never starts processing or fetches originals. */
import { instanceFetch, instancePath, getInstanceBase } from '../lib/instance.ts';
import { versionedTileUrl } from '../lib/asset-thumb-src.ts';
import { catalogMetadataRef, type AssetMetaRecord } from '../bridge/assets.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { readCatalogJson, absolutizeCatalogAsset, CatalogBrowseError } from './metadata.ts';
export { CatalogBrowseError } from './metadata.ts';
const asset = (value: unknown): value is AssetMetaRecord => !!value && typeof value === 'object'
  && typeof (value as AssetMetaRecord).id === 'string' && Array.isArray((value as AssetMetaRecord).formats);

export const ASSET_BROWSE_LIMIT = 100;
export interface BrowseFilters { q?: string; source?: string; types?: string; tag?: string; taxonomyKind?: string; taxonomyId?: string; scope?: string }
export interface BrowseSource { id: string; label: string; status: 'current' | 'stale' | 'unavailable' | 'pending'; count?: number; lastSyncedAt?: string; truncated?: boolean; incomplete?: boolean }
export interface BrowseFacets {
  sources: Array<{ id: string; label: string; count: number }>;
  sections: Array<{ name: string; count: number }>;
  collections: Array<{ name: string; count: number }>;
  tags: Array<{ name: string; count: number }>;
  types: Array<{ name: string; count: number }>;
  taxonomy?: Array<{ source: string; kind: string; id: string; name: string; count: number; parentId?: string }>;
  truncated?: Record<string, boolean>;
}
export interface AssetBrowsePage { capabilities?: { indexedFilters?: string[]; liveFilters?: string[] }; assets: AssetMetaRecord[]; total: number; nextCursor: string | null; facets: BrowseFacets; version: string; sources?: BrowseSource[]; complete?: boolean; countsScope?: string }
/** One current page plus cursor history; selected metadata is owned by the view separately. */
export class AssetBrowser {
  page: AssetBrowsePage | null = null;
  refs: AssetRef[] = [];
  loading = false;
  error: CatalogBrowseError | null = null;
  supported: boolean | null = null;
  filters: BrowseFilters = {};
  cursors: Array<string | null> = [null];
  index = 0;
  mode: 'indexed' | 'live' = 'indexed';
  private controller?: AbortController;
  private generation = 0;
  private request: typeof instanceFetch;
  constructor(request: typeof instanceFetch = instanceFetch) { this.request = request; }
  dispose(): void { this.generation++; this.controller?.abort(); this.loading = false; }
  async load(filters: BrowseFilters, direction: 'reset' | 'next' | 'previous' | 'retry' = 'reset', live = false): Promise<void> {
    const generation = ++this.generation, origin = getInstanceBase();
    this.controller?.abort(); this.controller = new AbortController();
    this.loading = true; this.error = null;
    let index = this.index;
    if (direction === 'reset') { index = 0; this.cursors = [null]; this.page = null; this.refs = []; }
    if (direction === 'next') { if (!this.page?.nextCursor) { this.loading = false; return; } index++; this.cursors[index] = this.page.nextCursor; }
    if (direction === 'previous') index = Math.max(0, index - 1);
    this.filters = { ...filters };
    const params = new URLSearchParams({ limit: String(ASSET_BROWSE_LIMIT) });
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    if (live) {
      if (filters.types || filters.tag || filters.taxonomyKind || !filters.q) { this.loading = false; this.error = new CatalogBrowseError('Live search requires text and supports only a source filter. Use indexed browse for exact filters.'); return; }
    } else if (this.cursors[index]) params.set('cursor', this.cursors[index]!);
    try {
      const response = await this.request(instancePath(`/api/v1/catalog/${live ? 'search' : 'assets'}?${params}`), { cache: 'no-store', signal: AbortSignal.any([this.controller.signal, AbortSignal.timeout(15_000)]) });
      const value = await readCatalogJson(response) as AssetBrowsePage & { results?: AssetMetaRecord[]; providersUnavailable?: string[] };
      const allowed = live ? value.capabilities?.liveFilters : value.capabilities?.indexedFilters;
      if (Object.entries(filters).some(([key, value]) => value && !allowed?.includes(key))) throw new CatalogBrowseError('This Work server does not support the requested shared filters. Update Work before using this browse mode.', 422);
      const entries = live ? value.results : value.assets;
      if (!Array.isArray(entries) || entries.length > ASSET_BROWSE_LIMIT || entries.some(entry => !asset(entry))
        || (!live && (!Number.isInteger(value.total) || value.total < entries.length || !(value.nextCursor === null || typeof value.nextCursor === 'string') || !value.facets))) throw new CatalogBrowseError('The server returned an invalid asset page.');
      if (generation !== this.generation || origin !== getInstanceBase()) return;
      this.supported = true; this.index = index; this.mode = live ? 'live' : 'indexed';
      const assets = entries.map(absolutizeCatalogAsset);
      this.page = live ? { assets, total: assets.length, nextCursor: null, facets: { sources: [], sections: [], collections: [], tags: [], types: [] }, version: '', complete: false,
        sources: value.providersUnavailable?.map(id => ({ id, label: id, status: 'unavailable' })) } : { ...value, assets };
      this.refs = assets.map(value => { const ref = catalogMetadataRef(value); return { ...ref, url: versionedTileUrl(ref.url, ref) }; });
    } catch (error) {
      if (generation !== this.generation || origin !== getInstanceBase()) return;
      this.error = error instanceof CatalogBrowseError ? error : new CatalogBrowseError('Shared assets are unavailable. Device assets are still available.');
      if (this.error.status === 404) this.supported = false;
      this.page = null; this.refs = [];
    } finally { if (generation === this.generation) this.loading = false; }
  }
}
