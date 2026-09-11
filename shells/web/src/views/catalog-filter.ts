// SPDX-License-Identifier: MPL-2.0
/**
 * The Catalogue view's selection model - pure, DOM-free, testable.
 *
 * Extracted from views/catalog.ts (3,563 lines, one 3,078-line `mountCatalog`)
 * for maintainability-2026-07-29.md item 2: 33 of 45 views have no test, and the
 * ones that DO are exactly the ones whose pure logic was pulled into a sibling
 * module (free-canvas-math.ts, timeline-math.ts, free-canvas-pen.ts). The audit's
 * point was that the technique needs no design debate, only application. This is
 * that, applied to the largest fully-untested view.
 *
 * WHY THIS CLUSTER FIRST. These six functions decide which assets a user can see,
 * search, favourite and bulk-select - and `pruneSelection` is what keeps the
 * "N selected" counter honest when a search hides something that is still ticked.
 * Getting that wrong deletes the wrong files, or reports a count that does not
 * match what a delete will actually touch. It is the highest-consequence pure
 * logic in the file and it had no coverage at all.
 *
 * Everything here takes its state as arguments rather than closing over
 * mountCatalog's locals. That is the whole extraction: the view still owns the
 * mutable state, this module owns the rules.
 */

import type { AssetRef } from '@lolly-tools/core/host-v1';
import { fold, tokenize, scoreHaystack } from '../lib/search/match.ts';

/** The sticky filetype-filter buckets. 'all' admits everything. */
export type TypeFilter = 'all' | 'image' | 'vector' | 'motion' | '3d' | 'lut' | 'audio' | 'text';

/** Which asset `type` values each bucket admits. */
export const TYPE_FILTER_TYPES: Record<Exclude<TypeFilter, 'all'>, ReadonlySet<string>> = {
  image: new Set(['raster']),
  vector: new Set(['vector']),
  motion: new Set(['video', 'lottie']),
  '3d': new Set(['model']),
  lut: new Set(['lut']),
  audio: new Set(['audio']),
  text: new Set(['text', 'data']),
};

/** Filetype-filter predicate. */
export function matchesType(asset: AssetRef, filter: TypeFilter): boolean {
  return filter === 'all' || (TYPE_FILTER_TYPES[filter]?.has(asset.type as string) ?? false);
}

/**
 * Assets the user has not hidden. Hidden-ness is keyed by BASE id, so hiding an
 * asset hides every modified variant of it (`<id>?theme=…`, `<id>?treatment=…`)
 * rather than leaving orphans behind - which is why the caller passes a
 * base-id-extracting function rather than this module guessing at the format.
 */
export function visibleAssets(
  assets: readonly AssetRef[],
  hidden: ReadonlySet<string>,
  baseId: (id: string) => string,
): AssetRef[] {
  return assets.filter((a) => !hidden.has(baseId(a.id)));
}

/**
 * The search index: asset id → one FOLDED haystack string (lib/search fold - 
 * lowercase + diacritics stripped, so "café" and "cafe" index identically).
 * Built once and reused across keystrokes (the view memoises it and drops it
 * when the asset list changes), because rebuilding per keystroke is O(assets)
 * per character.
 *
 * `categoryOf` is injected so this module needs neither the category registry nor
 * the user's overrides - it is the only part of the haystack that is not intrinsic
 * to the asset.
 */
export function buildSearchHaystack(
  assets: readonly AssetRef[],
  categoryOf: (asset: AssetRef) => string,
): Map<string, string> {
  const index = new Map<string, string>();
  for (const a of assets) {
    const tags = ((a.meta?.tags as string[] | undefined) ?? []).join(' ');
    // A photo's own embedded keywords, captured at ingest (plans/144 Wave 5:
    // find your photos by what THEY say they are, not just what you named them).
    const prov = a.meta?.provenance as { metaDigest?: { keywords?: string } } | undefined;
    const keywords = prov?.metaDigest?.keywords ?? '';
    index.set(
      a.id,
      fold(`${String(a.meta?.name ?? '')} ${a.id} ${tags} ${keywords} ${categoryOf(a)} ${a.format ?? a.type}`),
    );
  }
  return index;
}

// ── Structured query prefixes (plans/132 WP-C item 3) ────────────────────────
// `tag:x` / `type:x` / `is:genai` / `is:upload` narrow structurally; everything
// else stays a folded text token (the AND-across-terms default path). A prefix
// with no value (`tag:`) is kept as text so half-typed prefixes never blank the
// grid mid-keystroke.
export interface ParsedCatQuery {
  /** Plain text tokens (folded), matched against the haystack as before. */
  text: string[];
  /** `tag:` values (folded) - each must prefix-match one of the asset's tags. */
  tags: string[];
  /** `type:` values - a TypeFilter bucket name or a raw format/type string. */
  types: string[];
  /** `is:` values - 'genai' (declared AI origins) and 'upload' are recognised;
   *  anything else matches nothing (a typo narrows to empty, honestly). */
  flags: string[];
}

