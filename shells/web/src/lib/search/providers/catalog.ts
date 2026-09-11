// SPDX-License-Identifier: MPL-2.0
/**
 * The Catalogue spotlight provider (plans/99 section 2b) - brand assets + the user's
 * own uploads, searched over the SAME haystack the catalogue view builds
 * (views/catalog-filter.ts buildSearchHaystack - name, id, tags, category,
 * format/type), so the overlay and the view's live filter agree on recall.
 *
 * The asset set mirrors views/catalog.ts's reload: catalog assets (deprecated
 * included - the view lists them) plus user uploads minus the profile
 * headshot, filtered to what the catalogue actually TILES (visual types, the
 * user's own audio, and neurospicy focus audio) - a hit must land on a visible
 * tile, since the href is a #/c?q= scoped list keyed on the asset's name
 * (plans/99 section 5's locked target - never the per-asset details modal). Categories
 * come from the shared lib/asset-category rules WITHOUT the per-user override
 * layer (that would cost a profile read per search; overrides only reclassify
 * the subtitle/haystack category, never hide an asset).
 *
 * Loads per search call through the same short-lived cache as the projects
 * provider: one query() per 5s window, in-flight promise shared, failure drops
 * the cache and yields [] (registry contract: never throw).
 */

import type { AssetRef } from '@lolly-tools/core/host-v1';
import { t } from '../../../i18n.ts';
import { icon } from '../../icons.ts';
import { fold, scoreHaystack } from '../match.ts';
import { buildSearchHaystack } from '../../../views/catalog-filter.ts';
import { categoryLabel, libCategory } from '../../asset-category.ts';
import { VISUAL_TYPES } from '../../asset-kinds.ts';
import type { SearchHit, SearchProvider } from '../registry.ts';

/** Minimal structural host slice (repo convention - see SyncHost): the two
 *  asset reads views/catalog.ts's reload makes. Never the full HostV1. */
export interface CatalogSearchHost {
  assets: {
    query(filter?: unknown): Promise<AssetRef[]>;
    _listUserAssets?(): Promise<AssetRef[]>;
  };
}

// The user's profile headshot is a working asset, not library content - the
// catalogue view filters it out of its grid (views/catalog.ts reload) and so
// does this provider. The id is the bridge's fixed slot.
const HEADSHOT_ID = 'user/headshot';

/** What the catalogue view tiles (mirrors views/catalog.ts reload): visual
 *  types, plus the user's own audio and catalog focus-music (neurospicy). */
function listable(a: AssetRef): boolean {
  return VISUAL_TYPES.has(a.type)
    || (a.type === 'audio' && (a.source === 'user'
      || (Array.isArray(a.meta?.tags) && (a.meta.tags as string[]).includes('neurospicy'))));
}

const CACHE_TTL_MS = 5000;

interface Row { asset: AssetRef; category: string; haystack: string }

export function createCatalogProvider(host: CatalogSearchHost): SearchProvider {
  let cache: { promise: Promise<Row[]>; expires: number } | null = null;

  function load(): Promise<Row[]> {
    if (cache && Date.now() < cache.expires) return cache.promise;
    const promise = Promise.all([
      host.assets.query({ includeDeprecated: true }).catch(() => [] as AssetRef[]),
      host.assets._listUserAssets?.().catch(() => [] as AssetRef[]) ?? Promise.resolve([] as AssetRef[]),
    ]).then(([catalog, user]): Row[] => {
      const assets = [...catalog, ...user.filter((a) => a.id !== HEADSHOT_ID)].filter(listable);
      const categories = new Map(assets.map((a) => [a.id, libCategory(a)]));
      // The shared haystack builder (do NOT re-implement - plans/99 principle
      // 1). fold() the stored value before scoring: idempotent, so it is
      // correct whether catalog-filter has migrated to fold() internally yet.
      const haystack = buildSearchHaystack(assets, (a) => categoryLabel(categories.get(a.id) ?? 'other'));
      return assets.map((asset) => ({
        asset,
        category: categories.get(asset.id) ?? 'other',
        haystack: fold(haystack.get(asset.id) ?? ''),
      }));
    });
    const slot = { promise, expires: Number.POSITIVE_INFINITY };
    cache = slot;
    promise.then(
      () => { if (cache === slot) slot.expires = Date.now() + CACHE_TTL_MS; },
      () => { if (cache === slot) cache = null; },
    );
    return promise;
  }

  // The row glyph follows the asset's kind, so music reads as music (not a broken
  // image) and video as film - the catalogue tiles visual assets AND the user's
  // own/focus audio, so both must be legible. Built once; unknown types fall back
  // to the generic image glyph.
  const GLYPHS: Record<string, string> = {
    audio: icon('music'), video: icon('filmStrip'), font: icon('font'), image: icon('image'),
  };
  const glyphFor = (type: string): string => GLYPHS[type] ?? GLYPHS.image!;

  return {
    id: 'catalog',
    async search(tokens, limit): Promise<SearchHit[]> {
      const rows = await load();
      const scored: Array<{ row: Row; score: number }> = [];
      for (const row of rows) {
        const score = scoreHaystack([{ text: row.haystack, weight: 1 }], tokens);
        if (score > 0) scored.push({ row, score });
      }
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, Math.max(0, limit)).map(({ row, score }) => ({
        icon: glyphFor(String(row.asset.type)),
        title: String(row.asset.meta?.name ?? row.asset.id),
        // Category where it says something; the catch-all 'other' bucket reads
        // better as the concrete format.
        subtitle: row.category !== 'other'
          ? t(categoryLabel(row.category))
          : String(row.asset.format || row.asset.type),
        // The locked plans/99 section 5 target: catalogue hits land on the #/c?q=
        // SCOPED LIST (never the per-asset details modal, which #/c?asset=
        // would open - detail affordances vary by asset type). Scoping to the
        // asset's own name narrows the list to it and its likenames, so the
        // hit still lands somewhere obviously specific.
        href: `#/c?q=${encodeURIComponent(String(row.asset.meta?.name ?? row.asset.id))}`,
        score,
      }));
    },
  };
}
