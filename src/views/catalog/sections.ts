// SPDX-License-Identifier: MPL-2.0
/**
 * catalog: swatch and font sections, body render, thumb grids, dropzone, details and URL sync.
 *
 * Every function takes the shared `cat: CatCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `cat.<module>.<fn>`. Extracted verbatim
 * from mountCatalog() by scripts/split-closure.ts.
 */
import { escape as escapeText } from '../../utils.ts';
import { t, tRaw } from '../../i18n.ts';
import { announce } from '../../a11y.ts';
import { fmtBytes } from '../../lib/format.ts';
import { mountFeaturedRow } from '../../components/featured-row.ts';
import type { FeaturedEntry } from '../../components/featured-row.ts';
import { autoplayLottieThumbs } from '../lottie-mount.ts';
import { armMotionPreviews } from '../../lib/preview-media.ts';
import { armViewEnter } from '../../view-enter.ts';
import { assetBaseId } from '../../lib/asset-favourites.ts';
import { mountUploadDropzone } from '../../lib/upload-dropzone.ts';
import { bulkBarHtml as buildBulkBar } from '../../lib/bulk-bar.ts';
import { mountAudioThumbs } from '../picker.ts';
import type { PickerHost } from '../picker.ts';
import { mountTextThumbs } from '../../lib/text-thumbs.ts';
import { mountPdfThumbs } from '../../lib/pdf-thumbs.ts';
import { groupPalette, swatch } from '../../lib/swatches.ts';
import { prefersReducedMotion } from '../../lib/a11y-prefs.ts';
import { FONT_LICENSE, WEIGHT_RAMP } from '../../lib/typefaces.ts';
import { prepareAssetForVerify, setPendingVerify } from '../../lib/verify-handoff.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { CAT_ICONS, DOWNLOAD_ICON } from './shared.ts';
import { bindOp, type CatCtx } from './context.ts';

