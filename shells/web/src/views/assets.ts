// SPDX-License-Identifier: MPL-2.0
import { selectAssetFile, assetFiles } from '../lib/asset-files.ts';
import { parseFileAssetId } from '../../../../engine/src/asset-modifiers.ts';
/**
 * Assets view (route /#/a or /#/assets; the old /#/c and /#/catalog links forward here) -
 * the third top-level destination alongside Tools and Projects.
 *
 * A gallery-style page over EVERY asset the app knows: the shared SUSE catalog assets AND
 * the user's own uploaded images, unified into one grid grouped by category. Below the
 * grid sit two read-only reference panels: the brand Swatches (click-to-copy) and the
 * bundled Fonts (with download links).
 *
 * Per-asset actions, all persisted on the user PROFILE (see lib/asset-favourites.ts +
 * lib/asset-category.ts), never on the immutable catalog:
 *   ★ Favourite - pins the asset to a Favourites section here AND at the top of every
 *                    asset picker (lib/asset-favourites.ts, read by views/picker.ts).
 *   Recategorise… - override which library group an asset falls in (e.g. reclassify a
 *                    headshot as a background). Layers over the tag-derived category.
 *   Delete / Hide - a USER upload is truly deleted; a shared catalog asset can't be
 *                    (it's a permanent, checksum-validated contract) so it is HIDDEN from
 *                    this user's catalogue + every picker instead - reversible via the
 *                    "Show hidden" toggle.
 *
 * Asset management in /profile (headshot + storage meter) is untouched - this view is
 * additive. The user's headshot is excluded from the grid (it's managed there, and
 * deleting it would orphan profile.headshot).
 */

import { updateRouteParams } from '../lib/url-state.ts';
import '../styles/parts/platform.css';
import '../styles/parts/assets.css';
import { TYPE_FILTER_TYPES } from './assets-filter.ts';
import type { CatSort, TypeFilter } from './assets-filter.ts';
import { t, tRaw } from '../i18n.ts';
import { flushUndoToasts } from '../lib/undo-toast.ts';
import { announce } from '../a11y.ts';
import { claimSearchBar } from '../components/search-bar.ts';
import { cancelArrivalAah, playCatalogAah } from '../lib/sfx.ts';
import { closeConfirmDialogs } from '../components/confirm-dialog.ts';
import { LIB_GROUPS } from '../lib/asset-category.ts';
import { assetBaseId } from '../lib/asset-favourites.ts';
import { icon } from '../lib/icons.ts';
import { wireTileSelect } from '../lib/tile-select.ts';
import { wireArrowNav } from '../lib/arrow-nav.ts';
import { menuItemHtml, wireTileContextMenu } from '../lib/context-menu.ts';
import { wireEscapeClearsSelection } from '../lib/bulk-bar.ts';
import type { BulkBarConfig } from '../lib/bulk-bar.ts';
import { modDecoderAvailable } from '../lib/mod-render.ts';
import type { SwatchExportFormat } from '../lib/swatch-export.ts';
import { PALETTE } from '../palette.ts';
import { parseThemedAssetId, parseTreatedAssetId } from '@lolly/engine';
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';
import { DOWNLOAD_ICON, PENCIL_ICON, REPLACE_ICON, STAR_ICON, TAG_ICON, TRASH_ICON } from './assets/shared.ts';
import type { CatalogHost } from './assets/shared.ts';
import { actionsOps } from './assets/actions.ts';
import type { AssetPreviewOptions, CatCtx } from './assets/context.ts';
import { sourcesOps } from './assets/sources.ts';
import { tilesOps } from './assets/tiles.ts';
import { thumbsOps } from './assets/thumbs.ts';
import { filtersOps } from './assets/filters.ts';
import { sectionsOps } from './assets/sections.ts';
import { detailsOps } from './assets/details.ts';
import { userAssetsOps } from './assets/user-assets.ts';
import { bulkOps } from './assets/bulk.ts';
import { downloadsOps } from './assets/downloads.ts';
import { wiringOps } from './assets/wiring.ts';
import { readCardSize } from '../components/view-options.ts';


// Type only - the trim module itself is a lazy chunk, loaded when the action is used.


 // .plat-swatch* card/chip styles for the Swatches panel - catalog reuses swatch() but doesn't otherwise load platform.css, so a cold land-on-catalog (e.g. iOS) left the chips unstyled


