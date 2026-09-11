// SPDX-License-Identifier: MPL-2.0
/**
 * catalog: tile and bulk menus, section grouping, the top bar, reload.
 *
 * Every function takes the shared `cat: CatCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `cat.<module>.<fn>`. Extracted verbatim
 * from mountCatalog() by scripts/split-closure.ts.
 */
import { escape as escapeText } from '../../utils.ts';
import { t } from '../../i18n.ts';
import { announce } from '../../a11y.ts';
import { viewTopbarHtml } from '../../components/view-topbar.ts';
import { themeSegmentHtml } from '../../components/theme-toggle.ts';
import { soundSegmentHtml } from '../../components/sound-toggle.ts';
import { segHtml } from '../../lib/seg.ts';
import { VISUAL_TYPES } from '../../lib/asset-kinds.ts';
import { loadAssetCategories } from '../../lib/asset-category.ts';
import { assetBaseId, loadFavouriteAssets, loadHiddenAssets } from '../../lib/asset-favourites.ts';
import { icon } from '../../lib/icons.ts';
import { menuItemHtml } from '../../lib/context-menu.ts';
import { audioThumbPool } from '../../lib/audio-thumb-colour.ts';
import type { ThumbTheme } from '../../lib/audio-thumb-colour.ts';
import { loadAudioCovers } from '../../lib/audio-covers.ts';
import { categoryGlyph } from '../../lib/category-icons.ts';
import { livePalette } from '../../lib/live-palette.ts';
import { FONTS } from '../../lib/typefaces.ts';
import type { FontDownload } from '../../lib/typefaces.ts';
import { familyFromTokenValue, listUserFonts } from '../../user-fonts.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import type { PhotoTreatment } from '../../../../../engine/src/photo-treatment.ts';
import type { IconTheme } from '../../../../../engine/src/icon-theme.ts';
import { CHEVRON, HEADSHOT_ID, SLIDERS_ICON, isThemable } from './shared.ts';
import type { CatFont } from './shared.ts';
import { bindOp, type CatCtx } from './context.ts';

export const setOverrides = (cat: CatCtx, v: Record<string, string>) => { cat.overrides = v; cat.searchHaystack = null; };
// ── multi-select gestures (marquee + Shift-range) ───────────────────────────
// Shared verbatim with Projects (lib/tile-select.ts) so the two grids behave the same:
// drag a box through the gaps between cards to select what it touches, Shift-click a dot
// to sweep up everything back to the anchor. Only the user's uploads carry a dot, so only
// they are ever caught - a box dragged across the library's own cards selects nothing,
// which is right: shared assets can't be bulk-acted on.
//
// Wired ONCE per mount against viewEl (the persistent element): render() replaces
// `.catalog` wholesale and renderBody() replaces the grid, so anything bound inside would
// be orphaned - and re-wiring per render would reset the Shift-anchor under the user.
export const selectableTiles = (cat: CatCtx): HTMLElement[] =>
  { const { viewEl } = cat; return [...viewEl.querySelectorAll<HTMLElement>('.cat-tile .cat-check[data-select]')]
    .map(dot => dot.closest<HTMLElement>('.cat-tile'))
    .filter((tile): tile is HTMLElement => !!tile); };