// Open on a favourite-swatch tile → reveal the Swatches reference panel below.
export function revealSwatches(cat: CatCtx): void {
  const { viewEl } = cat;
  const sec = viewEl.querySelector<HTMLElement>('.cat-group[data-group="swatches"]');
  if (!sec) return;
  if (sec.classList.contains('is-collapsed')) sec.querySelector<HTMLElement>('[data-cat-toggle]')?.click();
  sec.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
}
export function mountFavStrip(cat: CatCtx): void {
  const { host, viewEl } = cat;
  cat.featuredHandle?.destroy();
  cat.featuredHandle = null;
  const mount = viewEl.querySelector<HTMLElement>('.cat-fav-strip');
  if (!mount) return;
  const items = cat.filters.favItems();
  const swatchEntries: FeaturedEntry[] = cat.filters.favSwatches().map(c => ({
    id: cat.filters.swatchFavKey(c.label),
    name: c.label,
    icon: cat.filters.swatchStripArt(c),
    href: '#/c',
    featured: { blurb: cat.filters.swatchStripBlurb(c) },
  }));
  if (!items.length && !swatchEntries.length) return;
  const entries: FeaturedEntry[] = items.map(a => ({
    id: a.id,
    name: String(a.meta?.name ?? a.id),
    // A user-uploaded lottie's url is JSON, a video's is mp4/webm, an AUDIO asset's is
    // an .opus/.mp3/.xm, and a TEXT/data asset's bytes ARE the text - an <img> (what
    // the featured-row renders) breaks on all of them, so omit the preview rather than
    // ship a broken tile.
    preview: (a.meta?._placeholder || (a.type === 'lottie' && a.source === 'user') || a.type === 'video' || a.type === 'audio' || a.type === 'text' || a.type === 'data') ? undefined : a.url,
    // ...and fill the strip's `icon` slot so those tiles still carry art. Audio gets
    // the SAME waveform the grid draws; motion and text get their type glyphs (the
    // icon-hero treatment) - otherwise a starred one is a card with a name and
    // nothing above it (the fourth renderer to hit this).
    icon: a.type === 'audio' ? cat.details.audioCardArt(a)
      : (a.type === 'video' || a.type === 'lottie') ? CAT_ICONS.motion
      : (a.type === 'text' || a.type === 'data') ? CAT_ICONS.text
      : undefined,
    formats: a.format ? [a.format] : undefined,
    href: `#/c?asset=${encodeURIComponent(a.id)}`,   // → this view + the details modal
    featured: {},                                     // no tool variants: strip just shows the preview
  }));
  cat.featuredHandle = mountFeaturedRow(mount, [...entries, ...swatchEntries], host, {
    viewMode: cat.favView,
    collection: 'assets',
    favourites: cat.favSet,
    label: t('Favourites'),
    ariaLabel: t('Favourite assets'),
    // Open the asset's details modal in place. The tiles' hrefs point at this same view
    // (#/c?asset=…), so a route navigation would be swallowed by the router's same-route
    // dedupe (→ "Open does nothing"); opening the modal directly also preserves the grid's
    // scroll/expansion state and lets the same favourite be reopened repeatedly.
    // A swatch tile has no details modal - it reveals the Swatches panel instead.
    onActivate: (id) => {
      if (id.startsWith('swatch:')) { revealSwatches(cat); return; }
      const ref = cat.assetById.get(id); if (ref) cat.details.openDetails(ref, cat.catIconTheme, cat.catPhotoTreatment);
    },
  });
}
// Reflect a favourites-MEMBERSHIP change (add/remove) in the strip without a full
// re-render. The featured-row handle has no incremental entry API, so re-mount just the
// strip (cheap next to rebuilding the whole grid) - creating or dropping its placeholder
// as the favourites set crosses empty↔non-empty, exactly like the .cat-favstrip-toggle
// handler. No-op while the strip is off or a search is active (it isn't shown then).
export function refreshFavStrip(cat: CatCtx): void {
  const { viewEl } = cat;
  if (!cat.favStripOn || cat.query) return;
  const assets = viewEl.querySelector<HTMLElement>('.cat-assets');
  if (!assets) return;
  let mount = viewEl.querySelector<HTMLElement>('.cat-fav-strip');
  if (cat.filters.favItems().length || cat.filters.favSwatches().length) {
    if (!mount) {
      mount = document.createElement('div'); mount.className = 'cat-fav-strip';
      assets.insertBefore(mount, assets.firstChild);
    }
    mountFavStrip(cat);
    void cat.details.warmFavAudioArt();
  } else {
    cat.featuredHandle?.destroy(); cat.featuredHandle = null; mount?.remove();
  }
}
// Flip every grid tile sharing this base id to the given favourite state, in place,
// matching what assetTile() would render. Favourited assets keep their category-bucket
// tile (the strip is a shortcut, not a bucket move), so this + refreshFavStrip() fully
// cover a fav toggle.
export function reflectFavInGrid(cat: CatCtx, base: string, on: boolean): void {
  const { viewEl } = cat;
  for (const tile of viewEl.querySelectorAll<HTMLElement>('.cat-tile')) {
    const id = tile.dataset.id ?? '';
    if (assetBaseId(id) !== base) continue;
    tile.classList.toggle('is-fav', on);
  }
}
export function swatchesSectionHtml(cat: CatCtx): string {
  const { SWATCH_DOWNLOADS } = cat;
  const { brand, spectrum, ramps } = groupPalette(cat.palette);
  const total = brand.length + spectrum.length + ramps.reduce((n, [, cols]) => n + cols.length, 0);
  const grid = (list: typeof brand) => `<div class="plat-swatch-grid">${list.map(c => swatch(c, { fav: cat.favSet.has(cat.filters.swatchFavKey(c.label)) })).join('')}</div>`;
  const rampBlocks = ramps.map(([fam, cols]) =>
    `<h3 class="cat-panel-subhead">${escapeText(fam)}</h3>${grid(cols)}`).join('');
  const downloads = `<div class="cat-font-downloads cat-swatch-downloads">${SWATCH_DOWNLOADS.map(d =>
      `<button type="button" class="cat-download" data-swatch-dl="${d.fmt}" data-sfx="whoosh">${DOWNLOAD_ICON}<span>${escapeText(t(d.label))}</span></button>`).join('')}</div>`;
  const body = `
      ${downloads}
      <p class="cat-panel-desc">${t('The brand palette. Click any chip to copy its hex. A <span class="plat-chip-flag is-static">CMYK</span> or <span class="plat-chip-flag is-static">SPOT</span> flag marks a locked ink value used directly in CMYK PDF exports.')}</p>
      <h3 class="cat-panel-subhead">${t('Brand')}</h3>${grid(brand)}
      ${spectrum.length ? `<h3 class="cat-panel-subhead">${t('Spectrum')}</h3>${grid(spectrum)}` : ''}
      ${rampBlocks}`;
  return cat.tiles.groupSection('swatches', 'Swatches', total, body, 'cat-group--ref');
}
export function fontsSectionHtml(cat: CatCtx): string {
  if (!cat.catFonts.length) return ''; // a brand with no declared/added fonts shows no section
  const cards = cat.catFonts.map(f => `
      <article class="plat-font cat-font">
        <header class="plat-font-head">
          <span class="plat-font-name" style="font-family:${f.stack}">${escapeText(f.family)}</span>
          <span class="plat-font-role">${escapeText(f.role)}</span>
        </header>
        <div class="plat-font-specimen" style="font-family:${f.stack}">
          <div class="plat-font-aa">Aa</div>
          <p class="plat-font-pangram">The quick brown fox jumps over the lazy dog 0123456789</p>
          <div class="plat-font-weights">
            ${WEIGHT_RAMP.map(w => `<span style="font-weight:${w}">${w}</span>`).join('')}
          </div>
        </div>
        <dl class="plat-kv">
          <div><dt>${t('Type')}</dt><dd>${escapeText(f.typeLine)}</dd></div>
        </dl>
        ${f.downloads.length ? `<div class="cat-font-downloads">
          ${f.downloads.map(d => `<a class="cat-download" href="${d.href}" download>${DOWNLOAD_ICON}<span>${escapeText(d.label)}</span></a>`).join('')}
        </div>` : ''}
      </article>`).join('');
  // Show the licence line only when a bundled (downloadable) face is present.
  const anyBundled = cat.catFonts.some(f => f.downloads.length);
  const body = `
      <p class="cat-panel-desc">${t('The fonts your brand carries - available to every tool canvas and the app UI. Add more from the brand editor.')}</p>
      <div class="plat-font-grid cat-font-grid">${cards}</div>
      ${anyBundled ? `<p class="cat-panel-foot">${tRaw('Bundled faces licensed under the {link}.', { link: `<a href="${FONT_LICENSE.href}" target="_blank" rel="noopener">${escapeText(FONT_LICENSE.label)}</a>` })}</p>` : ''}`;
  return cat.tiles.groupSection('fonts', 'Fonts', cat.catFonts.length, body);
}
// The scrollable content. Swatches + Fonts are reference material, not searchable
// assets - drop them while a search is active so the results grid stands alone.
export const bodyHtml = (cat: CatCtx): string =>
  `${cat.filters.assetsSectionHtml()}${(cat.query || cat.typeFilter !== 'all') ? '' : swatchesSectionHtml(cat) + fontsSectionHtml(cat)}`;
