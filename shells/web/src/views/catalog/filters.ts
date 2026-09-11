// SPDX-License-Identifier: MPL-2.0
/**
 * catalog: filtering and search, the uploads and assets sections, the swatch strip.
 *
 * Every function takes the shared `cat: CatCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `cat.<module>.<fn>`. Extracted verbatim
 * from mountCatalog() by scripts/split-closure.ts.
 */
import { escape as escapeText } from '../../utils.ts';
import { buildSearchHaystack, favItems as favItemsRule, matchesQuery as matchesQueryRule, matchesType as matchesTypeRule, sortAssets, visibleAssets as visibleAssetsRule } from '../catalog-filter.ts';
import type { TypeFilter } from '../catalog-filter.ts';
import { t } from '../../i18n.ts';
import { LIB_GROUPS, categoryLabel, libCategory } from '../../lib/asset-category.ts';
import { assetBaseId } from '../../lib/asset-favourites.ts';
import { icon } from '../../lib/icons.ts';
import { isModuleFormat } from '../../lib/mod-render.ts';
import { isTransparent } from '../../lib/swatches.ts';
import { hexToOklch, parseHex } from '../../../../../engine/src/brand-derive.ts';
import { rgbToCmyk } from '../../../../../engine/src/color.ts';
import { categoryGlyph } from '../../lib/category-icons.ts';
import type { PaletteEntry } from '../../palette.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { CAT_ICONS, CHEVRON, TYPE_FILTERS, isThemable } from './shared.ts';
import { bindOp, type CatCtx } from './context.ts';

// The rules below live in ./catalog-filter.ts - pure, DOM-free and unit-tested
// (catalog-filter.test.ts). This view keeps the mutable state; the module owns
// the logic. These wrappers just bind the current state to it, so every call
// site in mountCatalog reads exactly as it did before the extraction.
export const visibleAssets = (cat: CatCtx): AssetRef[] => visibleAssetsRule(cat.allAssets, cat.hiddenSet, assetBaseId);
export const matchesType = (cat: CatCtx, a: AssetRef): boolean => matchesTypeRule(a, cat.typeFilter);
export const playableHere = (cat: CatCtx, a: AssetRef): boolean => cat.modulesPlayable !== false || !isModuleFormat(a.format);
// The search index, memoised across keystrokes and dropped whenever the asset
// set or the category overrides change (see setOverrides and the reload path).
// Built on FIRST SEARCH, never merely on render - indexing every asset for a
// user who never types in the box would be pure waste.
export function haystack(cat: CatCtx): ReadonlyMap<string, string> {
  if (!cat.searchHaystack) {
    cat.searchHaystack = buildSearchHaystack(cat.allAssets, x => categoryLabel(libCategory(x, cat.overrides)));
  }
  return cat.searchHaystack;
}
export const matchesQuery = (cat: CatCtx, a: AssetRef): boolean =>
  !cat.query || matchesQueryRule(a, cat.query, haystack(cat));