export function parseCatQuery(query: string): ParsedCatQuery {
  const out: ParsedCatQuery = { text: [], tags: [], types: [], flags: [] };
  for (const raw of query.split(/\s+/)) {
    if (!raw) continue;
    const m = /^(tag|type|is):(.+)$/i.exec(raw);
    if (m) {
      const value = fold(m[2]!);
      const key = m[1]!.toLowerCase();
      if (key === 'tag') out.tags.push(value);
      else if (key === 'type') out.types.push(value);
      else out.flags.push(value);
    } else {
      out.text.push(...tokenize(raw));
    }
  }
  return out;
}

// matchesQuery runs once per asset per keystroke over one unchanging query, so
// the parse (fold + split + prefix carve) is memoised on the last query seen
// rather than recomputed per asset.
let lastQuery = '';
let lastParsed: ParsedCatQuery = { text: [], tags: [], types: [], flags: [] };
function parsedQuery(query: string): ParsedCatQuery {
  if (query !== lastQuery) {
    lastQuery = query;
    lastParsed = parseCatQuery(query);
  }
  return lastParsed;
}

/** The asset's tags, folded once per call site (small lists; no memo needed). */
function foldedTags(asset: AssetRef): string[] {
  return ((asset.meta?.tags as string[] | undefined) ?? []).map((t) => fold(String(t)));
}

/** Does the asset satisfy every STRUCTURED term of a parsed query? */
function matchesStructured(asset: AssetRef, q: ParsedCatQuery): boolean {
  for (const tag of q.tags) {
    if (!foldedTags(asset).some((t) => t.startsWith(tag))) return false;
  }
  for (const ty of q.types) {
    const bucket = TYPE_FILTER_TYPES[ty as Exclude<TypeFilter, 'all'>];
    const own = fold(String(asset.format ?? asset.type ?? ''));
    const kind = fold(String(asset.type ?? ''));
    if (!(bucket ? bucket.has(String(asset.type)) : (own === ty || kind === ty))) return false;
  }
  for (const flag of q.flags) {
    if (flag === 'genai') {
      const ai = asset.meta?.aiGenerated;
      if (ai !== 'full' && ai !== 'partial') return false;
    } else if (flag === 'upload') {
      if (asset.source !== 'user') return false;
    } else return false;
  }
  return true;
}

/**
 * While a search is active: the first thing that matched OUTSIDE the name -
 * a tag, or the category - so a tile can show WHY it is in the result set
 * (plans/132 WP-C item 4). Null when the name itself carries the match (no
 * chip needed) or nothing structured matched.
 */
export function matchContext(
  asset: AssetRef,
  query: string,
  categoryOf: (asset: AssetRef) => string,
): string | null {
  if (!query) return null;
  const q = parsedQuery(query);
  const rawTags = (asset.meta?.tags as string[] | undefined) ?? [];
  for (const t of q.tags) {
    const hit = rawTags.find((raw) => fold(String(raw)).startsWith(t));
    if (hit) return String(hit);
  }
  const name = fold(String(asset.meta?.name ?? asset.id));
  for (const token of q.text) {
    if (name.includes(token)) continue;
    const hit = rawTags.find((raw) => fold(String(raw)).includes(token));
    if (hit) return String(hit);
    const cat = categoryOf(asset);
    if (fold(cat).includes(token)) return cat;
  }
  return null;
}

/**
 * Search predicate - lib/search semantics (plans/99 M3, principle 1): the query
 * is folded + tokenized, and every token must appear in the asset's haystack
 * (AND across terms, so "logo dark" narrows rather than widens; word order is
 * free). An empty query passes everything - the search box is a filter, not a
 * mode, so clearing it must restore the full list.
 *
 * `query` may arrive lowercased and trimmed by the caller (the view still does,
 * harmlessly - fold is idempotent); an asset the index has never seen simply
 * does not match, rather than throwing.
 */
export function matchesQuery(
  asset: AssetRef,
  query: string,
  haystack: ReadonlyMap<string, string>,
): boolean {
  if (!query) return true;
  const q = parsedQuery(query);
  if (!matchesStructured(asset, q)) return false;
  if (!q.text.length) return true;
  const text = haystack.get(asset.id);
  if (text === undefined) return false;
  return scoreHaystack([{ text, weight: 1 }], q.text) > 0;
}

/**
 * Favourited, visible assets - deduped by base id, in catalog-then-user order.
 *
 * The dedupe matters: a user upload can shadow a catalog asset at the same base
 * id, and without this the favourites strip shows the same mark twice. Input
 * order carries the precedence (the view passes catalog assets first), so the
 * FIRST occurrence wins and later duplicates are dropped.
 */