export const bulkBarHtml = (cat: CatCtx): string => { const { bulkBarCfg } = cat; return buildBulkBar(bulkBarCfg); };
export function render(cat: CatCtx): void {
  const { viewEl } = cat;
  cat.bulk.pruneSelection();
  viewEl.innerHTML = `
      <div class="catalog${cat.catLayout === 'list' ? ' cat-layout-list' : ''}${cat.catDensity === 'compact' ? ' cat-density-compact' : ''}">
        ${cat.tiles.catalogTopbarHtml()}
        <h1 class="visually-hidden">${t('Catalogue')}</h1>
        <div class="catalog-body">${bodyHtml(cat)}</div>
        ${bulkBarHtml(cat)}
      </div>`;
  cat.wiring.wire();
  mountFavStrip(cat);
  cat.bulk.syncBulkBar();
  cat.wiring.reapplyTreatment();
  mountLottieThumbs(cat);
  mountAudioThumbGrid(cat);
  mountTextThumbGrid(cat);
  mountMotionThumbs(cat);
  mountPdfThumbGrid(cat);
  mountDropzone(cat);
  if (cat.firstPaint) { armViewEnter(viewEl, '.cat-assets, .cat-group--ref'); cat.firstPaint = false; }
}
// Search re-render: rebuild ONLY the body so the fixed footer - and the search input's
// focus + caret - survive between keystrokes. The body's delegated click handler is
// bound to the persistent .catalog-body element, so it survives too.
// (Re)mount the on-screen-gated lottie autoplayer over the current grid. Called after every
// body (re)render; destroys the prior observer first so re-renders don't stack players.
export function mountLottieThumbs(cat: CatCtx): void {
  const { viewEl } = cat;
  cat.lottieThumbs?.destroy();
  const body = viewEl.querySelector<HTMLElement>('.catalog-body');
  cat.lottieThumbs = body ? autoplayLottieThumbs(body, { isCurrent: () => cat.mounted }) : null;
}
// (Re)mount the waveform upgrader over the current grid - the audio sibling of
// mountLottieThumbs, called from the same places. Only tiles the user scrolls to are
// decoded: SUSE ships 52 audio assets, and analysing all of them because a grid painted
// would be minutes of decoding nobody asked for.
export function mountAudioThumbGrid(cat: CatCtx): void {
  const { host, viewEl } = cat;
  cat.audioThumbs?.destroy();
  const body = viewEl.querySelector<HTMLElement>('.catalog-body');
  cat.audioThumbs = body
    ? mountAudioThumbs(body, host, (id) => cat.assetById.get(id), () => cat.mounted)
    : null;
}
// The text sibling: upgrade ¶ stubs to brand-inked, signal-focused excerpts
// (lib/text-thumbs.ts). Same lifecycle as the waveform upgrader, called from
// the same places; models cache module-side so re-renders repaint instantly.
// The playback gate every video thumbnail in the grid goes through (lib/preview-media.ts):
// hover/focus on a mouse, the most-centered tile on touch, nothing at all under reduced
// motion. Same lifecycle as the upgraders above - a re-render replaced the elements the
// previous observer was holding.
export function mountMotionThumbs(cat: CatCtx): void {
  const { viewEl } = cat;
  cat.motionThumbs?.destroy();
  const body = viewEl.querySelector<HTMLElement>('.catalog-body');
  cat.motionThumbs = body ? armMotionPreviews(body, { isCurrent: () => cat.mounted }) : null;
}
export function mountTextThumbGrid(cat: CatCtx): void {
  const { host, viewEl } = cat;
  cat.textThumbs?.destroy();
  const body = viewEl.querySelector<HTMLElement>('.catalog-body');
  cat.textThumbs = body
    ? mountTextThumbs(body, host, (id) => cat.assetById.get(id), () => cat.mounted)
    : null;
}
// The document sibling (plans/140 S6): upgrade a stored PDF's ▦ stub to a
// first-page vector preview (lib/pdf-thumbs.ts). Same lifecycle again; the
// PDF interpreter chunk loads only when a PDF tile scrolls on screen.
export function mountPdfThumbGrid(cat: CatCtx): void {
  const { viewEl } = cat;
  cat.pdfThumbs?.destroy();
  const body = viewEl.querySelector<HTMLElement>('.catalog-body');
  cat.pdfThumbs = body
    ? mountPdfThumbs(body, (id) => cat.assetById.get(id), () => cat.mounted)
    : null;
}
// (Re)mount the shared upload dropzone into the uploads section's placeholder. Called
// after every body (re)render - the innerHTML rebuild orphans the previous instance, so
// tear it down first (a mid-ingest re-mount is safe: the component's single-flight
// ingest guard is module-level, and an in-flight ingest still delivers its onAdded).
// Files ingest through the SAME storeUserUpload path as the asset picker (downscale/
// sanitise/credential-preserve/animated-sniff); onAdded reloads so the new tiles land
// in "Your uploads".
export function mountDropzone(cat: CatCtx): void {
  const { host, viewEl } = cat;
  cat.dropzoneDispose?.();
  cat.dropzoneDispose = null;
  const mount = viewEl.querySelector<HTMLElement>('[data-dropzone-mount]');
  if (!mount) return;   // no uploads section this paint (a total sync failure)
  cat.dropzoneDispose = mountUploadDropzone(mount, host as unknown as PickerHost, {
    onAdded: async () => { if (!cat.mounted) return; await cat.tiles.reload(); if (cat.mounted) rerender(cat); },
  });
  // The roomier "this IS the section" layout when there are no uploads yet.
  mount.querySelector('.updz')?.classList.toggle('updz--empty', mount.hasAttribute('data-empty'));
}
export function renderBody(cat: CatCtx): void {
  const { viewEl } = cat;
  const body = viewEl.querySelector<HTMLElement>('.catalog-body');
  if (!body) { render(cat); return; }
  cat.bulk.pruneSelection();
  body.innerHTML = bodyHtml(cat);
  mountFavStrip(cat);
  cat.bulk.syncBulkBar();
  cat.wiring.reapplyTreatment();
  mountLottieThumbs(cat);
  mountAudioThumbGrid(cat);
  mountTextThumbGrid(cat);
  mountMotionThumbs(cat);
  mountPdfThumbGrid(cat);
  mountDropzone(cat);
  fillStorageChip(cat);
}
// Device-storage chip in the uploads bar (plans/132 WP-K item 2) - the same
// navigator.storage.estimate() read the /profile meter uses, one quiet line.
// Async fill after paint; absent API (or a refusal) just leaves it hidden.
export function fillStorageChip(cat: CatCtx): void {
  const { viewEl } = cat;
  const chip = viewEl.querySelector<HTMLElement>('[data-storage-chip]');
  if (!chip || !navigator.storage?.estimate) return;
  void navigator.storage.estimate().then(({ usage = 0, quota = 0 }) => {
    if (!cat.mounted || !quota) return;
    chip.textContent = tRaw('{used} of {total} device storage used', { used: fmtBytes(usage), total: fmtBytes(quota) });
    chip.hidden = false;
  }).catch(() => { /* leave hidden */ });
}
// Re-render from state, preserving the document scroll position so an in-page action
// (star / hide / recategorise) doesn't jump the page to the top.
export function rerender(cat: CatCtx): void {
  if (!cat.mounted) return;
  const y = window.scrollY;
  render(cat);
  window.scrollTo(0, y);
}
export function closeDetails(cat: CatCtx): void {
  cat.detailsModal?.close(); // cleanup (meter/lottie/wav dispose + nulling the refs) runs in its onClose
}
/** Keep the address bar as shareable as the Share button: the open asset
 *  rides `?asset=` (the share link's exact shape) so copy/pasting the URL
 *  bar reopens the same view. replaceState, deliberately: paging must not
 *  stack history entries, and the hash router only reacts to hashchange,
 *  which replaceState never fires. Other catalog params are preserved. */