export const favItems = (cat: CatCtx): AssetRef[] => favItemsRule(visibleAssets(cat), cat.favSet, assetBaseId);
// Favourite SWATCHES ride the same favourites set under a `swatch:` prefix (a palette
// entry has no asset id; its stable key is its label). Prefixed keys never match an
// asset id, so every asset-only consumer of the set ignores them.
export const swatchFavKey = (_cat: CatCtx, label: string): string => `swatch:${label}`;
export const favSwatches = (cat: CatCtx): PaletteEntry[] => cat.palette.filter(c => cat.favSet.has(swatchFavKey(cat, c.label)));
// The "Your uploads" section - a standard `.cat-group` that is ALWAYS rendered in the
// browse view (even with zero uploads): its body leads with a drop area, so adding files
// to the library is a first-class affordance in the grid itself, not just inside the picker.
// The "Select all / Deselect all" control lives INSIDE the collapsible body (not the
// header) so it folds away with the grid when the section is collapsed - a bulk-select
// toggle over a hidden grid just reads as confusing (and it's dropped entirely at 0 items).
export function uploadsSectionHtml(cat: CatCtx, items: AssetRef[]): string {
  const { collapsed, host, selected } = cat;
  const key = 'your-uploads';
  const isCollapsed = collapsed.has(key) && !cat.query;
  const allSel = items.length > 0 && items.every(a => selected.has(a.id));
  // Your own raster uploads get the same photo-treatment strip the library photo
  // groups do - pick a greyscale/duotone wash and the whole uploads grid recolours
  // in place (retreatGroup keys off tile type, not source, so it just works).
  const treatable = cat.photoTreatments.length > 0 && items.some(a => a.type === 'raster');
  const colourRow = treatable
    ? `<div class="cat-dl-section cat-group-colours"><span class="cat-dl-label">${t('Colour')}</span>${cat.thumbs.treatmentSwatchRow(cat.catPhotoTreatment)}</div>`
    : '';
  // Drag files in or click to browse - the shared upload dropzone component
  // (lib/upload-dropzone.ts, extracted from this view so #/start can mount it too)
  // renders into this placeholder after every body paint: the innerHTML rebuilds
  // destroy the previous instance, so mountDropzone() re-mounts it (called from
  // render()/renderBody()). data-empty grows the zone into the roomier column
  // layout when it IS the section (no uploads yet).
  const dropzone = `<div data-dropzone-mount${items.length ? '' : ' data-empty'}></div>`;
  // The authoring row beside the drop area. "Script audio" (type a script,
  // generate speech on-device via the optional host.speech bridge, v1.96) is
  // feature-detected - absent bridge, absent button. "Paste text" (type or
  // paste text/Markdown, stored as a first-class text asset through the same
  // ingest path a dropped .md takes) needs no bridge, so it always renders.
  const scriptAudio = `<div class="cat-uploads-tts">${host.speech?.isAvailable()
      ? `<button type="button" class="btn" data-script-audio>${icon('mic', { size: 14 })} ${t('Script audio')}</button>` : ''
    }<button type="button" class="btn" data-paste-text>${icon('filePlus', { size: 14 })} ${t('Paste text')}</button></div>`;
  return `<section class="cat-group cat-group--uploads${isCollapsed ? ' is-collapsed' : ''}" data-group="${key}">
      <button type="button" class="cat-group-head" data-cat-toggle="${key}" aria-expanded="${!isCollapsed}">
        <span class="cat-group-chevron">${CHEVRON}</span>
        <span class="cat-group-icon">${categoryGlyph('uploads')}</span>
        <span class="cat-group-title">${t('Your uploads')}</span>
        <span class="cat-group-count">${items.length}</span>
      </button>
      <div class="cat-group-body">
        ${dropzone}
        ${scriptAudio}
        ${items.length ? `<div class="cat-uploads-bar"><button type="button" class="cat-uploads-selectall" data-selectall aria-pressed="${allSel}">${allSel ? t('Deselect all') : t('Select all')}</button><span class="cat-storage-chip" data-storage-chip hidden></span></div>` : ''}
        ${colourRow}
        ${items.length ? `<div class="cat-grid">${items.map(cat.thumbs.assetTile).join('')}</div>` : ''}
      </div>
    </section>`;
}
export function assetsSectionHtml(cat: CatCtx): string {
  const { collapsed } = cat;
  const hiddenItems = cat.allAssets.filter(a => cat.hiddenSet.has(assetBaseId(a.id)));
  // A delete can empty the active filter's bucket - its toolbar button would vanish
  // (shownFilters below only offers non-empty buckets) while the filter kept hiding
  // every asset with no visible control explaining why. Fall back to All instead.
  if (cat.typeFilter !== 'all' && !cat.allAssets.some(a => matchesTypeRule(a, cat.typeFilter))) cat.typeFilter = 'all';
  // Filter by search first; the count + category buckets both read the matched set.
  const visible = visibleAssets(cat).filter(cat.filters.matchesQuery).filter(cat.filters.matchesType).filter(cat.filters.playableHere);

  // A total sync failure (nothing loaded) reads distinctly from a genuinely empty
  // catalogue - a "couldn't load" message with a Retry that re-runs the load (wired in
  // wire()). Uploads loading while the catalog query failed fall through to the grid.
  if (cat.loadFailed && cat.allAssets.length === 0) {
    return `<div class="cat-empty" role="alert">
        <p>${t("Couldn't load the catalogue. Check your connection, then retry.")}</p>
        <button type="button" class="btn cat-retry" style="margin-top:1rem">${t('Retry')}</button>
      </div>`;
  }

  if (cat.allAssets.length === 0) {
    // A genuinely empty library still leads with the uploads section - its drop area
    // is exactly what a brand-new profile needs first.
    return uploadsSectionHtml(cat, []) + `<p class="cat-empty" role="status">${t("No catalogue assets found. Once the catalogue syncs they'll appear here - or drop your own images in above.")}</p>`;
  }

  // Favourites are presented as a cinematic strip (mounted after render, see
  // mountFavStrip) - a placeholder goes here when the strip is enabled and non-empty.
  // Favourited items still appear in their category group below (the strip is a
  // shortcut, matching the picker's favourites-plus-groups behaviour). Hidden while
  // searching so the results grid is the whole focus.
  const showStrip = cat.favStripOn && !cat.query && (favItems(cat).length > 0 || favSwatches(cat).length > 0);

  // The user's OWN uploads lead the grid (right after the favourites strip): pulled out
  // of the category groups into one "Your uploads" section they manage in one place.
  // Catalog assets keep their category bucketing below.
  const userItems = sortAssets(visible.filter(a => a.source === 'user'), cat.catSort);
  const catalogItems = visible.filter(a => a.source !== 'user');

  // Bucket the catalog assets by (override-aware) category, in LIB_GROUPS order.
  const buckets = new Map<string, AssetRef[]>();
  for (const a of catalogItems) {
    const k = libCategory(a, cat.overrides);
    (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(a);
  }

  const parts: string[] = [];
  // Always present while browsing (the drop area is its point, even at 0 uploads);
  // during a search it only appears when it holds matching tiles, so the results
  // grid stays the whole focus.
  const showUploads = userItems.length > 0 || !cat.query;
  if (showUploads) parts.push(uploadsSectionHtml(cat, userItems));
  for (const g of LIB_GROUPS) {
    const items = buckets.get(g.key) && sortAssets(buckets.get(g.key)!, cat.catSort);
    if (!items?.length) continue;
    // A category of themable icons gets the same colour swatches as the download/details
    // views - pick one and the whole grid recolours (see the .cat-dl-theme handler in wire).
    // A raster/bitmap category (photos, campaign, headshots) instead gets a photo-treatment
    // strip - the bitmap sibling - that washes the whole grid in place. Mutually exclusive.
    const themableGroup = cat.iconThemes.length > 0 && items.some(isThemable);
    const treatableGroup = !themableGroup && cat.photoTreatments.length > 0 && items.some(a => a.type === 'raster');
    const colourRow = themableGroup
      ? `<div class="cat-dl-section cat-group-colours"><span class="cat-dl-label">${t('Colours')}</span>${cat.thumbs.iconSwatchRow(cat.catIconTheme)}</div>`
      : treatableGroup
        ? `<div class="cat-dl-section cat-group-colours"><span class="cat-dl-label">${t('Colour')}</span>${cat.thumbs.treatmentSwatchRow(cat.catPhotoTreatment)}</div>`
        : '';
    parts.push(cat.tiles.groupSection(g.key, g.label, items.length, colourRow + `<div class="cat-grid">${items.map(cat.thumbs.assetTile).join('')}</div>`));
  }
  // Hidden assets never match a search (they're not in `visible`); keep them under a
  // dedicated group only in the normal (non-search) view.
  if (cat.showHidden && !cat.query && hiddenItems.length) {
    parts.push(cat.tiles.sectionHtml('hidden', 'Hidden', hiddenItems.length, sortAssets(hiddenItems, cat.catSort).map(cat.thumbs.assetTile).join('')));
  }

  // No asset matched the active filters → a clear empty line instead of a bare toolbar.
  // Guarded on the search AND the type filter, so choosing a filter (e.g. Motion) that
  // matches nothing explains the empty grid rather than showing a bare "0 assets".
  // Keyed off the matched-asset count, not parts.length: the always-there uploads
  // section (drop area) doesn't count as a match.
  if (!visible.length && (cat.query || cat.typeFilter !== 'all')) {
    const typeLabel = cat.typeFilter === 'all' ? '' : t((TYPE_FILTERS.find(f => f.key === cat.typeFilter)?.label ?? '')).toLowerCase();
    const msg = cat.query && typeLabel
      ? t('No {type} assets match “{query}”.', { type: typeLabel, query: cat.query })
      : cat.query
        ? t('No assets match “{query}”.', { query: cat.query })
        : t('No {type} assets in the catalogue.', { type: typeLabel });
    // A "clear search" button when a query is active (mirrors projects.ts) - routed to
    // the shell bar's clearSearchBar() via the body's delegated [data-search-clear] handler in wire().
    const clearBtn = cat.query ? ` <button type="button" class="projects-linkbtn" data-search-clear>${t('Clear search')}</button>` : '';
    parts.push(`<p class="cat-empty" role="status">${msg}${clearBtn}</p>`);
  }

  // Label the Collapse/Expand-all toggle for the state it will actually be in: with folds
  // now defaulting to closed, "Expand all" is the honest first-load label. Mirror the set
  // of sections the body will render (asset groups here + Swatches/Fonts from bodyHtml).
  const renderedKeys = [
    ...(showUploads ? ['your-uploads'] : []),
    ...LIB_GROUPS.filter(g => buckets.get(g.key)?.length).map(g => g.key),
    ...(cat.showHidden && hiddenItems.length ? ['hidden'] : []),
    'swatches', 'fonts',
  ];
  const anyExpanded = renderedKeys.some(k => !collapsed.has(k));
  // The toolbar is a floating pill that sticks to the top as you scroll past the header,
  // so the filetype filter + Expand/Collapse-all + Hide-hidden are always reachable. The
  // filter (image/vector/motion) stays available even during a search, so you can narrow
  // results by type; the collapse + hide-hidden toggles are section-management, so they're
  // dropped while searching (there are no folds to manage in a flat results grid).
  // Only offer a bucket the catalogue actually has assets for - e.g. a brand with no
  // video/Lottie/audio assets never sees an always-empty Motion or Audio button.
  const shownFilters = TYPE_FILTERS.filter(f => f.key === 'all' || cat.allAssets.some(a => matchesTypeRule(a, f.key as TypeFilter)));
  const filterSeg = `
      <div class="cat-typefilter" role="group" aria-label="${escapeText(t('Filter by file type'))}">
        ${shownFilters.map(f => `<button type="button" class="cat-typefilter-opt${cat.typeFilter === f.key ? ' is-on' : ''}" data-typefilter="${f.key}"${f.sfx ? ` data-sfx="${f.sfx}"` : ''} data-voice="${escapeText(t(f.label))}" aria-pressed="${cat.typeFilter === f.key}" aria-label="${escapeText(t(f.label))}" title="${escapeText(t(f.label))}">${f.icon}<span class="cat-btn-label">${t(f.label)}</span></button>`).join('')}
      </div>`;
  const collapseLabel = anyExpanded ? t('Collapse all') : t('Expand all');
  const showHiddenLabel = cat.showHidden ? t('Hide hidden') : t('Show hidden ({n})', { n: hiddenItems.length });
  // Reserve the counter's width for the widest string it can ever show, so switching filters
  // (which only ever shrink the number) never re-widths the centred toolbar pill and shifts the
  // filter buttons. Floor the digit count at 4 - a few thousand assets - so the reservation
  // doesn't track the current total and a low filtered number can't narrow it; size the suffix
  // for the mode (" assets" normally, " assets found" while searching, where the trailing
  // buttons drop but the type pills still centre off this width). +1ch of slack keeps min-width
  // clear of the text so the span is a true fixed width, not sitting on the content boundary.
  const countCh = Math.max(String(visibleAssets(cat).length).length, 4) + (cat.query ? 14 : 8);
  const toolbar = `
      <div class="cat-toolbar">
        ${filterSeg}
        <span class="cat-count" style="min-width:${countCh}ch">${cat.query
          ? (visible.length === 1 ? t('1 asset found') : t('{n} assets found', { n: visible.length }))
          : (visible.length === 1 ? t('1 asset') : t('{n} assets', { n: visible.length }))}</span>
        ${cat.query ? '' : `<button type="button" class="cat-showhidden cat-collapse-all" aria-label="${escapeText(collapseLabel)}" title="${escapeText(collapseLabel)}">${anyExpanded ? CAT_ICONS.collapse : CAT_ICONS.expand}<span class="cat-btn-label">${collapseLabel}</span></button>`}
        ${hiddenItems.length && !cat.query ? `<button type="button" class="cat-showhidden${cat.showHidden ? ' is-on' : ''}" aria-pressed="${cat.showHidden}" aria-label="${escapeText(showHiddenLabel)}" title="${escapeText(showHiddenLabel)}">${cat.showHidden ? CAT_ICONS.eyeOff : CAT_ICONS.eye}<span class="cat-btn-label">${showHiddenLabel}</span></button>` : ''}
      </div>`;
  return `
      <section class="cat-assets">
        ${showStrip ? '<div class="cat-fav-strip"></div>' : ''}
        ${toolbar}${parts.join('')}
      </section>`;
}
// Mount (or re-mount) the favourites strip into its placeholder using the shared
// featured-row component - same Gallery/Cover-Flow presentation as the Tools hero,
// but each tile links to the asset's share deep link (→ its details modal).
// A favourite swatch's tile art: pure fills only (no strokes), because the strip's
// icon-hero CSS restyles glyph strokes and must leave a colour chip untouched.
export function swatchStripArt(_cat: CatCtx, c: PaletteEntry): string {
  const trans = isTransparent(c.hex);
  const fill = trans ? 'hsl(var(--muted-foreground) / .25)' : c.hex;
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="6" y="7" width="53" height="53" rx="14" fill="#00000033"/><rect x="5" y="5" width="53" height="53" rx="14" fill="${escapeText(fill)}"/></svg>`;
}
// The detail line under a favourite swatch: hex, RGB, ink (measured CMYK/spot when
// locked, generic RGB→CMYK otherwise) and OKLCH - the "what do I put in the deck /
// the CSS / the print job" readout, in one glance.
export function swatchStripBlurb(_cat: CatCtx, c: PaletteEntry): string {
  if (isTransparent(c.hex)) return '';
  const parts: string[] = [c.hex.toUpperCase()];
  const rgba = parseHex(c.hex);
  if (rgba) {
    parts.push(`RGB ${rgba[0]} ${rgba[1]} ${rgba[2]}`);
    const cmyk = Array.isArray(c.cmyk)
      ? c.cmyk
      : rgbToCmyk(rgba[0] / 255, rgba[1] / 255, rgba[2] / 255).map(v => Math.round(v * 100));
    parts.push(`CMYK ${cmyk.join(' ')}`);
  }
  const ok = hexToOklch(c.hex);
  if (ok) parts.push(`OKLCH ${ok.l.toFixed(2)} ${ok.c.toFixed(3)} ${Number.isFinite(ok.h) ? Math.round(ok.h) : 0}`);
  if (c.spot) parts.push(`Spot · ${c.spot.name}`);
  return parts.join(' · ');
}
export function filtersOps(cat: CatCtx) {
  return {
    visibleAssets: bindOp(cat, visibleAssets),
    matchesType: bindOp(cat, matchesType),
    playableHere: bindOp(cat, playableHere),
    haystack: bindOp(cat, haystack),
    matchesQuery: bindOp(cat, matchesQuery),
    favItems: bindOp(cat, favItems),
    swatchFavKey: bindOp(cat, swatchFavKey),
    favSwatches: bindOp(cat, favSwatches),
    uploadsSectionHtml: bindOp(cat, uploadsSectionHtml),
    assetsSectionHtml: bindOp(cat, assetsSectionHtml),
    swatchStripArt: bindOp(cat, swatchStripArt),
    swatchStripBlurb: bindOp(cat, swatchStripBlurb),
  };
}
