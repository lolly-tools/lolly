// SPDX-License-Identifier: MPL-2.0
/**
 * catalog: treatment re-theming and the event wiring.
 *
 * Every function takes the shared `cat: CatCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `cat.<module>.<fn>`. Extracted verbatim
 * from mountCatalog() by scripts/split-closure.ts.
 */
import type { CatSort, TypeFilter } from '../catalog-filter.ts';
import { t, tRaw } from '../../i18n.ts';
import { announce } from '../../a11y.ts';
import type { FeaturedViewMode } from '../../components/featured-row.ts';
import { mountViewTopbar } from '../../components/view-topbar.ts';
import { clearSearchBar } from '../../components/search-bar.ts';
import { wireThemeSegment } from '../../components/theme-toggle.ts';
import { wireSoundSegment } from '../../components/sound-toggle.ts';
import { wireDisclosure } from '../../components/body-popover.ts';
import { playSfx } from '../../lib/sfx.ts';
import { saveFavouriteAssets } from '../../lib/asset-favourites.ts';
import type { PickerHost } from '../picker.ts';
import { exportSwatches, paletteEntriesToSwatches } from '../../lib/swatch-export.ts';
import type { SwatchExportFormat } from '../../lib/swatch-export.ts';
import { staggerReveal } from '../../lib/reveal.ts';
import { restyleIconTheme, treatmentFilterSvg } from '@lolly/engine';
import { CAT_ICONS, isThemable, setCatToggle, svgTextToDataUrl } from './shared.ts';
import { bindOp, type CatCtx } from './context.ts';