export function syncAssetUrl(_cat: CatCtx, id: string | null): void {
  const [path = '', query = ''] = location.hash.split('?');
  if (path !== '#/c' && path !== '#/catalog') return; // only rewrite the catalog's own URL
  const params = new URLSearchParams(query);
  if (id) params.set('asset', id);
  else params.delete('asset');
  const q = params.toString();
  history.replaceState(history.state, '', `${location.pathname}${path}${q ? `?${q}` : ''}`);
}
// Open the Verify checker (#/verify) on this asset and auto-run the on-device C2PA
// check - the authoritative source for the AI provenance the badge summarises. The
// stored copy is the source of truth: if it still carries a Content Credential (catalog
// assets, verbatim uploads) we check it verbatim; if ingest re-encoded it and dropped
// the in-file manifest, we re-attach the captured credential store so the provenance
// still surfaces (flagged, since a re-encode makes the binding read as modified).
export async function checkCredentials(cat: CatCtx, ref: AssetRef): Promise<void> {
  const { host } = cat;
  try {
    // Shared preparation (lib/verify-handoff.ts): fetch, TTS heal, captured-
    // credential re-attach - the same pipeline the #/verify?asset= deep link
    // runs cold, so this warm hop and a shared link reach the same verdict.
    const prep = await prepareAssetForVerify(host, ref);
    if (!prep) {
      announce(t('Could not open the credential checker for this asset.'));
      return;
    }
    if (prep.healed) {
      // The record now serves a fresh object URL - swap the grid's ref so a
      // later open or download reads the stamped bytes, not the stale URL.
      try {
        const fresh = await host.assets.get(ref.id);
        if (fresh) cat.assetById.set(ref.id, fresh);
      } catch { /* next reload catches up */ }
    }
    setPendingVerify({ files: prep.files, note: prep.note });
    // The address is shareable (plan 171): a cold #/verify?asset=<id> load
    // re-runs the same preparation; the in-memory handoff covers this hop.
    location.hash = `#/verify?asset=${encodeURIComponent(ref.id)}`;
  } catch {
    announce(t('Could not open the credential checker for this asset.'));
  }
}
// Opportunistic sibling of the heal in checkCredentials: when the details
// dialog opens on a user TTS clip, sniff its stored bytes for the RIFF C2PA
// chunk and re-stamp a pre-embed clip in the background, so the Check button
// (and any share or download) already reads credentialed bytes. Cheap on the
// miss: the meta.tts gate below filters everything else before any fetch.
export async function maybeHealTtsClip(cat: CatCtx, ref: AssetRef): Promise<void> {
  const { host } = cat;
  try {
    const { shouldHealTts, healTtsProvenance } = await import('../../lib/tts-provenance.ts');
    const bytes = new Uint8Array(await (await fetch(ref.url)).arrayBuffer());
    if (!shouldHealTts(ref, bytes)) return;
    if (!(await healTtsProvenance(host, ref, bytes))) return;
    const fresh = await host.assets.get(ref.id);
    if (fresh) cat.assetById.set(ref.id, fresh);
  } catch { /* best-effort - checkCredentials heals on click too */ }
}
// The canonical shareable link that reopens this modal from the catalog view.
export const assetLink = (_cat: CatCtx, ref: AssetRef): string =>
  `${location.origin}${location.pathname}#/c?asset=${encodeURIComponent(ref.id)}`;