// ── Context menu: right-click / long-press on any asset tile (lib/context-menu.ts,
// shared with gallery + projects). Exposes the actions that previously lived only
// behind the details modal; a tile inside a multi-selection of uploads opens the
// BULK menu mirroring the bulk bar. Single-item Duplicate/Delete reuse the
// (confirmed) bulk flows over a one-item selection - see onTileMenuAction.
export function catTileMenuHtml(cat: CatCtx, id: string): string {
  const { selected } = cat;
  const ref = cat.assetById.get(id);
  if (!ref) return '';
  const base = assetBaseId(id);
  const isUser = ref.source === 'user';
  return [
    menuItemHtml('open', icon('externalLink'), t('Details')),
    menuItemHtml('fav', icon('star'), cat.favSet.has(base) ? t('Remove from favourites') : t('Add to favourites')),
    menuItemHtml('download', icon('download'), t('Download…')),
    ref.source === 'user' ? menuItemHtml('convert-copy', icon('duplicate'), t('Convert a copy…')) : '',
    isUser ? menuItemHtml('saved-versions', icon('duplicate'), t('Saved versions…')) : '',
    menuItemHtml('send', icon('upload'), t('Send to…')),
    menuItemHtml('share', icon('link'), t('Copy link')),
    menuItemHtml('select', icon('check'), selected.has(id) ? t('Deselect') : t('Select')),
    menuItemHtml('add-to-project', icon('folder'), t('Add to project…')),
    isUser ? menuItemHtml('duplicate', icon('duplicate'), t('Duplicate')) : '',
    menuItemHtml('hide', icon('eye'), cat.hiddenSet.has(base) ? t('Unhide') : t('Hide')),
    isUser ? menuItemHtml('delete', icon('trash'), t('Delete'), { danger: true }) : '',
  ].join('');
}
// Mirrors the bulk bar's gating: favourite/hide for any selection, the
// destructive rows only when the whole selection is the user's own uploads.
export function catBulkMenuHtml(cat: CatCtx): string {
  const { selected } = cat;
  const uploads = cat.bulk.allSelectedUploads();
  return `<p class="folder-menu-head">${t('{n} selected', { n: selected.size })}</p>`
    + `<div class="folder-menu-list" role="menu" aria-label="${escapeText(t('Selection actions'))}">${[
        cat.bulk.canCompareSelection() ? menuItemHtml('compare', icon('duplicate'), t('Compare…')) : '',
        menuItemHtml('fav', icon('star'), cat.bulk.allSelectedFav() ? t('Unfavourite') : t('Favourite')),
        menuItemHtml('add-to-project', icon('folder'), t('Add to project…')),
        menuItemHtml('hide', icon('eye'), cat.bulk.allSelectedHidden() ? t('Unhide') : t('Hide')),
        uploads ? menuItemHtml('duplicate', icon('duplicate'), t('Duplicate')) : '',
        uploads ? menuItemHtml('download', icon('download'), t('Download')) : '',
        uploads ? menuItemHtml('delete', icon('trash'), t('Delete'), { danger: true }) : '',
      ].join('')}</div>`;
}
export async function onTileMenuAction(cat: CatCtx, act: string, id: string | null): Promise<void> {
  const { host, selected, viewEl } = cat;
  if (id === null) { cat.bulk.handleBulk(act); return; }   // bulk menu mirrors the bulk bar
  const ref = cat.assetById.get(id);
  if (!ref) return;
  if (act === 'open') { cat.details.openDetails(ref); return; }
  if (act === 'fav') { await cat.userAssets.toggleFavourite(id); return; }
  if (act === 'download') { await cat.downloads.openAssetDownloadDialog(ref); return; }
  if (act === 'saved-versions') { const { openAssetVersions } = await import('../asset-versions.ts'); await openAssetVersions(id, host, cat.tiles.reload); return; }
  if (act === 'convert-copy') {
    try {
      const { validateConvertFiles } = await import('../../lib/file-conversion.ts');
      const response = await fetch(ref.url);
      if (!response.ok) throw new Error(t('Could not read this file.'));
      // User uploads resolve to device-owned Blob URLs, never an arbitrary remote fetch.
      const blob = await response.blob(); validateConvertFiles([blob]);
      const { openFileInUtility } = await import('../../lib/drop-router.ts');
      const name = String(ref.meta?.name || ref.id.split('/').pop() || 'asset');
      openFileInUtility('convert', new File([blob], name.includes('.') ? name : `${name}.${ref.format}`, { type: blob.type }));
    } catch (error) { announce(error instanceof Error ? error.message : String(error), { assertive: true }); }
    return;
  }
  if (act === 'send') { await cat.downloads.openSendDialog(ref); return; }
  if (act === 'share') {
    try { await navigator.clipboard.writeText(cat.sections.assetLink(ref)); announce(t('Link copied')); }
    catch { announce(t('Couldn’t copy the link'), { assertive: true }); }
    return;
  }
  if (act === 'select') { cat.bulk.toggleSelect(id); return; }
  if (act === 'add-to-project') { await cat.bulk.addToProject([id]); return; }
  if (act === 'duplicate' || act === 'delete') {
    // "This tile", not "the selection": a multi-selection containing the tile would
    // have opened the bulk menu instead, so replacing the selection here is faithful.
    selected.clear(); selected.add(id);
    for (const tile of viewEl.querySelectorAll<HTMLElement>('.cat-tile')) {
      const on = selected.has(tile.dataset.id ?? '');
      tile.classList.toggle('is-selected', on);
      tile.querySelector('.cat-check')?.setAttribute('aria-pressed', String(on));
    }
    cat.bulk.syncSelectAll(); cat.bulk.syncBulkBar();
    cat.bulk.handleBulk(act);
    return;
  }
  if (act === 'hide') { await cat.userAssets.setHidden(assetBaseId(id), !cat.hiddenSet.has(assetBaseId(id))); }
}
export const persistCollapsed = (cat: CatCtx): void => {
  const { COLLAPSE_KEY, collapsed } = cat;
  try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...collapsed])); } catch { /* storage off */ }
};
// Keep the address bar in step with the currently-EXPANDED sections (…#/c?section=a,b)
// via replaceState - no navigation / no remount - so the live view is itself a copy-able
// deep link. A bare #/c when everything is folded. Runs on user fold/unfold only.
export const syncSectionUrl = (cat: CatCtx): void => {
  const { ALL_SECTION_KEYS, collapsed } = cat;
  const open = ALL_SECTION_KEYS.filter(k => !collapsed.has(k));
  const base = location.hash.split('?')[0] || '#/c';
  try {
    history.replaceState(history.state, '', `${location.pathname}${base}${open.length ? `?section=${open.join(',')}` : ''}`);
  } catch { /* history unavailable - non-fatal */ }
};
// The active brand's fonts: its declared font tokens (matched to a bundled spec
// when the family is one Lolly ships, so it keeps downloads + licence), then any
// Google fonts the user installed on this device. De-duped by family.
export async function computeBrandFonts(cat: CatCtx): Promise<CatFont[]> {
  const { host } = cat;
  const out: CatFont[] = [];
  const seen = new Set<string>();
  const push = (family: string, role: string, stack: string, typeLine: string, downloads: FontDownload[], onDevice: boolean): void => {
    const key = family.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({ family, role, stack, typeLine, downloads, onDevice });
  };
  const tokenFonts: Array<[string, string]> = [['{font.brand}', t('Brand - UI & body')], ['{font.mono}', t('Brand - monospace')]];
  for (const [ref, role] of tokenFonts) {
    let family = '';
    try { family = familyFromTokenValue(await host.tokens?.resolve?.(ref)); } catch { /* unresolved */ }
    if (!family) continue;
    const spec = FONTS.find(f => f.family.toLowerCase() === family.toLowerCase());
    if (spec) push(spec.family, role, spec.stack, `${spec.variable ? t('Variable') : t('Static')} · ${spec.weights}`, spec.downloads, false);
    else push(family, role, `'${family}', var(--font-brand, ui-sans-serif, sans-serif)`, t('Brand font · on this device'), [], true);
  }
  try {
    for (const uf of await listUserFonts(host as unknown as Parameters<typeof listUserFonts>[0])) {
      push(uf.family, uf.primary ? t('Brand - primary') : t('Added font'),
        `'${uf.family}', ui-sans-serif, sans-serif`, `${uf.weights}${uf.italic ? ` · ${t('italic')}` : ''} · ${t('on this device')}`, [], true);
    }
  } catch { /* user fonts unavailable - brand tokens still stand */ }
  return out;
}
export async function reload(cat: CatCtx): Promise<void> {
  const { host, pendingDeletes } = cat;
  // A thrown catalog query is a TOTAL sync failure - track it so the render can show a
  // distinct "couldn't load" state (with a Retry) rather than the identical-looking empty
  // catalogue. The other two loads degrade quietly (uploads/profile are best-effort).
  let failed = false;
  const [catalog, user, prof, livePal] = await Promise.all([
    host.assets.query({ includeDeprecated: true }).catch(() => { failed = true; return [] as AssetRef[]; }),
    host.assets._listUserAssets().catch(() => [] as AssetRef[]),
    host.profile.get().catch(() => null),
    livePalette(host),
  ]);
  if (!cat.mounted) return;
  cat.palette = livePal;
  cat.coverMap = loadAudioCovers(prof);
  cat.coverPool = audioThumbPool(livePal, host, (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light') as ThumbTheme);
  cat.catFonts = await computeBrandFonts(cat).catch(() => [] as CatFont[]);
  cat.loadFailed = failed;
  cat.profile = prof;
  cat.favSet = loadFavouriteAssets(prof);
  cat.hiddenSet = loadHiddenAssets(prof);
  setOverrides(cat, loadAssetCategories(prof));
  cat.headshotUrl = prof?.headshot?.id
    ? (await host.assets.get(prof.headshot.id).catch(() => null))?.url || ''
    : '';
  const userVisual = user.filter(a => a.id !== HEADSHOT_ID);
  // Catalog first, then user uploads. Only image-thumbnailable types from the catalog
  // (palette/tokens/font catalog entries are engine data covered elsewhere), a user's OWN
  // audio upload, AND catalog focus-music (audio tagged 'neurospicy' - the generated
  // songs + lo-fi loops) so they can be auditioned here. Other catalog audio (music beds)
  // stays out. Each audio tile renders a player in the details modal.
  cat.allAssets = [...catalog, ...userVisual]
    .filter(a => VISUAL_TYPES.has(a.type)
      || (a.type === 'audio' && (a.source === 'user' || (Array.isArray(a.meta?.tags) && (a.meta.tags as string[]).includes('neurospicy'))))
      // A user's OWN text/code/markdown and data uploads are first-class here
      // (¶/▦ stub tiles; preview + Copy/Analyse in the details modal). Catalog
      // LIBRARY text/data entries stay out - those are engine data (tokens,
      // palettes) covered by their own surfaces, and without this split every
      // brand-pack data file would flood the grid.
      || ((a.type === 'text' || a.type === 'data') && a.source === 'user')
      // A brand PALETTE asset is first-class: a swatch-mosaic tile that opens a
      // "Colour Lab in a card" - every preset with its OKLCH and a freshly
      // extrapolated OKLab tint→shade ramp (thumbHtml's `palette` branch). The
      // raw `tokens` DTCG doc stays out (redundant with this, and brand-locked),
      // and so do the functional `palette` assets that are engine config, not
      // swatch lists - the icon-theme pairs and photo treatments consumed by
      // _iconThemes()/_photoTreatments() (tagged as such; they'd otherwise each
      // mirror the one live brand palette the modal paints from).
      || (a.type === 'palette'
        && !(Array.isArray(a.meta?.tags)
          && (a.meta.tags as string[]).some(tg => tg === 'icon-themes' || tg === 'photo-treatments'))));
  if (pendingDeletes.size) cat.allAssets = cat.allAssets.filter(a => !pendingDeletes.has(a.id));
  cat.assetById = new Map(cat.allAssets.map(a => [a.id, a]));
  cat.searchHaystack = null; // asset set changed - drop the stale search index

  // Colour pairings for the themable-icon styler - only if the catalog supplies them.
  if (cat.allAssets.some(isThemable) && typeof host.assets._iconThemes === 'function') {
    cat.iconThemes = await host.assets._iconThemes().catch(() => [] as IconTheme[]);
  }
  // Photo colour treatments (greyscale/duotone) for raster groups - the bitmap sibling
  // of the icon colours; only fetched when the catalogue actually holds raster assets.
  if (cat.allAssets.some(a => a.type === 'raster') && typeof host.assets._photoTreatments === 'function') {
    cat.photoTreatments = await host.assets._photoTreatments().catch(() => [] as PhotoTreatment[]);
    if (cat.catPhotoTreatment && !cat.photoTreatments.some(t => t.id === cat.catPhotoTreatment)) cat.catPhotoTreatment = null;
  }
}
// ── markup ───────────────────────────────────────────────────────────────────
// The shared .gallery-topbar shell (component-audit rec 11) - the view-toggle + the
// language FAB + profile pill are unified in view-topbar.ts; only the "view options"
// button (`right`) and its popover are catalog's own.
export function catalogTopbarHtml(cat: CatCtx): string {
  return viewTopbarHtml({
    active: 'catalog',
    right: `<button type="button" class="filter-fab cat-viewopts-btn" aria-label="${escapeText(t('View options'))}" aria-haspopup="true" aria-expanded="${cat.viewOptsOpen}" title="${escapeText(t('View options'))}">${SLIDERS_ICON}</button>`,
    popover: `
        <div class="cat-viewopts filter-popover" role="group" aria-label="${escapeText(t('Catalog view options'))}"${cat.viewOptsOpen ? '' : ' hidden'}>
          ${themeSegmentHtml()}
          ${soundSegmentHtml()}
          <p class="filter-pop-head">${t('Layout')}</p>
          ${segHtml('catalog-layout', [
            { id: 'grid', label: t('Grid') },
            { id: 'list', label: t('List') },
          ], cat.catLayout, t('Catalog layout'), { attr: 'data-catlayout' })}
          ${segHtml('catalog-density', [
            { id: 'comfortable', label: t('Comfortable') },
            { id: 'compact', label: t('Compact') },
          ], cat.catDensity, t('Tile density'), { attr: 'data-catdensity' })}
          <p class="filter-pop-head">${t('Sort by')}</p>
          ${segHtml('catalog-sort', [
            { id: 'default', label: t('Default') },
            { id: 'name', label: t('Name') },
            { id: 'added', label: t('Added') },
            { id: 'modified', label: t('Modified') },
            { id: 'size', label: t('Size') },
            { id: 'type', label: t('Type') },
          ], cat.catSort, t('Sort assets by'), { attr: 'data-catsort' })}
          <p class="filter-pop-head">${t('Favourites')}</p>
          ${segHtml('favourites-view', [
            { id: 'gallery', label: t('Gallery') },
            { id: 'coverflow', label: t('Cover Flow') },
          ], cat.favView, t('Favourites view mode'), { attr: 'data-favview' })}
          <label class="filter-pop-check">
            <input type="checkbox" class="cat-favstrip-toggle field-check"${cat.favStripOn ? ' checked' : ''}>
            <span>${t('Show favourites strip')}</span>
          </label>
        </div>`,
    profile: { firstname: cat.profile?.firstname, headshotUrl: cat.headshotUrl },
  });
}
// One collapsible section shell - the category, hidden, Swatches and Fonts groups all
// use it, so "Collapse all" and the [data-cat-toggle] handler treat them uniformly.
// Driven by the `collapsed` Set; an active search force-expands every group so matches
// are never hidden behind a fold. `count` is optional (null → no pill); `extraClass`
// lets a group opt into extra chrome (e.g. the reference-panel divider).
export function groupSection(cat: CatCtx, key: string, label: string, count: number | null, bodyHtml: string, extraClass = ''): string {
  const { collapsed } = cat;
  const isCollapsed = collapsed.has(key) && !cat.query;
  return `<section class="cat-group${isCollapsed ? ' is-collapsed' : ''}${extraClass ? ' ' + extraClass : ''}" data-group="${escapeText(key)}">
      <button type="button" class="cat-group-head" data-cat-toggle="${escapeText(key)}" aria-expanded="${!isCollapsed}">
        <span class="cat-group-chevron">${CHEVRON}</span>
        <span class="cat-group-icon">${categoryGlyph(key)}</span>
        <span class="cat-group-title">${escapeText(t(label))}</span>
        ${count != null ? `<span class="cat-group-count">${count}</span>` : ''}
      </button>
      <div class="cat-group-body">${bodyHtml}</div>
    </section>`;
}
// Asset groups wrap their tiles in the responsive .cat-grid.
export const sectionHtml = (cat: CatCtx, key: string, label: string, count: number, tilesHtml: string): string =>
  groupSection(cat, key, label, count, `<div class="cat-grid">${tilesHtml}</div>`);
export function tilesOps(cat: CatCtx) {
  return {
    setOverrides: bindOp(cat, setOverrides),
    selectableTiles: bindOp(cat, selectableTiles),
    catTileMenuHtml: bindOp(cat, catTileMenuHtml),
    catBulkMenuHtml: bindOp(cat, catBulkMenuHtml),
    onTileMenuAction: bindOp(cat, onTileMenuAction),
    persistCollapsed: bindOp(cat, persistCollapsed),
    syncSectionUrl: bindOp(cat, syncSectionUrl),
    computeBrandFonts: bindOp(cat, computeBrandFonts),
    reload: bindOp(cat, reload),
    catalogTopbarHtml: bindOp(cat, catalogTopbarHtml),
    groupSection: bindOp(cat, groupSection),
    sectionHtml: bindOp(cat, sectionHtml),
  };
}