// ── wiring ───────────────────────────────────────────────────────────────────
// Recolour every themable icon in a category group in place (the category "Colours"
// switcher). A null theme restores the base URL; base SVGs are cached (iconSvgCache) so
// flipping between colours never re-fetches. Best-effort per tile - a failure leaves it.
export async function retheemeGroup(cat: CatCtx, group: HTMLElement, themeId: string | null): Promise<void> {
  const { iconSvgCache } = cat;
  const th = themeId ? cat.iconThemes.find(x => x.id === themeId) : null;
  // Recolour every icon in the group concurrently. The old serial `for…await`
  // did up to ~111 network round-trips one after another on the first colour
  // pick (before iconSvgCache warms), stalling the whole group visibly.
  await Promise.all([...group.querySelectorAll<HTMLElement>('.cat-tile')].map(async tile => {
    const id = tile.dataset.id;
    const ref = id ? cat.assetById.get(id) : null;
    const img = tile.querySelector<HTMLImageElement>('.cat-thumb');
    if (!ref || !img || !isThemable(ref)) return;
    if (!th) { img.src = ref.url; return; }   // back to base
    try {
      let base = iconSvgCache.get(id!);
      if (!base) { base = await (await fetch(ref.url)).text(); iconSvgCache.set(id!, base); }
      img.src = svgTextToDataUrl(restyleIconTheme(base, th) || base);
    } catch { /* leave this tile on its current art */ }
  }));
}
// Inject the treatment <filter> defs once (a hidden 0×0 SVG in the view root) so the
// grid can preview a wash with a live CSS `filter: url(#…)` - no re-encode, and
// pixel-identical to the baked result (treatmentFilterSvg uses sRGB interpolation).
// Re-injected after a full render() (which wipes viewEl); a no-op otherwise.
export function ensureTreatmentDefs(cat: CatCtx): void {
  const { TREATMENT_FILTER_PREFIX, viewEl } = cat;
  if (!cat.photoTreatments.length || viewEl.querySelector('#lolly-pt-defs')) return;
  const defs = cat.photoTreatments.map(t => treatmentFilterSvg(t, `${TREATMENT_FILTER_PREFIX}${t.id}`)).join('');
  const holder = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  holder.id = 'lolly-pt-defs';
  holder.setAttribute('width', '0'); holder.setAttribute('height', '0'); holder.setAttribute('aria-hidden', 'true');
  holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  holder.innerHTML = `<defs>${defs}</defs>`;
  viewEl.appendChild(holder);
}
// The bitmap sibling of retheemeGroup: wash every raster tile in the group with the
// chosen treatment via the live CSS filter (or clear it when null). Cheaper than the
// icon path - no fetch/re-serialise; raster just points at the injected <filter> def.
export function retreatGroup(cat: CatCtx, group: HTMLElement, treatmentId: string | null): void {
  const { TREATMENT_FILTER_PREFIX } = cat;
  const def = treatmentId ? cat.photoTreatments.find(t => t.id === treatmentId) : null;
  for (const tile of group.querySelectorAll<HTMLElement>('.cat-tile')) {
    const ref = tile.dataset.id ? cat.assetById.get(tile.dataset.id) : null;
    const img = tile.querySelector<HTMLElement>('.cat-thumb');
    if (ref?.type !== 'raster' || !(img instanceof HTMLImageElement)) continue;
    img.style.filter = def ? `url(#${TREATMENT_FILTER_PREFIX}${def.id})` : '';
  }
}
// Re-apply the active treatment to every raster group after a (re-)render - the wash
// is a CSS style on fresh tiles, so it must be re-stamped when the grid rebuilds.
export function reapplyTreatment(cat: CatCtx): void {
  const { viewEl } = cat;
  ensureTreatmentDefs(cat);
  if (!cat.catPhotoTreatment) return;
  viewEl.querySelectorAll<HTMLElement>('.cat-group').forEach(g => { retreatGroup(cat, g, cat.catPhotoTreatment); });
}
export function wire(cat: CatCtx): void {
  const { collapsed, host, viewEl } = cat;
  const body = viewEl.querySelector<HTMLElement>('.catalog-body');
  if (!body) return;

  body.addEventListener('click', async (e) => {
  const { tileSelect } = cat;
    const target = e.target as HTMLElement;

    // "Clear search" link in the no-results copy (the shell bar owns its own ✕;
    // its onQuery('') notification ends up in the claim below and re-renders).
    const clr = target.closest<HTMLElement>('[data-search-clear]');
    if (clr) { e.preventDefault(); clearSearchBar({ focus: true }); return; }

    // Swatches-section palette download - exports the palette exactly as shown.
    const sdl = target.closest<HTMLElement>('[data-swatch-dl]');
    if (sdl) {
      try {
        const { blob, filename } = exportSwatches(paletteEntriesToSwatches(cat.palette), sdl.dataset.swatchDl as SwatchExportFormat);
        await host.export.download(blob, filename);
        announce(tRaw('Palette downloaded as {filename}', { filename }));
      } catch { announce(t('Couldn’t export the palette.')); }
      return;
    }

    // Retry the catalogue load after a total sync failure (the failed state's control).
    const retry = target.closest<HTMLButtonElement>('.cat-retry');
    if (retry) {
      retry.disabled = true; retry.textContent = t('Retrying…');
      await cat.tiles.reload();
      if (cat.mounted) cat.sections.render();
      return;
    }

    // Selection dot. Shift-click extends from the anchor instead of toggling - see
    // lib/tile-select.ts (the same gesture Projects uses).
    const check = target.closest<HTMLElement>('[data-select]');
    if (check) {
      const id = check.dataset.select!;
      tileSelect.onDotClick(id, e.shiftKey, () => cat.bulk.toggleSelect(id));
      return;
    }

    const selectAll = target.closest<HTMLElement>('[data-selectall]');
    if (selectAll) { cat.bulk.selectAllUploads(); return; }

    // "Script audio" (uploads section): the lazy TTS dialog; a saved clip ends up in
    // "Your uploads", so reload + repaint exactly like a dropzone ingest.
    const scriptAudioBtn = target.closest<HTMLElement>('[data-script-audio]');
    if (scriptAudioBtn) {
      const { openScriptAudioDialog } = await import('../script-audio.ts');
      const ref = await openScriptAudioDialog(host as unknown as PickerHost);
      if (ref && cat.mounted) { await cat.tiles.reload(); if (cat.mounted) cat.sections.rerender(); }
      return;
    }

    // "Paste text" (uploads section): the lazy paste dialog; the saved text
    // asset ends up in "Your uploads", so reload + repaint like a dropzone ingest.
    const pasteTextBtn = target.closest<HTMLElement>('[data-paste-text]');
    if (pasteTextBtn) {
      const { openPasteTextDialog } = await import('../paste-text.ts');
      const ref = await openPasteTextDialog(host as unknown as PickerHost);
      if (ref && cat.mounted) { await cat.tiles.reload(); if (cat.mounted) cat.sections.rerender(); }
      return;
    }

    // Category "Colour" treatment swatch - wash this group's raster photos in place
    // (checked before the icon branch: treatment buttons also carry .cat-dl-theme).
    const treatSw = target.closest<HTMLElement>('.cat-dl-treat');
    const treatGroup = treatSw?.closest<HTMLElement>('.cat-group');
    if (treatSw && treatGroup) {
      cat.catPhotoTreatment = treatSw.dataset.treatment || null;
      treatGroup.querySelectorAll<HTMLElement>('.cat-dl-treat').forEach(b => {
        const on = b === treatSw; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on));
      });
      retreatGroup(cat, treatGroup, cat.catPhotoTreatment);
      return;
    }

    // Category "Colours" swatch - recolour this group's themable icons in place.
    const catSw = target.closest<HTMLElement>('.cat-dl-theme');
    const catGroup = catSw?.closest<HTMLElement>('.cat-group');
    if (catSw && catGroup) {
      cat.catIconTheme = catSw.dataset.theme ?? null;
      catGroup.querySelectorAll<HTMLElement>('.cat-dl-theme').forEach(b => {
        const on = b === catSw; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on));
      });
      await retheemeGroup(cat, catGroup, cat.catIconTheme);
      return;
    }

    const openBtn = target.closest<HTMLElement>('[data-open]');
    if (openBtn) {
      const ref = cat.assetById.get(openBtn.dataset.open!);
      // Carry the category grid's colour choice into the details modal - an icon opens on
      // its category theme, a photo on its category treatment (openDetails picks the one
      // that applies to the asset's type; passing both is harmless).
      if (ref) cat.details.openDetails(ref, cat.catIconTheme, cat.catPhotoTreatment);
      return;
    }

    const toggle = target.closest<HTMLElement>('[data-cat-toggle]');
    if (toggle) {
      const key = toggle.dataset.catToggle!;
      const sec = toggle.closest('.cat-group')!;
      const collapse = !sec.classList.contains('is-collapsed');
      sec.classList.toggle('is-collapsed', collapse);
      toggle.setAttribute('aria-expanded', String(!collapse));
      if (collapse) collapsed.add(key); else collapsed.delete(key);
      cat.tiles.persistCollapsed();
      cat.tiles.syncSectionUrl();
      // Expanding → cascade the category's tiles in with a soft shuffle (like the gallery).
      if (!collapse) staggerReveal([...sec.querySelectorAll('.cat-tile')]);
      return;
    }

    // Collapse-all / Expand-all - fold or unfold every section in place (no re-render,
    // so scroll is kept). Checked BEFORE .cat-showhidden since it reuses that button
    // style. If anything is open we collapse all; once all are folded we expand all.
    const collapseAll = target.closest<HTMLElement>('.cat-collapse-all');
    if (collapseAll) {
      const groups = [...body.querySelectorAll<HTMLElement>('.cat-group')];
      const anyOpen = groups.some(g => !g.classList.contains('is-collapsed'));
      for (const g of groups) {
        g.classList.toggle('is-collapsed', anyOpen);
        g.querySelector('.cat-group-head')?.setAttribute('aria-expanded', String(!anyOpen));
        const key = g.dataset.group;
        if (key) { if (anyOpen) collapsed.add(key); else collapsed.delete(key); }
      }
      cat.tiles.persistCollapsed();
      cat.tiles.syncSectionUrl();
      // Just collapsed everything → the next action (and icon) is "Expand all", and vice
      // versa. Swap glyph + label together so the icon survives (setCatToggle, not textContent).
      setCatToggle(collapseAll, anyOpen ? CAT_ICONS.expand : CAT_ICONS.collapse, anyOpen ? t('Expand all') : t('Collapse all'));
      return;
    }

    // Filetype filter (sticky toolbar) - narrow the grid to image / vector / motion.
    // Body-only re-render keeps the footer search + its focus; the toolbar (rebuilt with
    // it) reflects the new pressed state.
    const typeBtn = target.closest<HTMLElement>('[data-typefilter]');
    if (typeBtn) {
      const next = (typeBtn.dataset.typefilter || 'all') as TypeFilter;
      if (next !== cat.typeFilter) { cat.typeFilter = next; cat.sections.renderBody(); }
      return;
    }

    if (target.closest('.cat-showhidden')) { cat.showHidden = !cat.showHidden; cat.sections.rerender(); return; }

    // Star toggle on a swatch card → flip its membership in the favourites strip.
    const sFav = target.closest<HTMLElement>('.plat-swatch-fav');
    if (sFav) {
      const key = cat.filters.swatchFavKey(sFav.dataset.favSwatch ?? '');
      const on = !cat.favSet.has(key);
      if (on) cat.favSet.add(key); else cat.favSet.delete(key);
      if (cat.profile) void saveFavouriteAssets(host, cat.profile, cat.favSet);
      sFav.classList.toggle('is-on', on);
      sFav.setAttribute('aria-pressed', String(on));
      const label = on ? t('Remove from favourites') : t('Add to favourites');
      sFav.setAttribute('aria-label', label);
      sFav.title = label;
      cat.sections.refreshFavStrip();
      return;
    }

    // Read-only convenience: click a swatch chip to copy its hex.
    const chip = target.closest<HTMLElement>('.plat-swatch-chip[data-copy]');
    if (chip) {
      const hex = chip.dataset.copy!;
      navigator.clipboard?.writeText(hex).then(() => {
        chip.classList.add('is-copied');
        setTimeout(() => chip.classList.remove('is-copied'), 900);
      }).catch(() => {});
    }
  });

  // ── Uploads drop area ────────────────────────────────────────────────────────
  // The dropzone + its ingest loop live in the shared lib/upload-dropzone.ts component,
  // mounted per body paint by mountDropzone() (its listeners sit on the zone itself,
  // not delegated here - the mount is re-established after every innerHTML rebuild).

  // Capture-phase broken-image fallback: a grid thumbnail whose bytes fail to load (a
  // stale/missing derivative) is swapped for the same cat-thumb-stub the placeholder path
  // renders, so a tile never shows a broken image. Error events don't bubble, so listen in
  // the capture phase (mirrors gallery.ts's hero-preview morph). Delegated on the persistent
  // .catalog-body so it survives the innerHTML rebuilds in renderBody().
  body.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.classList.contains('cat-thumb')) return;
    const id = img.closest<HTMLElement>('.cat-tile')?.dataset.id ?? '';
    const stub = document.createElement('span');
    stub.className = 'cat-thumb cat-thumb-stub';
    stub.textContent = cat.assetById.get(id)?.type ?? 'image';
    img.replaceWith(stub);
  }, true);

  // ── Bulk-action bar (lives in .catalog, outside .catalog-body) ──────────────
  viewEl.querySelector<HTMLElement>('.cat-bulkbar')?.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-bulk]');
    if (b) cat.bulk.handleBulk(b.dataset.bulk!);
  });

  // (The search field, its ✕, debounce and Escape ladder live in the shell's
  // persistent bar - see the claimSearchBar call in the mount section. Its input
  // sits outside this view's DOM entirely, so renderBody() can never touch it - 
  // the old footer-outside-the-body focus trick, now structural.)

  // ── View-options popover (favourites view mode + strip on/off) ──────────────
  const voBtn = viewEl.querySelector<HTMLElement>('.cat-viewopts-btn');
  const voPop = viewEl.querySelector<HTMLElement>('.cat-viewopts');
  if (voPop) wireThemeSegment(voPop, host);   // Theme picker in the view-options popover
  if (voPop) wireSoundSegment(voPop, host);   // Sound on/off segment in the view-options popover
  // Same lifecycle as the gallery's filter popover (toggle `hidden`, aria-expanded,
  // outside-pointerdown dismissal, Escape, focus restore) - shared in
  // components/body-popover.ts. `onToggle` keeps the render-time `viewOptsOpen` flag
  // in sync so a re-render of the topbar reproduces the popover's current state.
  const voDisclosure = wireDisclosure(voBtn, voPop, { onToggle: (open) => { cat.viewOptsOpen = open; } });
  cat.closeViewOpts = () => voDisclosure.close();
  // Gallery ↔ Cover Flow: switch the live strip in place (no full re-render).
  voPop?.addEventListener('click', (e) => {
  const { CAT_SORTS, DENSITY_PREF_KEY, FAV_VIEW_KEY, LAYOUT_PREF_KEY, SORT_PREF_KEY } = cat;
    const layoutSeg = (e.target as HTMLElement).closest<HTMLElement>('[data-catlayout]');
    if (layoutSeg) {
      const next = layoutSeg.dataset.catlayout === 'list' ? 'list' : 'grid';
      if (next === cat.catLayout) return;
      cat.catLayout = next;
      try { localStorage.setItem(LAYOUT_PREF_KEY, cat.catLayout); } catch { /* storage off */ }
      cat.sections.rerender();
      return;
    }
    const densitySeg = (e.target as HTMLElement).closest<HTMLElement>('[data-catdensity]');
    if (densitySeg) {
      const next = densitySeg.dataset.catdensity === 'compact' ? 'compact' : 'comfortable';
      if (next === cat.catDensity) return;
      cat.catDensity = next;
      try { localStorage.setItem(DENSITY_PREF_KEY, cat.catDensity); } catch { /* storage off */ }
      cat.sections.rerender();
      return;
    }
    // Sort segment (plans/132 WP-A): re-orders every section in place.
    const sortSeg = (e.target as HTMLElement).closest<HTMLElement>('[data-catsort]');
    if (sortSeg) {
      const next = sortSeg.dataset.catsort as CatSort;
      if (!CAT_SORTS.includes(next) || next === cat.catSort) return;
      cat.catSort = next;
      try { localStorage.setItem(SORT_PREF_KEY, cat.catSort); } catch { /* storage off */ }
      voPop.querySelectorAll<HTMLElement>('[data-catsort]').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.catsort === cat.catSort)); });
      cat.sections.rerender();
      return;
    }
    const seg = (e.target as HTMLElement).closest<HTMLElement>('[data-favview]');
    if (!seg) return;
    const next: FeaturedViewMode = seg.dataset.favview === 'coverflow' ? 'coverflow' : 'gallery';
    const changed = next !== cat.favView;
    cat.favView = next;
    try { localStorage.setItem(FAV_VIEW_KEY, cat.favView); } catch { /* storage off */ }
    voPop.querySelectorAll<HTMLElement>('[data-favview]').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.favview === cat.favView)); });
    cat.featuredHandle?.setViewMode(cat.favView);
    // Same cue as the main gallery's Gallery|Cover Flow switch (gallery.ts) - Cover Flow is
    // cool & futuristic, Gallery is refined.
    if (changed) playSfx(cat.favView === 'coverflow' ? 'coverflow' : 'gallery');
  });
  // Show / hide the favourites strip - mount or tear down in place (no full re-render,
  // so the open popover isn't disturbed).
  voPop?.querySelector<HTMLInputElement>('.cat-favstrip-toggle')?.addEventListener('change', (e) => {
  const { FAV_STRIP_KEY } = cat;
    cat.favStripOn = (e.target as HTMLInputElement).checked;
    try { localStorage.setItem(FAV_STRIP_KEY, cat.favStripOn ? 'on' : 'off'); } catch { /* storage off */ }
    const assets = viewEl.querySelector<HTMLElement>('.cat-assets');
    let mount = viewEl.querySelector<HTMLElement>('.cat-fav-strip');
    if (cat.favStripOn) {
      if (!mount && assets && (cat.filters.favItems().length || cat.filters.favSwatches().length)) {
        mount = document.createElement('div'); mount.className = 'cat-fav-strip';
        assets.insertBefore(mount, assets.firstChild);
      }
      cat.sections.mountFavStrip();
    } else {
      cat.featuredHandle?.destroy(); cat.featuredHandle = null; mount?.remove();
    }
  });

  // Mobile: the avatar opens the shared profile menu (theme + settings); desktop
  // keeps it a plain link to /profile. Matches Tools + Projects. `headshotUrl` is
  // already resolved (in reload(), before the first render) so no deferred fetch here.
  mountViewTopbar(viewEl, host);
}
// Drag-out (plans/132 WP-F): a tile drag carries the asset id in the app's
// own `text/lolly-asset` type (tool slots + free-canvas accept it) and as
// plain text. Delegated on the persistent viewEl; bound once per mount.
export const onTileDragStart = (_cat: CatCtx, e: DragEvent): void => {
  const tile = (e.target as HTMLElement).closest?.('.cat-tile[data-id]') as HTMLElement | null;
  if (!tile || !e.dataTransfer) return;
  const id = tile.dataset.id!;
  e.dataTransfer.setData('text/lolly-asset', id);
  e.dataTransfer.setData('text/plain', id);
  e.dataTransfer.effectAllowed = 'copy';
};
export function wiringOps(cat: CatCtx) {
  return {
    retheemeGroup: bindOp(cat, retheemeGroup),
    ensureTreatmentDefs: bindOp(cat, ensureTreatmentDefs),
    retreatGroup: bindOp(cat, retreatGroup),
    reapplyTreatment: bindOp(cat, reapplyTreatment),
    wire: bindOp(cat, wire),
    onTileDragStart: bindOp(cat, onTileDragStart),
  };
}