// The previous/next asset for the details modal's lightbox paging - in on-screen grid
// order, skipping tiles inside a collapsed group so paging matches what's visible.
export function navRefs(cat: CatCtx, ref: AssetRef): { prev: AssetRef | null; next: AssetRef | null } {
  const { viewEl } = cat;
  const ids = [...viewEl.querySelectorAll<HTMLElement>('[data-open]')]
    .filter(el => !el.closest('.cat-group.is-collapsed'))
    .map(el => el.dataset.open!)
    .filter(Boolean);
  const i = ids.indexOf(ref.id);
  const at = (k: number): AssetRef | null => {
    const id = k >= 0 && k < ids.length ? ids[k] : undefined;
    return id ? cat.assetById.get(id) ?? null : null;
  };
  return { prev: i > 0 ? at(i - 1) : null, next: i >= 0 ? at(i + 1) : null };
}
export function sectionsOps(cat: CatCtx) {
  return {
    revealSwatches: bindOp(cat, revealSwatches),
    mountFavStrip: bindOp(cat, mountFavStrip),
    refreshFavStrip: bindOp(cat, refreshFavStrip),
    reflectFavInGrid: bindOp(cat, reflectFavInGrid),
    swatchesSectionHtml: bindOp(cat, swatchesSectionHtml),
    fontsSectionHtml: bindOp(cat, fontsSectionHtml),
    bodyHtml: bindOp(cat, bodyHtml),
    bulkBarHtml: bindOp(cat, bulkBarHtml),
    render: bindOp(cat, render),
    mountLottieThumbs: bindOp(cat, mountLottieThumbs),
    mountAudioThumbGrid: bindOp(cat, mountAudioThumbGrid),
    mountMotionThumbs: bindOp(cat, mountMotionThumbs),
    mountTextThumbGrid: bindOp(cat, mountTextThumbGrid),
    mountPdfThumbGrid: bindOp(cat, mountPdfThumbGrid),
    mountDropzone: bindOp(cat, mountDropzone),
    renderBody: bindOp(cat, renderBody),
    fillStorageChip: bindOp(cat, fillStorageChip),
    rerender: bindOp(cat, rerender),
    closeDetails: bindOp(cat, closeDetails),
    syncAssetUrl: bindOp(cat, syncAssetUrl),
    checkCredentials: bindOp(cat, checkCredentials),
    maybeHealTtsClip: bindOp(cat, maybeHealTtsClip),
    assetLink: bindOp(cat, assetLink),
    navRefs: bindOp(cat, navRefs),
  };
}