// The shared "Reworded with Lolly" note - constants + a queued check only; the
// reworder facade behind it stays a lazy import (see wm-note.ts's header).


// The on-device model tier's shared seam (plans/126 WP-A): consent line,
// estimate row and honesty copy for the classifier check.


// The shared derived-asset provenance path (plans/148 WP-E) - lifted out of this
// view so the tool-side framing bake signs identically.


const COPY_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

interface ViewElement extends HTMLElement { _cleanup?: () => void; }

export async function mountCatalog(viewEl: HTMLElement, hostIn: HostV1, params = '', preview?: AssetPreviewOptions): Promise<void> {
  const cat = {} as CatCtx;
  cat.preview = preview;
  cat.sourceSelection = new URLSearchParams(params).get('sourceNode') || 'all';
  cat.sourcesOpen = window.innerWidth > 700; cat.sourceExpanded = new Set(); cat.sourceStatuses = []; cat.sourceCanManage = false; cat.sources = sourcesOps(cat);
  cat.actions = actionsOps(cat);
  cat.actionsPopover = null;
  cat.tiles = tilesOps(cat);
  cat.thumbs = thumbsOps(cat);
  cat.filters = filtersOps(cat);
  cat.sections = sectionsOps(cat);
  cat.details = detailsOps(cat);
  cat.userAssets = userAssetsOps(cat);
  cat.bulk = bulkOps(cat);
  cat.downloads = downloadsOps(cat);
  cat.wiring = wiringOps(cat);
  cat.viewEl = viewEl;
  cat.hostIn = hostIn;
  cat.params = params;

  const host = hostIn as CatalogHost; cat.host = host;
  // Titles the tab AND labels this view for the next view's back pill (lib/back-nav.ts).
  if (!preview) document.title = tRaw('{name} - Lolly', { name: t('Assets') });
  // Deep link: /#/a?asset=<id> focuses (scrolls to + highlights) that asset on load.
  const linkedAsset = new URLSearchParams(params).get('asset'); cat.linkedAsset = linkedAsset as CatCtx['linkedAsset'];
  // Deep link: /#/a?section=<key>[,<key>…] lands with those sections EXPANDED (over the
  // collapsed-by-default state) and scrolls the first into view - the section-level sibling
  // of ?asset=. Validated against ALL_SECTION_KEYS at apply time (below).
  const linkedSections = (new URLSearchParams(params).get('section') || '')
    .split(',').map(s => s.trim()).filter(Boolean); cat.linkedSections = linkedSections;

  // Live state, re-read on reload(); the render reads these closure vars.
  cat.profile = null;
  cat.allAssets = [];
  cat.assetById = new Map<string, AssetRef>();
  cat.assetPageSizes = new Map<string, number>();
  // Uploads on their way to the Trash (plan 277 P3): out of sight at once, while
  // the move is written. reload() filters them so a refresh in that moment can't
  // resurrect the tile.
  const pendingDeletes = new Set<string>(); cat.pendingDeletes = pendingDeletes;
  cat.trashCount = 0;
  cat.favSet = new Set<string>();
  cat.hiddenSet = new Set<string>();
  cat.overrides = {};
  // Lazily-built { assetId → lowercased search haystack }. Rebuilt on the first
  // matchesQuery of a search burst; invalidated whenever `overrides` (category labels
  // feed the haystack) or `allAssets` changes. Route every overrides write through
  // setOverrides so a future assignment can't leave a stale category label in search.
  cat.searchHaystack = null;
  cat.headshotUrl = '';
  // `#/a?hidden` and `#/a?type=<bucket>` seed the two grid filters for THIS mount -
  // the same read-only, consumed-on-mount contract as `?asset=`/`?section=`/`?q=`
  // above: never persisted, never written back into a generated link. Enough for a
  // shared link or a screenshot recipe to land on a known grid. `type` is checked
  // against the bucket table itself (a Set - an object lookup would answer yes to
  // 'constructor'); anything unrecognised leaves the default 'all' standing.
  cat.showHidden = new URLSearchParams(params).has('hidden');
  cat.loadFailed = false;                    // the catalog query threw - a total sync failure, distinct from an empty catalogue
  const urlType = new URLSearchParams(params).get('type'); cat.urlType = urlType as CatCtx['urlType'];
  cat.typeFilter = urlType && new Set<string>(['all', ...Object.keys(TYPE_FILTER_TYPES)]).has(urlType)
    ? urlType as TypeFilter
    : 'all';                                 // filetype filter in the sticky toolbar (all/image/vector/motion/audio/text)
  // Footer search text (lowercased); filters the asset grid. Seeded from #/a?q=… on
  // mount (plans/99 M0) with the same trim+lowercase the input handler applies.
  cat.query = (new URLSearchParams(params).get('q') || '').trim().toLowerCase();
  cat.iconThemes = [];          // two-colour pairings for themable icons (styler)
  cat.catIconTheme = null;    // colour applied to a themable category's grid (null = base)
  const iconSvgCache = new Map<string, string>(); cat.iconSvgCache = iconSvgCache;  // base SVG text per themable-icon id - the recolour source
  cat.photoTreatments = [];  // greyscale/duotone washes for raster photo groups (like iconThemes)
  cat.catPhotoTreatment = null; // treatment applied to a raster category's grid (null = original)
  const TREATMENT_FILTER_PREFIX = 'lolly-pt-'; cat.TREATMENT_FILTER_PREFIX = TREATMENT_FILTER_PREFIX; // id prefix for the injected <filter> defs (live CSS preview)
  const collapsed = new Set<string>(); cat.collapsed = collapsed;      // section keys folded; survives re-render + persisted (see COLLAPSE_KEY)
  cat.mounted = true;                        // false after the view swaps out (guards async)
  cat.firstPaint = true;                     // arm the entrance cascade only on the first render
  cat.dlDialog = null;        // the download dialog, if open
  cat.dlModal = null;
  cat.detailsDialog = null;   // the asset details modal, if open
  cat.detailsModal = null;
  // The active brand's palette (host.tokens, cached) - set once in reload() before
  // the first render; swatchesSectionHtml() reads this closure var synchronously.
  cat.palette = PALETTE;
  // The fonts THIS brand actually carries - its declared font tokens matched to
  // the bundled specs, plus any on-device Google fonts the user added. Replaces
  // the old hardcoded FONTS list so a custom brand no longer shows SUSE's faces.
  cat.catFonts = [];
  /** The user's per-asset cover overrides + the brand colour pool they resolve against.
   *  Both live for the mount: the pool is theme-dependent and the overrides are read on
   *  every tile paint, so re-deriving either per tile would be pure waste. */
  cat.coverMap = new Map();
  cat.coverPool = [];

  // Selected asset ids survive the render that replaces viewEl.innerHTML.
  // Catalog assets and uploads share selection; changes to files are upload-only.
  // Uses the Projects checkbox and floating bulk-bar pattern.
  const selected = new Set<string>(); cat.selected = selected;

  const tileSelect = wireTileSelect({
    host: viewEl,
    tiles: cat.tiles.selectableTiles,
    refOf: (tile) => tile.dataset.id!,
    current: () => new Set(selected),
    // Reconcile the Set to exactly `refs`, then repaint in place - called on every marquee
    // frame, so a re-render here would drop scroll/focus and kill the drag.
    setRefs: (refs) => {
      selected.clear();
      for (const id of refs) selected.add(id);
      for (const tile of viewEl.querySelectorAll<HTMLElement>('.cat-tile')) {
        const on = selected.has(tile.dataset.id ?? '');
        tile.classList.toggle('is-selected', on);
        tile.querySelector('.cat-check')?.setAttribute('aria-pressed', String(on));
      }
      cat.bulk.syncSelectAll();
      cat.bulk.syncBulkBar();
    },
    clear: () => cat.bulk.handleBulk('clear'),
    // Never start a box on a card, control, bar, drop zone, or the favourites strip (it has
    // its own drag-to-scroll) - only in a genuine gap. `.cat-toolbar` earns its place: it's a
    // STICKY pill floating over the grid, so its padding and flex gaps read as empty canvas
    // while actually sitting on top of the cards - a press there is aiming at the toolbar.
    noStart: '.cat-tile, button, a, input, label, textarea, select, dialog, .cat-bulkbar, '
      + '.cat-toolbar, .cat-fav-strip, .featured, .gallery-topbar, .gallery-footer, .updz, '
      + '[data-dropzone-mount], .cat-dl-section, .cat-uploads-bar',
    // Keyboard grid (plans/132 WP-L): arrows/Space/Cmd-A from the shared model;
    // Delete soft-deletes uploads (catalog assets are a permanent contract -
    // they are silently skipped); F2 renames a single upload.
    keyboard: {
      remove: (refs) => {
        const uploads = refs.map(id => cat.assetById.get(id)).filter((r): r is AssetRef => !!r && r.source === 'user');
        if (uploads.length) cat.userAssets.softDeleteUploads(uploads);
      },
      rename: (ref) => {
        const a = cat.assetById.get(ref);
        if (a && a.source === 'user') void cat.userAssets.renameUserAsset(a);
      },
    },
  }); cat.tileSelect = tileSelect;
  const tileMenu = wireTileContextMenu({
    host: viewEl,
    tileSelector: '.cat-tile[data-id], .cat-fav-strip .ftile[data-tool]',
    refOf: (tile) => tile.dataset.id ?? tile.dataset.tool ?? null,
    tileAt: (x, y) => cat.featuredHandle?.tileAt(x, y) ?? null,
    isBulkTarget: (id, tile) => !tile.closest('.cat-fav-strip') && selected.size > 1 && selected.has(id),
    singleHtml: (tgt) => tgt.tile?.closest('.cat-fav-strip')
      ? menuItemHtml('fav', STAR_ICON, t('Unfavourite')) + menuItemHtml('share-favourite', icon('share'), t('Share'))
      : cat.tiles.catTileMenuHtml(tgt.ref),
    bulkHtml: () => cat.tiles.catBulkMenuHtml(),
    onAction: (act, tgt) => {
      if (act === 'fav' && tgt?.tile?.closest('.cat-fav-strip')) {
        void cat.userAssets.toggleFavourite(tgt.ref);
        return;
      }
      void cat.tiles.onTileMenuAction(act, tgt?.ref ?? null);
    },
  }); cat.tileMenu = tileMenu;

  // Favourites strip presentation - the same cinematic component as the Tools hero,
  // with a Gallery ↔ Cover Flow view mode and an on/off switch, both persisted. Kept
  // shorter than the hero (the previews shouldn't dominate the page here).
  const FAV_VIEW_KEY = 'lolly-catalog-fav-view'; cat.FAV_VIEW_KEY = FAV_VIEW_KEY;
  const FAV_STRIP_KEY = 'lolly-catalog-fav-strip'; cat.FAV_STRIP_KEY = FAV_STRIP_KEY;
  cat.favView = 'coverflow';
  cat.favStripOn = true;
  cat.featuredHandle = null;   // the mounted favourites strip, if any
  cat.lottieThumbs = null;   // on-screen-gated lottie grid autoplayer
  cat.audioThumbs = null;    // on-screen-gated waveform upgrader
  cat.textThumbs = null;     // on-screen-gated text-excerpt upgrader
  cat.motionThumbs = null;   // intent gate for every video thumbnail
  cat.pdfThumbs = null;      // on-screen-gated PDF first-page upgrader
  cat.emojiSpecimens = null; // on-screen-gated emoji-set specimen drawer
  cat.viewOptsOpen = false;
  cat.closeViewOpts = () => {};              // set in wire(); called on teardown
  // Section sort (plans/132 WP-A) - applied per section, persisted per device.
  // Last modified is the DEFAULT (Andy, 2026-08-20 - matches Projects): uploads
  // lead with what was touched most recently; catalog assets carry no dates, so
  // the stable sort leaves their curated order untouched. The menu's 'Default'
  // option = the curated manifest order (uploads newest-first from the bridge).
  const SORT_PREF_KEY = 'lolly-catalog-sort'; cat.SORT_PREF_KEY = SORT_PREF_KEY;
  // Layout + density (plans/132 WP-I): grid (default) | list rows, and a
  // comfortable | compact tile size. Both persisted, both pure CSS classes.
  const LAYOUT_PREF_KEY = 'lolly-catalog-layout'; cat.LAYOUT_PREF_KEY = LAYOUT_PREF_KEY;
  const DENSITY_PREF_KEY = 'lolly-catalog-density'; cat.DENSITY_PREF_KEY = DENSITY_PREF_KEY;
  cat.catLayout = localStorage.getItem(LAYOUT_PREF_KEY) === 'list' ? 'list' : 'grid';
  cat.catDensity = localStorage.getItem(DENSITY_PREF_KEY) === 'compact' ? 'compact' : 'comfortable';
  cat.cardSize = readCardSize('catalog');
  const CAT_SORTS: readonly CatSort[] = ['default', 'name', 'added', 'modified', 'size', 'type']; cat.CAT_SORTS = CAT_SORTS;
  cat.catSort = 'modified';
  try {
    const stored = localStorage.getItem(SORT_PREF_KEY) as CatSort | null;
    if (stored && CAT_SORTS.includes(stored)) cat.catSort = stored;
  } catch { /* storage off */ }
  cat.catSortRev = false;
  try { cat.catSortRev = localStorage.getItem(`${SORT_PREF_KEY}-rev`) === '1'; } catch { /* storage off */ }
  try {
    const v = localStorage.getItem(FAV_VIEW_KEY);
    if (v === 'coverflow' || v === 'gallery') cat.favView = v;
    if (localStorage.getItem(FAV_STRIP_KEY) === 'off') cat.favStripOn = false;
  } catch { /* storage off */ }

  // Section fold state persists across reloads (like the fav-strip prefs above).
  // First-visit default (2026-08-20 audit): the ASSET sections open - a library
  // should lead with its content, not a stack of closed headers - with only the
  // reference material (swatches/fonts) folded. Once the user touches any fold
  // the stored set is the whole truth, exactly as before.
  const COLLAPSE_KEY = 'lolly-catalog-collapsed'; cat.COLLAPSE_KEY = COLLAPSE_KEY;
  const ALL_SECTION_KEYS = ['your-uploads', ...LIB_GROUPS.map(g => g.key), 'emoji-sets', 'hidden', 'swatches', 'fonts']; cat.ALL_SECTION_KEYS = ALL_SECTION_KEYS;
  const FIRST_VISIT_COLLAPSED = ['swatches', 'fonts']; cat.FIRST_VISIT_COLLAPSED = FIRST_VISIT_COLLAPSED;
  try {
    const stored = localStorage.getItem(COLLAPSE_KEY);
    const keys = stored ? (JSON.parse(stored) as string[]) : FIRST_VISIT_COLLAPSED;
    for (const k of keys) collapsed.add(k);
  } catch { for (const k of FIRST_VISIT_COLLAPSED) collapsed.add(k); }

  // aiSignalsChip moved to lib/genai-pill.ts (shared with the asset picker so
  // the risk shows at the moment an ingredient is chosen).
  /** Inline passport credential results, per id|version - hashing an asset's
   *  bytes is not free, and paging back should be. */
  const PASSPORT_CRED_CACHE = new Map<string, { found: boolean; state: string; trusted: boolean } | null>(); cat.PASSPORT_CRED_CACHE = PASSPORT_CRED_CACHE;
  // Tracker modules (.xm/.it/.mod) are song data the libopenmpt worker renders to PCM.
  // Where that decoder cannot instantiate there is nothing to play, so the cards go
  // rather than sit there with a note glyph (Andy, 2026-09-03). Optimistic until the
  // probe answers - the healthy path never flickers - and a false answer repaints.
  cat.modulesPlayable = null;
  void modDecoderAvailable().then((ok) => {
    cat.modulesPlayable = ok;
    if (!ok) cat.sections.rerender();
  });

  // Swatches + Fonts are collapsible groups too (same shell as the asset categories), so
  // "Collapse all" folds them and the whole page reads as one uniform stack of sections.
  // Their rich bodies keep the existing .cat-panel-* / .plat-* styling. `cat-group--ref`
  // draws a divider above the first one to set the reference zone apart from the assets.
  // The Swatches section's download row - the palette AS SHOWN (live-resolved
  // brand tokens: catalog-shipped colours plus everything added in the brand
  // editor), in each format a designer/dev workflow expects. Clickable links,
  // matching the Fonts section's convenience; wired in the body click handler.
  const SWATCH_DOWNLOADS: { fmt: SwatchExportFormat; label: string }[] = [
    { fmt: 'tokens-json', label: 'Design tokens (JSON)' },
    { fmt: 'css-vars', label: 'CSS variables' },
    { fmt: 'css-classes', label: 'CSS classes' },
    { fmt: 'scss', label: 'SCSS variables' },
    { fmt: 'ase', label: 'Adobe swatches (.ase)' },
    { fmt: 'gpl', label: 'GIMP palette (.gpl)' },
  ]; cat.SWATCH_DOWNLOADS = SWATCH_DOWNLOADS;

  // Floating bulk-action bar for selected assets - markup + sync live in
  // lib/bulk-bar.ts (shared with projects and the gallery); this view supplies its
  // action set. Rendered once per render(); shown/populated by syncBulkBar().
  // Downloads apply to catalog assets and uploads. Actions that modify library
  // files remain restricted to the user's own uploads.
  const bulkBarCfg: BulkBarConfig = {
    prefix: 'cat-bulkbar',
    rootSelector: '.catalog',
    count: () => selected.size,
    actions: [
      { id: 'open-with', icon: icon('externalLink'), label: () => t('Open with'), disabled: () => !cat.actions.choices(cat.actions.selection()).length, title: () => cat.actions.choices(cat.actions.selection()).length ? t('Open the selection in a compatible tool') : t('No tool accepts this selection.') },
      { id: 'convert', icon: icon('duplicate'), label: () => t('Convert'), disabled: () => !cat.actions.canConvert(cat.actions.selection()), title: () => cat.actions.canConvert(cat.actions.selection()) ? t('Choose a supported transformation') : t('No conversion accepts this selection.') },
      { id: 'compare', icon: icon('duplicate'), label: () => t('Compare'), hidden: () => !cat.bulk.canCompareSelection() },
      { id: 'fav', icon: STAR_ICON, label: () => (cat.bulk.allSelectedFav() ? t('Unfavourite') : t('Favourite')) },
      { id: 'add-to-project', icon: icon('folder'), label: () => t('Add to project'), title: () => t('Reference the selection into a project folder - nothing is copied, the files stay in Assets') },
      { id: 'download', icon: DOWNLOAD_ICON, label: () => selected.size > 1 ? t('Download selection') : t('Download'), title: () => t('Download the selected files as one ZIP') },
      { id: 'hide', icon: icon('eye'), label: () => (cat.bulk.allSelectedHidden() ? t('Unhide') : t('Hide')) },
      { id: 'replace', icon: REPLACE_ICON, label: () => t('Replace'), title: () => t('Swap in a new file, keeping the same image - every saved session, tool and project that uses it updates to the new one'), hidden: () => !cat.bulk.singleSelectedUploadRef() },
      { id: 'rename', icon: PENCIL_ICON, label: () => t('Rename'), title: () => t('Change this upload’s name'), hidden: () => !cat.bulk.singleSelectedUploadRef() },
      { id: 'edit-tags', icon: TAG_ICON, label: () => t('Edit tags'), title: () => t('Set one comma-separated tag list on every selected upload'), hidden: () => !cat.bulk.allSelectedUploads() },
      { id: 'duplicate', icon: COPY_ICON, label: () => t('Duplicate'), title: () => t('Make a copy of each selected image - the copies are selected, ready to move or edit'), hidden: () => !cat.bulk.allSelectedUploads() },
      { id: 'delete', icon: TRASH_ICON, label: () => t('Delete'), extraClass: 'cat-bulk-danger', hidden: () => !cat.bulk.allSelectedUploads() },
    ],
  }; cat.bulkBarCfg = bulkBarCfg;

  // The mounted upload dropzone's teardown, if any (lib/upload-dropzone.ts).
  cat.dropzoneDispose = null;

  // ── asset details modal ─────────────────────────────────────────────────────────
  // Opened by clicking a tile OR by a share deep link (/#/a?asset=<id>). Holds the big
  // preview, metadata, and every per-asset action, so a shared link resolves to a real
  // destination (this modal over the catalog), not a bare download.
  // Dispose hook for the audio preview's level meter (attachAudioMeter). openDetails
  // always closeDetails()-es first - including ←/→ paging - so this can't leak.
  /** The details modal's meter handle - its dispose, plus accessors for the AnalyserNode
   *  and context the MilkDrop preview must SHARE (one MediaElementSource per element). */
  cat.detailsMeterDispose = null;
  /** The themed transport driving the preview's <audio> - disposed with the modal. */
  cat.detailsTransport = null;
  /** Releases the details modal's live visualiser (its WebGL2 context) + key handler. */
  cat.vizTeardown = null;
  cat.vizCycleStop = null;

  /** Guards against re-entering the warm-up: mountFavStrip re-runs on every favourite
   *  toggle, and each run would otherwise re-queue the same derives. */
  cat.warmingFavArt = false;

  // Escape drops the selection (yielding to any open menu/dialog/field first) - 
  // the keyboard exit the ✕ button and an empty-canvas click already provide.
  const unwireEscape = wireEscapeClearsSelection({
    active: () => cat.mounted && selected.size > 0,
    clear: () => cat.bulk.handleBulk('clear'),
  }); cat.unwireEscape = unwireEscape;

  // ── Where-used (plans/132 WP-G) ─────────────────────────────────────────
  // A lazy reverse index over saved sessions: each session's stored data as one
  // JSON string, scanned for an asset's base id. Built once per mount on first
  // demand (details open / Replace confirm); sessions are local IndexedDB reads.
  cat.sessionTexts = null;
  cat.sessionTextsLoading = null;

  // ── mount ──────────────────────────────────────────────────────────────────────
  if (preview) {
    cat.releaseSearch = () => {};
    (viewEl as ViewElement)._cleanup = () => {
      cat.mounted = false;
      cat.actionsPopover?.close();
      tileSelect.destroy();
      tileMenu.destroy();
      unwireEscape();
      cat.sections.closeDetails();
      cat.downloads.closeDownloadDialog();
    };
    await cat.tiles.reload();
    if (!cat.mounted) return;
    cat.details.openDetails(cat.assetById.get(preview.ref.id) ?? preview.ref);
    return;
  }
  // A lighter, brighter arrival "ahhh" led in by four rising "stacking" clicks - the catalog's
  // counterpart to the gallery's bassy one. One-shot, gesture-gated, silent when sound's off.
  const browse = new URLSearchParams(params);
  if (CAT_SORTS.includes(browse.get('sort') as CatSort)) cat.catSort = browse.get('sort') as CatSort;
  if (browse.has('rev')) cat.catSortRev = browse.get('rev') !== '0';
  if (browse.get('view') === 'gallery' || browse.get('view') === 'coverflow') cat.favView = browse.get('view') as CatCtx['favView'];
  if (browse.has('favourites')) cat.favStripOn = browse.get('favourites') !== '0';
  playCatalogAah();
  // Claim the shell's persistent search bar (plans/99 M1). The tap applies the same
  // trim+lowercase the old inline handler did, so filtering is byte-identical.
  const releaseSearch = claimSearchBar({
    placeholder: t('Search Assets…'),
    ariaLabel: t('Search Assets'),
    value: cat.query,
    onQuery: (raw) => {
      if (!cat.mounted) return;
      const q = raw.trim().toLowerCase();
      if (q === cat.query) return;
      cat.query = q;
      updateRouteParams({ q: q || null });
      cat.sections.renderBody();
    },
  }); cat.releaseSearch = releaseSearch;
  viewEl.addEventListener('dragstart', cat.wiring.onTileDragStart);
  // Arrow keys walk every asset tile once one has focus (lib/arrow-nav.ts). The
  // multi-select above only covers your own uploads, so this is what reaches the
  // catalogue's tiles.
  const unwireArrows = wireArrowNav(viewEl, { items: '.cat-tile', primary: '.cat-tile-open' });

  (viewEl as ViewElement)._cleanup = () => {
    unwireArrows(); cat.uploadToolbarDispose?.();
    cat.mounted = false; cat.sourceDispose?.();
    cat.actionsPopover?.close();
    viewEl.removeEventListener('dragstart', cat.wiring.onTileDragStart);
    // Deferred deletions must not outlive the view that owns their Undo.
    flushUndoToasts();
    cancelArrivalAah();
    releaseSearch();
    // Not optional: the marquee's mousedown is bound to viewEl (#view), which the router
    // REUSES for every route - leave it bound and the next mount stacks another copy.
    tileSelect.destroy();
    tileMenu.destroy();
    unwireEscape();
    cat.featuredHandle?.destroy();
    cat.featuredHandle = null;
    cat.lottieThumbs?.destroy();
    cat.lottieThumbs = null;
    // Leaving the view must also abandon any waveform decode still running, or a finished
    // analysis paints into a grid that is no longer on screen.
    cat.audioThumbs?.destroy();
    cat.audioThumbs = null;
    cat.textThumbs?.destroy();
    cat.textThumbs = null;
    cat.motionThumbs?.destroy();
    cat.motionThumbs = null;
    // …and stop drawing emoji specimens: a pack that finishes loading after the
    // view is gone must not paint into a grid nobody is looking at.
    cat.emojiSpecimens?.destroy();
    cat.emojiSpecimens = null;
    cat.closeViewOpts();
    cat.sections.closeDetails();
    cat.downloads.closeDownloadDialog();
    closeConfirmDialogs();
  };

  // Loading skeleton (plans/132 WP-M): a toolbar shell and one quiet grid row
  // paint immediately while reload() is in flight, replaced wholesale by the
  // first real render(). Static markup, no events, no motion - so it needs no
  // reduced-motion gate and can never leak wiring.
  viewEl.innerHTML = `
    <div class="catalog cat-skeleton" aria-hidden="true">
      <div class="cat-skel-toolbar"><span class="cat-skel-pill"></span><span class="cat-skel-pill"></span><span class="cat-skel-pill cat-skel-pill--wide"></span></div>
      <div class="cat-skel-grid">${'<span class="cat-skel-tile"></span>'.repeat(6)}</div>
    </div>`;
  await cat.tiles.reload();
  if (!cat.mounted) return;
  // Deep link: apply the validated section list before paint for this visit.
  // Reading the override leaves the saved collapsed preference untouched.
  void cat.sources.refresh();
  const sourcePoll = setInterval(() => { if (cat.mounted && document.visibilityState === 'visible') void cat.sources.refresh(); }, 60_000);
  const priorCleanup = (viewEl as ViewElement)._cleanup;
  (viewEl as ViewElement)._cleanup = () => { clearInterval(sourcePoll); priorCleanup?.(); };
  const openTargets = linkedSections.filter(k => ALL_SECTION_KEYS.includes(k)); cat.openTargets = openTargets;
  if (new URLSearchParams(params).has('section')) {
    for (const k of ALL_SECTION_KEYS) collapsed.add(k);
    for (const k of openTargets) collapsed.delete(k);
  }
  cat.sections.render();
  // …then scroll the first linked section into view. The favourites hero + first images grow
  // the layout above the target during the opening moments and reset an early scroll, so we
  // re-measure and re-scroll across that window; the later passes land once it settles.
  if (openTargets.length) {
    const firstKey = openTargets.find(k => viewEl.querySelector(`.cat-group[data-group="${k}"]`));
    const scrollToSection = (smooth: boolean): void => {
      const el = firstKey ? viewEl.querySelector<HTMLElement>(`.cat-group[data-group="${firstKey}"]`) : null;
      if (!el || !cat.mounted) return;
      window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 72), behavior: smooth ? 'smooth' : 'auto' });
    };
    setTimeout(() => scrollToSection(true), 400);
    setTimeout(() => scrollToSection(false), 900);
    setTimeout(() => scrollToSection(false), 1500);
  }
  // Deep link: open the shared asset's details modal over the catalog once it's painted.
  // A styled id opens the base asset with its colour pre-selected + applied - an icon theme
  // (…?theme=<id>) or a photo treatment (…?treatment=<id>). An id carries at most one.
  if (linkedAsset) {
    const { theme } = parseThemedAssetId(linkedAsset);
    const { treatment } = parseTreatedAssetId(linkedAsset);
    const baseId = assetBaseId(linkedAsset);   // strips ?theme= AND ?treatment=
    const ref = cat.assetById.get(baseId)
      ?? cat.assetById.get(linkedAsset)
      ?? [...cat.assetById.values()].find(a => assetBaseId(a.id) === baseId);
    const fileId = parseFileAssetId(parseThemedAssetId(linkedAsset).theme ? parseThemedAssetId(linkedAsset).baseId : parseTreatedAssetId(linkedAsset).baseId).file;
    const file = fileId && assetFiles(ref?.meta).find(f => f.id === fileId);
    if (ref && (!fileId || file)) cat.details.openDetails(file ? selectAssetFile(ref, file) : ref, theme, treatment);
    else {
      // The deep-linked asset isn't in this user's catalogue (never synced, a deleted upload,
      // or an unknown id) - report it instead of a silent no-op: announce() for assistive tech,
      // plus a brief self-clearing line at the top of the grid so a sighted user sees it too.
      announce(t('That asset isn’t in Assets'));
      const bodyEl = viewEl.querySelector<HTMLElement>('.catalog-body');
      if (bodyEl) {
        const note = document.createElement('p');
        note.className = 'cat-empty';
        note.style.cssText = 'padding:0.85rem 1rem';
        note.textContent = t('That asset isn’t in Assets.');
        bodyEl.insertBefore(note, bodyEl.firstChild);
        setTimeout(() => note.remove(), 6000);
      }
    }
  }
}