export function favItems(
  visible: readonly AssetRef[],
  favourites: ReadonlySet<string>,
  baseId: (id: string) => string,
): AssetRef[] {
  const seen = new Set<string>();
  const out: AssetRef[] = [];
  for (const a of visible) {
    const b = baseId(a.id);
    if (favourites.has(b) && !seen.has(b)) { seen.add(b); out.push(a); }
  }
  return out;
}

/**
 * The ids a selection may hold: visible, matching the current search AND the
 * current filetype filter. The search and the filter both belong here for the
 * same reason: a bulk action must only ever touch what the user can actually
 * SEE. Anything else acts invisibly.
 *
 * `scope` - 'uploads' restricts to user-owned assets; 'all' admits shared
 * catalog assets too (2026-08-09: every tile is selectable now - people expect
 * a grid to marquee - and the DESTRUCTIVE actions gate per-kind instead:
 * Duplicate/Download/Delete only light up when the whole selection is uploads,
 * since catalog assets are a permanent contract that can only be favourited or
 * hidden). The uploads section's own "Select all" button stays 'uploads'.
 */
export function selectableIds(
  visible: readonly AssetRef[],
  opts: {
    query: string;
    haystack: ReadonlyMap<string, string>;
    typeFilter: TypeFilter;
    scope?: 'uploads' | 'all';
  },
): Set<string> {
  const out = new Set<string>();
  for (const a of visible) {
    if ((opts.scope ?? 'uploads') === 'uploads' && a.source !== 'user') continue;
    if (!matchesQuery(a, opts.query, opts.haystack)) continue;
    if (!matchesType(a, opts.typeFilter)) continue;
    out.add(a.id);
  }
  return out;
}

/**
 * Drop selected ids that are no longer selectable - deleted, or filtered out by a
 * search - so the "N selected" count matches what an action would actually touch.
 * Mutates `selected` in place (the view holds it across renders) and returns the
 * number removed, so a caller can tell whether anything changed without diffing.
 */
export function pruneSelection(selected: Set<string>, selectable: ReadonlySet<string>): number {
  if (!selected.size) return 0;
  let dropped = 0;
  for (const id of [...selected]) {
    if (!selectable.has(id)) { selected.delete(id); dropped++; }
  }
  return dropped;
}

// ── Sort + dates (plans/132 WP-A) ────────────────────────────────────────────

export type CatSort = 'default' | 'name' | 'added' | 'modified' | 'size' | 'type';

/**
 * When an asset was added. Uploads embed their mint time in the id
 * (`user/<kind>/<Date.now()>-…`), so every existing upload has a date with no
 * migration; a stored `meta.addedAt` (future writers) wins. Catalog assets
 * have no date - null, and they keep their curated order under a date sort
 * (Array.sort is stable).
 */
export function assetAddedAt(ref: Pick<AssetRef, 'id' | 'meta'>): number | null {
  const meta = Number(ref.meta?.addedAt);
  if (Number.isFinite(meta) && meta > 0) return meta;
  const m = /^user\/[^/]+\/(\d{12,})(?:-|$)/.exec(ref.id);
  return m ? Number(m[1]) : null;
}

/** Last content modification: `meta.modifiedAt` (stamped by the bridge on every
 *  record write - replace/trim/etc.), falling back to the added time. */
export function assetModifiedAt(ref: Pick<AssetRef, 'id' | 'meta'>): number | null {
  const meta = Number(ref.meta?.modifiedAt);
  if (Number.isFinite(meta) && meta > 0) return meta;
  return assetAddedAt(ref);
}

/**
 * Sort a section's assets. 'default' preserves the curated manifest order
 * (uploads: newest-first from the bridge). Date sorts are newest-first with
 * dateless (catalog) assets keeping their relative order after the dated ones;
 * name/type are A→Z; size is largest-first.
 */
export function sortAssets(list: readonly AssetRef[], sortBy: CatSort): AssetRef[] {
  if (sortBy === 'default') return [...list];
  const arr = [...list];
  const name = (a: AssetRef): string => String(a.meta?.name ?? a.id).toLowerCase();
  switch (sortBy) {
    case 'name': arr.sort((a, b) => name(a).localeCompare(name(b))); break;
    case 'added': arr.sort((a, b) => (assetAddedAt(b) ?? -1) - (assetAddedAt(a) ?? -1)); break;
    case 'modified': arr.sort((a, b) => (assetModifiedAt(b) ?? -1) - (assetModifiedAt(a) ?? -1)); break;
    case 'size': arr.sort((a, b) => (Number(b.meta?.bytes) || 0) - (Number(a.meta?.bytes) || 0)); break;
    case 'type': arr.sort((a, b) => String(a.format ?? a.type).localeCompare(String(b.format ?? b.type))); break;
  }
  return arr;
}
