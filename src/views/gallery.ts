// SPDX-License-Identifier: MPL-2.0
/**
 * Gallery view - preview-forward masonry of available tools.
 *
 * Each tool is a card. When the tool has a saved session, the card leads with a
 * preview of the most-recent one at its natural aspect (portrait previews show
 * in full - no crop, no letterbox); the masonry packs the varying heights.
 * Tools with no session show a compact "open to start" tile instead.
 *
 * Feature flags hide whole categories; the remaining categories surface as
 * single-select filter pills, so any mix of flags just reflows the grid.
 *
 * Cards carry no per-card action buttons: every tile action (favourite, keep
 * offline, About, saved sessions, hide, copy link) lives in the right-click /
 * long-press context menu and in the selection toolbar (select a tile via its
 * bottom-left dot). The About dialog and the history dialog are those actions'
 * modals.
 */

import { escape } from '../utils.ts';
import { presentApis } from '@lolly-tools/core';
import { isHiddenSlot } from '../lib/batch-slots.ts';
import { t, tRaw } from '../i18n.ts';
import { icon } from '../lib/icons.ts';
import { claimSearchBar, clearSearchBar, setSearchBarValue } from '../components/search-bar.ts';
import { fold, tokenize, scoreHaystack, type SearchField } from '../lib/search/match.ts';
import { toolSupport, capabilityLabel } from '../capabilities.ts';
import { hiddenCategories, perfUiOn } from '../feature-flags.ts';
import { canStartCollab, startCollab } from '../lib/collab-availability.ts';
import { syncCatalog, prefetchAssetsById, defaultHiddenToolIds } from '../catalog/sync.ts';
import { pinTool, unpinTool, pinnedToolIds, pinnedRenderLayouts } from '../lib/offline-pins.ts';
import { getInjectedTools } from '../lib/injected-tools.ts';
import { LEAD_TOOL_ORDER } from '../lib/lead-tools.ts';
import { instanceFetch, instancePath } from '../lib/instance.ts';
import { privacyNoticeMarkup, mountPrivacyNotice } from './privacy-notice.ts';
import { personalizeNudgeMarkup, mountPersonalizeNudge } from './personalize-nudge.ts';
import { offlineNudgeMarkup, mountOfflineNudge } from './offline-nudge.ts';
import { profileSignature, canPersonalize, regeneratePreviews } from '../personalize-previews.ts';
import { viewTopbarHtml, mountViewTopbar } from '../components/view-topbar.ts';
import { mountFeaturedRow, resolveExamples } from '../components/featured-row.ts';
import { previewMedia, isHtmlPreview, armMotionPreviews, playMotionIn, stopMotionIn } from '../lib/preview-media.ts';
import { bundledLook } from '../lib/preview-bundle.ts';
import { renderFeaturedVariant, renderFeaturedPages, displayFormatOf } from '../lib/featured-render.ts';
import { currentTheme } from '../theme.ts';
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';
import { segHtml } from '../lib/seg.ts';
import { wireDisclosure } from '../components/body-popover.ts';
import type { FeaturedEntry, FeaturedManifest, FeaturedVariant, FeaturedRowHandle, FeaturedViewMode } from '../components/featured-row.ts';
import { loadFavourites, saveFavourites } from '../lib/favourites.ts';
import { loadHiddenTools, saveHiddenTools } from '../lib/hidden-tools.ts';
import { wireTileSelect } from '../lib/tile-select.ts';
import { startJob } from '../lib/jobs.ts';
import type { BulkBarConfig } from '../lib/bulk-bar.ts';
import { mountModal } from '../components/modal.ts';
import { planCopies } from '../lib/plan-copies.ts';
import { MULTI_EDIT_MAX } from '../lib/multi-edit-limits.ts';
import type { PickerHost } from './picker.ts';
import { announce } from '../a11y.ts';
import { playSfx, playGalleryAah, cancelArrivalAah } from '../lib/sfx.ts';
import { sessionRow, CHECK_ICON } from '../folder-tiles.ts';

import type { HostV1, StateEntry } from '@lolly-tools/core/host-v1';
import { toolSeedHref } from '../lib/seed-url.ts';
import type { WebStateAPI } from '../bridge/state.ts';
import type { WebProfileAPI } from '../bridge/profile.ts';
import type { createAssetsAPI } from '../bridge/assets.ts';
import type { WebTokensAPI } from '../bridge/tokens.ts';
import type { PreviewsAPI, PreviewRecord } from '../bridge/previews.ts';
import { activeDesignSystemSource } from '../lib/design-system/active.ts';

/**
 * The slice of a catalog index entry that this view reads. Kept local: the index
 * is a denormalised, gallery-facing projection of the tool manifest, not a domain
 * type the engine owns.
 */
interface GalleryTool {
  id: string;
  name: string;
  description?: string;
  /** Pristine English name/description, stashed by catalog/sync.ts's
   *  localizeToolIndex before it overlays a translation - searched alongside
   *  the localized strings so "compress" finds Compress PDF in any session
   *  language (plans/99 section 2e). Absent in English sessions. */
  en?: { name?: string; description?: string };
  version?: string;
  status?: string;
  category?: string;
  capabilities?: readonly string[];
  privacy?: string;
  tags?: readonly string[];   // searched alongside name/description; never displayed
  listed?: boolean;   // false = unlisted from the gallery (a mechanism invoked from context, e.g. asset-export)
  formats?: readonly string[];
  width?: number;
  height?: number;
  unit?: string;
  exportable?: boolean;
  /** YYYY-MM-DD the tool was first added to its pack (index `added`, from the
   *  committed git-derived map). Info-dialog only - the retired "New" badge's
   *  honest replacement. Full index only, absent on the slim boot cut. */
  added?: string;
  icon?: string;
  preview?: string;
  /** The tool's MOTION preview (tools/<id>/card.webm or an APNG card.png), when its content
   *  genuinely animates - see lib/preview-media.ts. `preview` stays the still poster; this
   *  file is fetched only once a hover, a focus or the centered tile asks for it. */
  anim?: string;
  personalized?: boolean;
  featured?: FeaturedManifest;
  examples?: FeaturedVariant[];
  paged?: boolean;
  new?: boolean;
  /** URL-mode query an injected url-source tool opens with (#/tool/<id>?<openQuery>). */
  openQuery?: string;
  /** "New from template" starting points - METADATA ONLY (the index never carries
   *  the heavy values seed; see scripts/build-catalog-index.ts). Listed in the
   *  info dialog; each deep-links to #/tool/<id>?template=<tid>. A template's
   *  `presets` (plans/142) are its curated variants - id/name(/description) only;
   *  a preset deep-links as ?template=<tid>&preset=<pid>. */
  templates?: Array<{
    id: string; name: string; category?: string; description?: string; thumb?: string;
    presets?: Array<{ id: string; name: string; description?: string }>;
  }>;
}

// Sort options for the gallery masonry. 'category' groups tools by
// their catalog category (offline utilities last, see categoryRank); 'recent' (the default)
// surfaces the most recently-added tools first - the featured content the hero leads with.
type SortKey = 'recent' | 'az' | 'za' | 'format' | 'category';
const SORT_KEYS: readonly SortKey[] = ['recent', 'az', 'za', 'format', 'category'];
const SORT_LABELS: Record<SortKey, string> = {
  recent: 'Recently updated',
  az: 'Name (A–Z)',
  za: 'Name (Z–A)',
  format: 'Format',
  category: 'Category',
};
const SORT_KEY_STORAGE = 'lolly-gallery-sort';
// Featured hero view mode: the current strip ('gallery') or the Cover Flow player-select.
const FEATURED_VIEWS: readonly FeaturedViewMode[] = ['gallery', 'coverflow'];
const FEATURED_VIEW_LABELS: Record<FeaturedViewMode, string> = { gallery: 'Gallery', coverflow: 'Cover Flow' };
const FEATURED_VIEW_STORAGE = 'lolly-featured-view';
// Sort DIRECTION, orthogonal to the key: 'desc' is each label's natural order
// (Recently updated = newest first, A→Z, …); 'asc' reverses it so the last
// results show first. Persisted alongside the sort key.
type SortDir = 'desc' | 'asc';
const SORT_DIR_STORAGE = 'lolly-gallery-sort-dir';
// Fixed leads for the default browse order ('recent' sort, which every fresh
// install starts on) - lib/lead-tools.ts, shared with the native app menus.
// Only the default sort pins them - picking any sort in the filter popover, or
// reversing direction, behaves exactly as labelled.
const leadRank = new Map(LEAD_TOOL_ORDER.map((id, i) => [id, i]));
// Most example looks a gallery tile's preview strip will show (after the lead slide).
// Keeps the carousel DOM + the number of live renders per tile bounded.
const EXAMPLE_MAX = 6;
// How many tiles count as "above the fold" for image priority. Roughly two masonry rows
// on a desktop viewport and the first three or four cards on a phone - deliberately a
// small over-estimate, since an eager tile the user never sees costs one preview file,
// while having NO eager tile costs the page its LCP candidate.
const EAGER_TILES = 8;
// Same, for a mount that also shows the featured hero row. The strip pushes the grid down by
// its own height, so only about the first masonry row is still above the fold - and the hero's
// own first tile is already eager + fetchpriority=high (featured-row.ts tileMarkup) and sits
// ABOVE the masonry in document order, so it wins the equal-priority race and is the LCP
// candidate. Hinting all eight grid tiles here would only put them in that image's way.
const EAGER_TILES_WITH_HERO = 4;
// How many manifest-curated tools stand in for a first-run visitor's (empty) favourites in the
// hero strip - see firstRunFeatured(). About one screen of the filmstrip and a full Cover Flow
// fan; a first visit should read as a curated shelf, not the catalog listed twice. Set to 0 to
// go back to a flat grid on first run - it is the only switch this behaviour has.
const FIRST_RUN_FEATURED_MAX = 6;
/** What the UTILITIES shelf promotes for a visitor who has never starred anything,
 *  in this order (Andy, 2026-09-03: "if we must have favourites in the utility view,
 *  they should be verify, jump, sandbox, unpack"). Two are view cards (`view:` keys,
 *  see utilityViews) and two are tools, so this cannot live in tool data the way the
 *  main shelf's `featured.order` does; the main shelf is untouched. Derived, never
 *  written to the profile - the first star replaces it with the user's own list. */
const UTILITY_FIRST_RUN: readonly string[] = ['view:verify', 'jump', 'sandbox', 'view:pdf-extract'];

// Fit a page of aspect `ar` (width / height) inside the square deck box (hydratePaged),
// as width/height percentages of that square. A landscape page keeps full width and loses
// height; a portrait page keeps full height and loses width; a square page fills it. Extreme
// aspects (a 5:1 banner → h 20%, a 1:5 vertical banner → w 20%) stay true to shape - the fan
// offset is applied by the outer layer in box units, so the deck still reads as a stack even
// when each sheet is a thin strip. The card element is then sized to the page's TRUE shape,
// so its shadow + hairline rim wrap the real page rather than a letterboxed square.
function deckPageFit(ar: number): { w: number; h: number } {
  if (!(ar > 0) || !Number.isFinite(ar)) return { w: 100, h: 100 };
  return ar >= 1 ? { w: 100, h: 100 / ar } : { w: 100 * ar, h: 100 };
}

/** A saved-session entry as returned by host.state.list(). */
type SavedEntry = StateEntry & { filename: string | null; thumb: string | null };

/**
 * The host surface the gallery touches: HostV1 plus the web-shell extras this view
 * uses (WebStateAPI's richer list/sizes, WebProfileAPI's set, the concrete assets
 * factory's private user-asset helpers, and the previews cache). The web shell's
 * concrete WebHost interface is not exported, so this is reconstructed from the
 * factory return types.
 */
type GalleryHost = HostV1 & {
  state: WebStateAPI;
  profile: WebProfileAPI;
  assets: ReturnType<typeof createAssetsAPI>;
  tokens?: WebTokensAPI;
  previews?: PreviewsAPI;
};

// Section order for the filter pills. 'utility' is intentionally absent: the
// on-device Offline Utilities pill always sorts last (see categoryRank()).
const CATEGORY_ORDER = ['everyone', 'designer', 'event', 'product'];

function categoryRank(cat: string): number {
  if (cat === 'utility') return Infinity;
  const i = CATEGORY_ORDER.indexOf(cat);
  return i === -1 ? CATEGORY_ORDER.length : i;
}

// Short category names for the filter pills / card sub-lines - distinct from the
// longer feature-flag labels (e.g. "Tools for Everyone") shown in profile settings.
const CAT_LABEL: Record<string, string> = { everyone: 'Everyone', designer: 'Designer', event: 'Event', utility: 'Utilities' };
const catLabel = (c: string | undefined) => CAT_LABEL[c as string] || (c ? c[0]!.toUpperCase() + c.slice(1) : 'Other');
const statusLabel = (s: string | undefined) => ({ official: 'Official', community: 'Community', experimental: 'Experimental' } as Record<string, string>)[s as string] || s;
// The info dialog's "Added" line: the index's YYYY-MM-DD in the viewer's own
// date order (toLocaleDateString picks up the browser locale, same convention
// as the Projects tiles' dates). Noon UTC so no timezone shifts the DAY.
const addedDateText = (iso: string): string => {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

// Export-format display labels (mirrors the subset used by the tool view).
const FMT_LABEL: Record<string, string> = {
  'pdf-cmyk': 'Print PDF', 'cmyk-tiff': 'Print TIFF', tiff: 'TIFF', jpeg: 'JPG', jpg: 'JPG',
  webm: 'WebM', mp4: 'MP4', emf: 'EMF', eps: 'EPS', 'eps-cmyk': 'EPS (CMYK)', dxf: 'DXF', pptx: 'PowerPoint',
  ics: 'Calendar', vcf: 'vCard', ico: 'Icon',
  zip: 'ZIP', csv: 'CSV', json: 'JSON', svg: 'SVG', 'svg-anim': 'Animated SVG', pdf: 'PDF', png: 'PNG',
  webp: 'WebP', 'webp-anim': 'Animated WebP', avif: 'AVIF', html: 'HTML', md: 'Markdown', txt: 'Text', gif: 'GIF', apng: 'aPNG',
};
const fmtLabel = (f: string) => FMT_LABEL[f] ?? String(f).toUpperCase();

// Export-format families, so the info dialog can group + order chips (vector first,
// then raster, then motion, then data) rather than dumping the raw manifest order.
// Mirrors engine VECTOR_FORMATS (inputs.ts) plus the raster/video/data buckets.
type FmtKind = 'vector' | 'raster' | 'video' | 'data';
const FMT_KIND: Record<string, FmtKind> = {
  svg: 'vector', 'svg-anim': 'vector', pdf: 'vector', 'pdf-cmyk': 'vector',
  eps: 'vector', 'eps-cmyk': 'vector', emf: 'vector', dxf: 'vector',
  png: 'raster', jpg: 'raster', jpeg: 'raster', webp: 'raster', 'webp-anim': 'raster',
  avif: 'raster', gif: 'raster', apng: 'raster', tiff: 'raster', 'cmyk-tiff': 'raster', ico: 'raster',
  webm: 'video', mp4: 'video',
};
const fmtKind = (f: string): FmtKind => FMT_KIND[f] ?? 'data';
// Group order + human label for the dialog's chip sections.
const FMT_KIND_ORDER: readonly FmtKind[] = ['vector', 'raster', 'video', 'data'];
const FMT_KIND_LABEL: Record<FmtKind, string> = { vector: 'Vector', raster: 'Raster', video: 'Video', data: 'Data' };

// "1080 × 1080 px" - the tool's intended output canvas (render.width/height carried
// into the index entry, at the manifest unit; px when unset). Empty when a tool
// declares no size, so callers can drop the line entirely.
function dimText(tool: GalleryTool | undefined): string {
  const w = tool?.width, h = tool?.height;
  if (!w || !h) return '';
  const u = tool!.unit && tool!.unit !== 'px' ? tool!.unit : 'px';
  return `${w} × ${h} ${u}`;
}

// Shared, /pro-free batch-slot helpers (finding #13) - the gallery still takes
// zero dependency on the removable /pro folder.
import { BATCH_SLOT_PREFIX, isBatchSlot } from '../lib/batch-slots.ts';
import { yoursShelfTools, yoursShelfHtml } from './yours-shelf.ts';
import { captureNeutralPinned, settleForCapture } from '../lib/capture-neutral.ts';

// Lucide "info" and "history" - context-menu / bulk-bar action icons. Path data
// lives in lib/icons.ts; 'info' is deduped against profile.ts's identical
// INFO_ICON (component-audit rec 5).
const INFO_ICON = icon('info');
const HISTORY_ICON = icon('history');
// Context-menu row glyphs (the bulk bar reuses OPEN/LINK/EYE too).
const OPEN_ICON = icon('externalLink');
const LINK_ICON = icon('link');
const EYE_ICON = icon('eye');
// "Start a collab" row - a two-person glyph, matching the collab presence chrome's
// avatar-cluster idiom (collab-pill / collab-tile-state) so the affordance reads as
// live co-editing rather than a plain share.
const USERS_ICON = icon('users');

// Lucide "star" - the favourite toggle (bulk bar + context menu).
const STAR_ICON = icon('star');
// Lucide "download" - the "available offline" action (bulk bar + context menu).
const DOWNLOAD_ICON = icon('download');
// "Make copies…" (bulk bar + menu) → the how-many dialog. Stack glyph = copies;
// the dialog's two destinations reuse Projects' Edit-together (pen) / Edit-as-sheet
// (Batch's table) marks so the vocabulary reads the same across views.
const COPIES_ICON = icon('layersStack');
const EDIT_ICON = icon('pen');
const SHEET_ICON = icon('table');
// Sentinel category id for the starred-favourites filter (not a real catalog category).
const FAV_CAT = 'favourites';

// Lucide "sliders-horizontal" - the filter trigger (collapses the category pills).
const FILTER_ICON = icon('filterLines');

// (Footer nav links + their glyphs live in components/footer-nav.ts, shared with
// Projects and the Catalogue so all three bottom bars stay identical.)
// Sort-direction toggle - paired up/down arrows. CSS emphasizes the .sd-up or
// .sd-down group depending on the button's .is-asc state, so the lit arrow shows
// which way the results run.
const SORT_DIR_ICON = icon('sortDir');

// lucide "package" - placeholder thumbnail for batch sessions, which have no
// single render to show (they resume into #/pro). Deduped against projects.ts's
// and folder-tiles.ts's identical PACKAGE_ICON.
const PACKAGE_ICON = icon('package');

// Lucide "chevron-left/right" - the preview-strip's prev/next affordances (fine-pointer
// only; touch just swipes). Decorative buttons, so aria-hidden.
const CHEVRON_LEFT = icon('chevronLeft', { strokeWidth: 2.4 });
const CHEVRON_RIGHT = icon('chevronRight', { strokeWidth: 2.4 });

// Always-present backup art for a tile: the tool's own icon. The icon is INLINED into
// the catalog index (never a network fetch), so unlike a committed preview PNG/SVG - a
// build artifact that can 404 on a fresh install / before `npm run previews` - it can
// never fail to load. It sits BEHIND every preview image and carousel (z-index:-1, see
// gallery.css .gtile-iconfill) as an instant, on-brand placeholder while lazy art
// decodes, and as the permanent fallback if a preview is missing or errors - so a gallery
// tile never shows a broken image or an empty box. '' when a tool has no icon (rare - the
// tile's checkerboard background still stands in).
function iconBackdrop(icon: string | undefined): string {
  if (!icon) return '';
  // Two stacked copies of the icon: a static muted BASE, and a green TRACE on top
  // whose stroke-dasharray leaves only a short segment drawn and whose animated
  // stroke-dashoffset walks that green segment along the icon's outline - a "drawing"
  // shimmer shown WHILE a preview is still loading. The trace is transparent wherever
  // it isn't currently stroking, so the muted base shows through (green passes over a
  // stretch, then it's muted again). CSS stops the trace once art loads / on the
  // permanent icon-only fallback / under reduced-motion (see .gtile-iconfill in gallery.css).
  return `<span class="gtile-iconfill" aria-hidden="true">`
    + `<span class="gtile-iconfill-base">${icon}</span>`
    + `<span class="gtile-iconfill-trace">${icon}</span>`
    + `</span>`;
}

/**
 * The theme-filtered example looks for a tool's gallery preview strip, each paired with
 * its ORIGINAL index in the manifest list (the render cache key `featured:<id>:<i>` is
 * keyed on that index, so it's shared with the featured hero row and stays stable
 * whichever looks the current theme filters in). Capped at EXAMPLE_MAX. Empty for a
 * tool with no examples, no raster format, or one the shell can't run.
 */
function galleryExampleLooks(tool: GalleryTool, darkTheme: boolean, max = EXAMPLE_MAX): Array<{ v: FeaturedVariant; i: number }> {
  if (!displayFormatOf(tool.formats)) return [];
  return resolveExamples(tool)
    .map((v, i) => ({ v, i }))
    // Same theme filter as the featured row: a reverse/white look on a light tile (or a
    // dark look on a dark tile) would be near-invisible on the checkerboard backdrop.
    .filter(({ v }) => !v.theme || (v.theme === 'dark') === darkTheme)
    .slice(0, max);
}

// Entrance reveal. Cold load wants "wow, instant" with a quick build-up; an
// IntersectionObserver gives us both: the above-the-fold tiles fire in the first
// callback and cascade by a tiny per-tile delay, while everything below fades in
// only as it scrolls into view (the mobile single-column win). The CSS does the
// actual fade - JS just arms it (.reveal-armed) and toggles .is-in per tile.
// Returns the observer so the caller can disconnect it before the next render.
const REVEAL_STEP_MS = 30;  // delay between tiles within one reveal batch
// Reading order: top-to-bottom, then left-to-right within a row - a gentle wave that
// reads left-to-right regardless of the column-major order the masonry packs the DOM
// into. The 8px top-bucket tolerates sub-pixel row misalignment between columns.
// Each tile's geometry key is read ONCE (getBoundingClientRect forces layout), then we
// sort on the cached keys - a comparator that measured inside itself would re-read both
// operands O(n log n) times, thrashing layout for no reason.
function sortByReadingOrder<T extends Element>(els: T[]): T[] {
  const keyed = els.map(el => {
    const r = el.getBoundingClientRect();
    return { el, top: Math.round(r.top / 8), left: r.left };
  });
  keyed.sort((a, b) => (a.top - b.top) || (a.left - b.left));
  return keyed.map(k => k.el);
}
function reveal(el: HTMLElement, i: number): void {
  el.style.setProperty('--reveal-delay', `${i * REVEAL_STEP_MS}ms`);
  el.classList.add('is-in');
}
// Handed from the mount that painted from the SLIM index to the mount that upgrades it to
// the full one. The cascade is a first-impression animation and it already played on the
// slim tiles; replaying it a few hundred milliseconds later, over the same tiles, reads as
// a stutter rather than an entrance. Module scope because each mount gets a fresh
// `firstPaint` - but a bare "spent" boolean was NOT enough: it was consumed by whichever
// gallery mount came next, so a slim paint followed by a trip into a tool cost the return
// visit its own entrance, minutes later and for no reason the user could see. Holding the
// slim paint's GRID scopes it to the mount it belongs to: the upgrade is a same-route
// refresh, and navigate() deliberately leaves a same-name view's markup in place, so that
// grid is still connected when its replacement mounts - while any other route swaps #view's
// children first, detaching it. Read before this mount writes its own shell (below), and
// one-shot either way. WeakRef so a session that never returns to the gallery doesn't hold
// a detached tile tree (with its decoded preview art) for the rest of its life.
let slimPaintedGrid: WeakRef<HTMLElement> | null = null;
function revealCards(masonry: HTMLElement, animate: boolean): IntersectionObserver | null {
  // Not animating - returning from a tool, reduced motion, or no IO support:
  // leave tiles un-armed so the CSS renders them at full opacity immediately.
  if (!animate || typeof IntersectionObserver === 'undefined') {
    masonry.classList.remove('reveal-armed');
    return null;
  }
  masonry.classList.add('reveal-armed');
  const all = [...masonry.querySelectorAll<HTMLElement>('.gtile')];

  // First screen: reveal every currently-visible tile in ONE deterministic,
  // geometry-ordered pass. The old code leaned on the IntersectionObserver to deliver
  // the whole above-the-fold set in a single callback and sorted *that* - but on a cold
  // load the preview images decode and reflow the column masonry, so the set arrived
  // split across several callbacks, each restarting the stagger at 0. The top-right
  // cards (late in the column-major DOM order) landed in a later batch and animated
  // last. Ordering the visible set ourselves, up front, makes the left-to-right cascade
  // reliable and works even before the IO would have fired (e.g. a backgrounded tab).
  const vh = window.innerHeight || document.documentElement.clientHeight;
  const inView: HTMLElement[] = [], below: HTMLElement[] = [];
  for (const el of all) {
    const r = el.getBoundingClientRect();
    (r.top < vh && r.bottom > 0 ? inView : below).push(el);
  }
  sortByReadingOrder(inView).forEach(reveal);

  // Below the fold: fade in per tile as it scrolls into view. Each batch re-starts the
  // stagger at 0 so a late scroll never inherits a big delay.
  if (!below.length) return null;
  const io = new IntersectionObserver((entries, obs) => {
    sortByReadingOrder(entries.filter(e => e.isIntersecting).map(e => e.target as HTMLElement))
      .forEach((el, i) => { reveal(el, i); obs.unobserve(el); });
  // Pull the trigger up a touch from the bottom edge so scroll reveals read as
  // "fades in as it arrives" rather than only once fully on-screen.
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.02 });
  below.forEach(el => io.observe(el));
  return io;
}

// Demo-preview heroes (a tool with no saved session yet) start hidden on the cold
// paint and fade in per-card as each image decodes - so the first view never shows a
// broken/blank preview, and they "appear as they are" ready. Armed only on the first
// cold paint: when returning from a tool or re-rendering on a filter/search, previews
// must show instantly, and reduced motion opts out entirely (animate is false in all
// those cases, mirroring revealCards). Images already complete (warm cache / a
// re-arm) are revealed at once; the delegated load listener catches the rest and a
// cached 404 is left to the error handler, which morphs the hero to a text tile.
function armPreviewReveal(masonry: HTMLElement, animate: boolean): void {
  if (!animate) { masonry.classList.remove('previews-armed'); return; }
  masonry.classList.add('previews-armed');
  masonry.querySelectorAll<HTMLElement>('.gtile-hero--preview').forEach(hero => {
    const img = hero.querySelector<HTMLImageElement>('.gtile-hero-img');
    if (img?.complete && img.naturalWidth > 0) hero.classList.add('is-ready');
  });
}

export interface GalleryMountOpts {
  /** Show ONLY this tool category (the `#/u` Utilities view = `only: 'utility'`).
   *  Bypasses the per-category feature flags - a deep link to the Utilities tab
   *  shows utilities even when the user hid that section from the main gallery. */
  only?: string;
  /** Raw route query string. `q` seeds the search field - read at mount only,
   *  never written back while typing (plans/99 M0). */
  params?: string;
}

export async function mountGallery(viewEl: HTMLElement, host: GalleryHost, opts: GalleryMountOpts = {}): Promise<void> {
  document.title = opts.only ? 'Utilities - Lolly' : 'Lolly';
  // #/?q=<text> restores a handed-off search (plans/99 section 2c): raw for the field's
  // display value, lowercased below for `query` (the same normalisation the input
  // handler applies at each keystroke).
  const initialQuery = (new URLSearchParams(opts.params || '').get('q') || '').trim();
  // Whether the on-device speech bridge exists - computed ONCE so every
  // utilityViews(speechOk) call in this mount sees the same card set.
  const speechOk = !!host.speech?.isAvailable();
  // `window as unknown as …` bypasses the global Window['__toolIndex'] augmentation
  // (typed as the loosely-shaped ToolIndex in catalog/sync); this view reads it as the
  // denormalised GalleryTool slice. Erased cast - no runtime effect.
  // On a cold first visit the full index is still downloading, and the SLIM one
  // (plans/155 Task 3.8 - grid fields only: icon, name, description, category, tags,
  // preview) has already arrived. Painting from it is the whole point of that task:
  // named, icon-led tiles now instead of a blank screen until 168 KB gz of i18n
  // blocks, templates and example bodies arrive. main.ts re-navigates the moment the
  // full index arrives, which is what fills in the example strips and translations - so
  // this fallback is only ever on screen for the length of that download.
  const slimIndex = (window as unknown as { __toolIndexSlim?: { tools: GalleryTool[] } }).__toolIndexSlim;
  const syncedIndex: { tools: GalleryTool[] } = (window as unknown as { __toolIndex?: { tools: GalleryTool[] } }).__toolIndex ?? slimIndex ?? { tools: [] };
  // True while this mount is drawing the slim entries - the tiles are deliberately
  // incomplete (no example carousels, since a slim entry carries no `formats`), and
  // two places below need to know: the preview reveal, and the entrance cascade of
  // the mount that replaces this one.
  const paintedFromSlim = !(window as unknown as { __toolIndex?: unknown }).__toolIndex && !!slimIndex;
  // …and this is the ONE mount that upgrades such a paint to the full index (see
  // slimPaintedGrid). Read HERE, at the top of the mount, because the shell innerHTML
  // further down detaches the previous mount's grid - by then the question can't be asked.
  const upgradesSlimPaint = !paintedFromSlim && !!slimPaintedGrid?.deref()?.isConnected;
  slimPaintedGrid = null;
  // Fold in any tools the instance injects (lib/injected-tools, populated by the
  // control-plane seam in src/org/). Empty by default ⇒ byte-identical. An injected
  // tool never overrides a pack/catalog tool of the same id (the synced set wins).
  const present = new Set(syncedIndex.tools.map((tt) => tt.id));
  const injected: GalleryTool[] = getInjectedTools()
    .filter((it) => !present.has(it.id))
    .map((it) => ({ id: it.id, name: it.name, category: it.category ?? 'other', listed: true, ...(it.openQuery ? { openQuery: it.openQuery } : {}) }));
  const rawIndex: { tools: GalleryTool[] } = { tools: [...syncedIndex.tools, ...injected] };
  // Unlisted tools (manifest `listed:false`) are mechanisms invoked from context - e.g.
  // asset-export, reached from the catalog's per-asset Download - not gallery destinations.
  // Drop them once, here, so every downstream membership set (grid, search, favourites,
  // featured + utility strips, pill counts) excludes them with no per-site guard. They
  // still load via #/tool/<id>, URL mode and the CLI - this only hides them from the listing.
  const index: { tools: GalleryTool[] } = { tools: rawIndex.tools.filter(t => t.listed !== false) };
  const [savedEntriesRaw, profile, sessionSizes, pinnedTools] = await Promise.all([
    host.state.list(),
    host.profile.get(),
    host.state.sizes().catch((): Record<string, number> => ({})),
    // Tools pinned "available offline" (lib/offline-pins.ts) - drives each card's
    // pin toggle state. Unreadable pins just render every card unpinned.
    pinnedToolIds().catch(() => new Set<string>()),
  ]);
  // Trashed sessions (projects Trash, `__trash__:` slots) never list here.
  const savedEntries = savedEntriesRaw.filter(e => !isHiddenSlot(e.slot));

  // Profile-personalized previews (see ../personalize-previews.js). `sig` is empty
  // unless the user opted in ("use my details"); only cache entries matching the
  // current sig are fresh - a stale one is ignored and re-rendered below. Held in a
  // Map so re-renders (search/filter) keep the personalized image, not just the
  // committed placeholder.
  const previewSig = profileSignature(profile);
  // Only deserialise the generated-previews store when personalization is on (the
  // default is off): it grows unboundedly with every rendered variant, so scanning it
  // on every gallery mount adds IDB read + deserialise latency before first paint for
  // nothing. The empty-sig path below already ignores cachedPreviews.
  const cachedPreviews = previewSig ? (await host.previews?.list().catch(() => []) ?? []) : [];
  const personalizedByTool = new Map<string, string>();
  if (previewSig) {
    for (const rec of cachedPreviews) {
      if (rec?.sig === previewSig && rec.thumb) personalizedByTool.set(rec.toolId, rec.thumb);
    }
  }

  // Per-tool saved sessions (newest first), batch sessions excluded - they have
  // no toolId and resume into #/pro, so they're not a tool's history.
  const entriesByTool = new Map<string, SavedEntry[]>();
  for (const entry of savedEntries) {
    if (isBatchSlot(entry.slot)) continue;
    if (!entriesByTool.has(entry.toolId)) entriesByTool.set(entry.toolId, []);
    // host.state.list() returns SavedEntry-shaped rows; the intersected host type widens
    // the element to the base StateEntry, so re-narrow at the push. Erased cast.
    entriesByTool.get(entry.toolId)!.push(entry as SavedEntry);
  }
  for (const arr of entriesByTool.values()) {
    arr.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }
  const latestByTool = (id: string): SavedEntry | undefined => entriesByTool.get(id)?.[0];
  const countByTool = (id: string): number => entriesByTool.get(id)?.length ?? 0;
  // Recent session previews (newest first) that a tool's tile can cross-fade through - 
  // capped so a tool with dozens of saved works keeps its tile DOM bounded. Sessions
  // whose preview failed to capture (thumb === null) are skipped.
  const HERO_ROTATE_MAX = 5;
  const thumbsByTool = (id: string): string[] =>
    (entriesByTool.get(id) ?? [])
      .map(e => e.thumb)
      .filter((t): t is string => !!t)
      .slice(0, HERO_ROTATE_MAX);

  const toolById = new Map(index.tools.map(t => [t.id, t]));

  // Catalog order = authoring order with new tools appended, so a tool's position is
  // our recency signal: the index → position map drives the 'recent' sort. It reads
  // the whole catalog (not the filtered view), so a filter never changes recency.
  // (The "New" recency BADGE is gone - Andy, 2026-08-28: it collided with the
  // "+New" start-blank chip, two meanings of new on one card. Recency now lives
  // as the info dialog's "Added" line, from the index's `added` date.)
  const orderById = new Map(index.tools.map((t, i) => [t.id, i]));

  // All saved sessions (tool + batch) newest first - the global drawer's list.
  const sortedSaved = [...savedEntries].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const nameById = new Map(index.tools.map(t => [t.id, t.name]));

  // Group by category; feature flags hide whole categories. In only-mode
  // (the Utilities view) every OTHER category goes into the hidden set instead - 
  // reusing the one membership mechanism every downstream surface (grid, search,
  // favourites count, featured strip, pill counts) already respects. The main
  // gallery ALWAYS hides 'utility' now: utilities moved wholesale to the `#/u`
  // view (their old feature flag governs that view, not a gallery section).
  const grouped: Record<string, GalleryTool[]> = {};
  for (const t of index.tools) (grouped[t.category ?? 'other'] ??= []).push(t);
  const hidden = opts.only
    // `?? 'other'` matters: `grouped` keys uncategorised tools under 'other', so
    // the hidden set must name that key too or they'd leak into the only-view.
    ? new Set<string | undefined>([...new Set(index.tools.map(t => t.category ?? 'other'))].filter(c => c !== opts.only))
    : hiddenCategories(profile).add('utility');

  // The user's starred tools - held in memory for this mount, persisted to the profile
  // on every toggle. Read here (before the featured row) because a favourite is also
  // promoted INTO the featured hero strip - see featuredEntriesNow().
  const favourites = loadFavourites(profile);

  // The user's hidden tools (+ `view:<id>` utility cards) - "Hide tool" removes the
  // tile from the browse grid, search results and the featured strip, behind the
  // grey "Show hidden tools" box that sits last in the grid. Deep links (#/tool/<id>,
  // URL mode, the CLI) keep working - this is a browse-surface overlay, like the
  // catalog's hidden assets. A fresh profile starts with the brand's shipped
  // `defaultHiddenTools` merged in (until the user first edits the overlay), so a
  // curated gallery opens tidy - exactly how hidden ASSETS seed their defaults.
  const hiddenTools = loadHiddenTools(profile, defaultHiddenToolIds());
  let showHiddenTools = false;   // ephemeral reveal, per mount (matches the catalog's showHidden)

  // Multi-selection of tiles - tool ids plus `view:<id>` card keys. A closure Set so
  // it survives the render() that wipes the masonry; repainted in place (never via a
  // re-render) so marquee drags and scroll position are preserved.
  const selected = new Set<string>();
  const isViewRef = (ref: string): boolean => ref.startsWith('view:');
  const viewByRef = (ref: string): UtilityView | undefined => utilityViews(speechOk).find(v => viewFavKey(v.id) === ref);
  // Desktop-only tools: selectable (favourite/hide still apply) but never pinnable.
  const unavailableIds = new Set(index.tools.filter(t => toolSupport(t, host.capabilities, presentApis(host)).status === 'unavailable').map(t => t.id));
  const selectedToolIds = (): string[] => [...selected].filter(r => !isViewRef(r));
  const pinnableIds = (): string[] => selectedToolIds().filter(id => !unavailableIds.has(id));
  const allSelectedPinned = (): boolean => { const ids = pinnableIds(); return ids.length > 0 && ids.every(id => pinnedTools.has(id)); };
  const allSelectedFav = (): boolean => selected.size > 0 && [...selected].every(r => favourites.has(r));
  const allSelectedHidden = (): boolean => selected.size > 0 && [...selected].every(r => hiddenTools.has(r));
  const sessionToolIds = (): string[] => selectedToolIds().filter(id => countByTool(id) > 0);
  // Tools we can spin fresh sessions from + edit in THIS shell (excludes desktop-only
  // "unavailable" tools, which can't mount here - same gate as pinnableIds).
  const copyableIds = (): string[] => selectedToolIds().filter(id => !unavailableIds.has(id));

  // The floating selection bar (lib/bulk-bar.ts - shared with projects/catalog).
  // Labels are smart toggles read at sync time: all-favourited → Unfavourite, etc.
  const bulkBarCfg: BulkBarConfig = {
    prefix: 'gallery-bulkbar',
    rootSelector: '.gallery',
    count: () => selected.size,
    actions: [
      { id: 'pin', icon: DOWNLOAD_ICON, label: () => allSelectedPinned() ? t('Remove from offline') : t('Available offline'), disabled: () => pinnableIds().length === 0 },
      { id: 'sessions', icon: HISTORY_ICON, label: () => t('View sessions'), title: () => t('Open Projects filtered to the selected tools’ saved sessions'), disabled: () => sessionToolIds().length === 0 },
      { id: 'copies', icon: COPIES_ICON, label: () => t('Make copies…'), title: () => t('Make copies of the selected tools and edit them together or as a sheet'), hidden: () => copyableIds().length < 2 },
      { id: 'fav', icon: STAR_ICON, label: () => allSelectedFav() ? t('Unfavourite') : t('Favourite') },
      { id: 'hide', icon: EYE_ICON, label: () => allSelectedHidden() ? t('Unhide') : t('Hide') },
      // Single-selection extras: the same About + Copy link the context menu carries,
      // here so touch users reach them from the selection toolbar too.
      { id: 'info', icon: INFO_ICON, label: () => t('About'), hidden: () => selected.size !== 1 },
      { id: 'copylink', icon: LINK_ICON, label: () => t('Copy link'), hidden: () => selected.size !== 1 },
    ],
  };
  // The floating selection bar is lazy-loaded (lib/bulk-bar.ts, ~8 KB) OFF the boot
  // path - it is position:fixed and hidden until a tile is selected, so it never paints
  // on first frame. ensureBulkBar() injects + wires it (dispatch + Escape-clears) on the
  // first selection, a user gesture, and is idempotent; syncBulkBar() drives it after
  // (a no-op before the first selection, when the module isn't loaded and there's nothing
  // to show or hide). handleBulk/dropSelection are hoisted declarations below.
  let bulkMod: typeof import('../lib/bulk-bar.ts') | null = null;
  let bulkReady: Promise<typeof import('../lib/bulk-bar.ts')> | null = null;
  const ensureBulkBar = (): Promise<typeof import('../lib/bulk-bar.ts')> =>
    (bulkReady ??= import('../lib/bulk-bar.ts').then((m) => {
      bulkMod = m;
      const root = viewEl.querySelector('.gallery');
      if (root && !viewEl.querySelector('.gallery-bulkbar')) {
        root.insertAdjacentHTML('beforeend', m.bulkBarHtml(bulkBarCfg));
        // Bulk-action dispatch - delegated on the now-present, stable bar node.
        viewEl.querySelector<HTMLElement>('.gallery-bulkbar')?.addEventListener('click', (e) => {
          const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-bulk]');
          if (!btn) return;
          e.preventDefault();
          void handleBulk(btn.dataset.bulk!);
        });
        // Escape drops the selection (yielding to any open menu/dialog/field first).
        cleanups.push(m.wireEscapeClearsSelection({ active: () => selected.size > 0, clear: () => dropSelection() }));
      }
      return m;
    }));
  const syncBulkBar = (): void => {
    if (selected.size > 0) void ensureBulkBar().then((m) => m.syncBulkBar(viewEl, bulkBarCfg));
    else bulkMod?.syncBulkBar(viewEl, bulkBarCfg);
  };

  // Editor-layout tools mount an extra lazy view chunk (free-canvas / doc-editor /
  // deck-editor - see views/tool.ts). Warm the matching import when a tool is
  // pinned, and once per gallery mount for already-pinned tools, so the chunk
  // lands in the SW's cache-first bucket and a pinned editor tool still boots
  // offline. import() promises are cached, so repeats are free.
  const warmEditorChunk = (layout: string | undefined): void => {
    if (layout === 'editor') void import('./free-canvas.ts').catch(() => {});
    else if (layout === 'document') void import('./doc-editor.ts').catch(() => {});
    else if (layout === 'deck') void import('./deck-editor.ts').catch(() => {});
  };
  if (pinnedTools.size) {
    void pinnedRenderLayouts().then(layouts => layouts.forEach(warmEditorChunk)).catch(() => {});
  }
  // Favourites visible in the current catalog (not hidden by a flag) - the pill count.
  // Starred VIEW cards (their `view:`-keyed favourites) count too, but only in the
  // Utilities grid, the one place those tiles exist.
  const favCount = (): number => index.tools.filter(t => favourites.has(t.id) && !hidden.has(t.category) && !hiddenTools.has(t.id)).length
    + (opts.only === 'utility' ? utilityViews(speechOk).filter(v => favourites.has(viewFavKey(v.id)) && !hiddenTools.has(viewFavKey(v.id))).length : 0);

  // A catalog tool → a featured-strip entry. A tool with no manifest `featured` block
  // (a favourited plain tool) still gets one, falling back to its description as the
  // blurb - the same shape the Utilities strip uses.
  // Utility tools lead with their ICON, not a preview: every utility's resting
  // state is the same empty drop area, so a strip of them is indistinguishable
  // screenshots. Dropping preview + examples leaves the row's always-present
  // icon fallback (.ftile-iconfill) as the tile art, which is what tells the
  // utilities apart. (Revisit if utility tiles ever get a "after a file went
  // through" look worth showing.)
  const toFeaturedEntry = (t: GalleryTool): FeaturedEntry => {
    const iconHero = t.category === 'utility';
    const featured = t.featured ?? { blurb: t.description };
    return {
      id: t.id, name: t.name, preview: iconHero ? undefined : t.preview, icon: t.icon,
      formats: t.formats, status: t.status,
      examples: iconHero ? undefined : t.examples,
      // `featured.variants` is the pre-`examples` alias resolveExamples() still
      // honours, so an icon-hero entry must shed it too or the looks come back.
      featured: iconHero && featured.variants ? { ...featured, variants: undefined } : featured,
    };
  };

  // Which tools the hero strip promotes when the user has no favourites of their own.
  //
  // The strip is favourites-only, and `profile.favourites` is undefined until the first star -
  // so the fifteen tools whose manifests carry a curated `featured.order` + blurb (eight in the
  // lolly-start pack) were only ever seen by someone who had ALREADY starred something, and a
  // brand-new visitor got a flat grid. That set is the shipped curation, per pack, authored in
  // the tool data rather than in shell code, and each entry's blurb was written for this strip.
  //
  // Read per call, not captured at mount: saveFavourites() sets profile.favourites synchronously
  // before refreshFeatured() runs, so the first star flips the strip to the user's own list in
  // the same tick. NOTHING is written to the profile - the stand-in is derived, so an existing
  // user's favourites are never merged into, reordered, or overwritten, and `[]` (starring then
  // unstarring everything) is a real choice that leaves the strip empty. Same rule main.ts
  // applies to the catalog's seeded asset favourites.
  //
  // Sorted before the cap because featured-row.ts re-sorts by `featured.order` anyway: slicing
  // catalog order first could drop a lower-order tool and leave a higher-order one as the hero.
  const firstRunFeatured = (): Set<string> | null => {
    if (profile?.favourites !== undefined || FIRST_RUN_FEATURED_MAX <= 0) return null;
    const curated = index.tools
      .filter(t => t.featured?.order != null && !hidden.has(t.category) && !hiddenTools.has(t.id))
      .sort((a, b) => a.featured!.order! - b.featured!.order!)
      .slice(0, FIRST_RUN_FEATURED_MAX);
    return curated.length ? new Set(curated.map(t => t.id)) : null;
  };

  // Featured hero row - the user's favourites, and ONLY their favourites (starring a tool
  // promotes it into the hero strip), minus any in a hidden category (a category the user
  // turned off shouldn't be promoted), falling back to the pack's curated set for a visitor
  // who has never starred anything (firstRunFeatured above). Manifest `featured` doesn't
  // auto-seed a favourite - its blurb/variants style a tile either way (see toFeaturedEntry).
  // Tools appear in catalog order. Carries the "New" flag through. Recomputed on every star
  // toggle (refreshFeatured).
  const utilityFirstRun = (): FeaturedEntry[] | null => {
    if (opts.only !== 'utility' || profile?.favourites !== undefined) return null;
    const out: FeaturedEntry[] = [];
    for (const ref of UTILITY_FIRST_RUN) {
      if (hiddenTools.has(ref)) continue;
      if (ref.startsWith('view:')) {
        const v = viewByRef(ref);
        if (v) out.push({ id: ref, name: v.name, icon: icon(v.icon), href: v.href, featured: { blurb: v.description } });
      } else {
        const t = index.tools.find(x => x.id === ref);
        if (t && !hidden.has(t.category)) out.push(toFeaturedEntry(t));
      }
    }
    return out.length ? out : null;
  };
  const featuredEntriesNow = (): FeaturedEntry[] => {
    const seededUtilities = utilityFirstRun();
    if (seededUtilities) return seededUtilities;
    const seen = new Set<string>();
    const out: FeaturedEntry[] = [];
    const promoted = firstRunFeatured() ?? favourites;
    for (const t of index.tools) {
      if (!seen.has(t.id) && promoted.has(t.id) && !hidden.has(t.category) && !hiddenTools.has(t.id)) { out.push(toFeaturedEntry(t)); seen.add(t.id); }
    }
    // Starred VIEW cards (Verify, Unpack, Colour Lab) promote into the
    // hero strip exactly like starred tools - as icon-hero tiles, since a view has
    // no preview or render path. `href` routes the tile to the view (the same
    // non-tool-tile mechanism the Projects ribbon uses), and the `view:`-prefixed
    // id can never collide with a tool's. Utilities grid only - the tiles
    // themselves exist nowhere else.
    if (opts.only === 'utility') {
      for (const v of utilityViews(speechOk)) {
        if (favourites.has(viewFavKey(v.id)) && !hiddenTools.has(viewFavKey(v.id))) {
          out.push({ id: viewFavKey(v.id), name: v.name, icon: icon(v.icon), href: v.href, featured: { blurb: v.description } });
        }
      }
    }
    return out;
  };
  const featuredEntries: FeaturedEntry[] = featuredEntriesNow();

  // Featured hero view mode (Gallery strip vs Cover Flow), persisted like the sort.
  // Declared here (before the markup) since the popover's segmented control reads it.
  // New users (no stored preference) default to Cover Flow on desktop, but Gallery on a
  // mobile viewport - the coverflow fan is still buggy at that size. An explicit choice wins.
  const mobileViewport = typeof matchMedia !== 'undefined' && matchMedia('(max-width: 640px)').matches;
  let featuredView: FeaturedViewMode = mobileViewport ? 'gallery' : 'coverflow';
  try {
    const savedView = localStorage.getItem(FEATURED_VIEW_STORAGE);
    if (savedView && (FEATURED_VIEWS as readonly string[]).includes(savedView)) featuredView = savedView as FeaturedViewMode;
  } catch { /* storage off */ }
  // An automated screenshot run always frames the filmstrip, never Cover Flow - the
  // house rule for docs shots, and it is about the OUTPUT format, not taste. Cover
  // Flow fans its covers with a 3-D `rotateY`; `parseCssMatrix` refuses 3-D matrices,
  // so a vector capture falls back to the axis-aligned box and the covers come out
  // mis-scaled or blank. Cover Flow also has to keep its rAF loop running to lay the
  // fan out (see featured-row.ts, `if (coverflow || !reduced) startRaf()`), so it can
  // never be fully still. The filmstrip is both vector-expressible and static.
  // perf-ui forces the flat filmstrip too (reusing the capture path): Cover Flow's 3-D fan
  // keeps a rAF loop running just to lay itself out, so it can never be still - the whole
  // point of the perf mode. Off by default ⇒ byte-identical.
  if (captureNeutralPinned() || perfUiOn()) featuredView = 'gallery';

  // Utilities live in the grid like every other category now - their own "Utilities"
  // filter pill, always sorted LAST (categoryRank → Infinity). The old bottom carousel
  // is gone; a utility renders as a regular tile.
  const visibleCats = Object.keys(grouped)
    .filter(cat => !hidden.has(cat))
    .sort((a, b) => categoryRank(a) - categoryRank(b));

  // At most ONE non-modal first-run surface per visit (plans/137 A1). The
  // candidates keep their own flags and copy; the ladder only decides which one
  // gets the slot: privacy notice, else the personalise nudge, else the offline
  // nudge. It renders HIDDEN and is revealed by revealFirstRunBanner() below,
  // once the welcome modal has been ruled out - on a visit where the welcome
  // shows, nothing else does, and the answer to that is async (token discovery).
  // The tips strip is the ladder's last rung and mounts from the same place.
  // Placed ahead of the content so the phone-width nudge reads as an in-flow
  // card at the top of the gallery (A4); the privacy strip is fixed either way.
  const firstRunBanner = privacyNoticeMarkup() || personalizeNudgeMarkup(profile) || offlineNudgeMarkup(profile);

  // Render shell. The pill bar + masonry are filled by render(); the footer
  // (Pro link, search, info link) is left exactly as before.
  viewEl.classList.add('has-masonry');
  viewEl.innerHTML = `
    <div class="gallery${featuredEntries.length ? ' has-featured' : ''}">
      <h1 class="visually-hidden">${opts.only ? t('Lolly - utilities') : t('Lolly - tools gallery')}</h1>
      ${viewTopbarHtml({
        active: opts.only ? 'utilities' : 'tools',
        right: `
          ${visibleCats.length ? `<button type="button" class="filter-fab" aria-label="${escape(t('Sort and filter tools'))}" aria-haspopup="true" aria-expanded="false" aria-controls="filter-popover" title="${escape(t('Sort & filter'))}">${FILTER_ICON}</button>` : ''}
          ${sortedSaved.length && !opts.only ? `<button type="button" class="history-fab" title="${escape(t('Saved sessions'))}" aria-label="${escape(t('Saved sessions ({n})', { n: sortedSaved.length }))}">${HISTORY_ICON}<span class="history-fab-count" aria-hidden="true">${sortedSaved.length}</span></button>` : ''}`,
        popover: visibleCats.length ? `
          <div class="filter-popover" id="filter-popover" role="group" aria-label="${escape(t('Sort and filter tools'))}" hidden>
            ${featuredEntries.length ? `
            <div class="filter-pop-sort">
              <p class="filter-pop-head">${t('Featured view')}</p>
              ${segHtml('featured-view', FEATURED_VIEWS.map(v => ({ id: v, label: t(FEATURED_VIEW_LABELS[v]) })), featuredView, t('Featured view'), { attr: 'data-view' })}
            </div>` : ''}
            <div class="filter-pop-sort">
              <label class="filter-pop-head" for="gallery-sort">${t('Sort by')}</label>
              <div class="gallery-sort-row">
                <select class="gallery-sort field-select" id="gallery-sort">
                  ${SORT_KEYS.map(k => `<option value="${k}">${escape(t(SORT_LABELS[k]))}</option>`).join('')}
                </select>
                <button type="button" class="gallery-sort-dir" id="gallery-sort-dir" aria-pressed="false" aria-label="${escape(t('Sort direction: newest first'))}" title="${escape(t('Reverse order'))}">${SORT_DIR_ICON}</button>
              </div>
            </div>
            <p class="filter-pop-head">${t('Filter')}</p>
            <div class="filter-pop-pills" aria-label="${escape(t('Filter tools by category'))}"></div>
          </div>` : '',
        profile: { firstname: profile.firstname },
      })}
      ${visibleCats.length ? `<div class="filter-backdrop" hidden></div>` : ''}

      ${firstRunBanner}

      ${visibleCats.length === 0 ? (index.tools.length === 0 ? `
        <div class="gallery-empty" role="status">
          <p class="gallery-empty-title">${t("Couldn't load the tools.")}</p>
          <p class="gallery-empty-hint">${tRaw('Check your connection, then {button}.', { button: `<button type="button" class="gallery-retry">${t('retry')}</button>` })}</p>
        </div>
      ` : `
        <div class="gallery-empty" role="status">
          <p class="gallery-empty-title">${t('It looks like there are no tools available.')}</p>
          <p class="gallery-empty-hint">${tRaw('Try turning on categories in {link}.', { link: `<a href="#/profile?focus=feature-flags">${t('your feature flags')}</a>` })}</p>
        </div>
      `) : `
        <div class="featured-mount"></div>
        ${opts.only ? '' : yoursShelfHtml(yoursShelfTools(
          [...new Set(sortedSaved.filter(e => !isBatchSlot(e.slot)).map(e => e.toolId))],
          favourites,
          toolById,
          hiddenTools,
        ))}
        <p class="gallery-search-status visually-hidden" role="status" aria-live="polite"></p>
        <div class="tool-masonry${opts.only === 'utility' ? ' tool-masonry--utility' : ''}"></div>
      `}
    </div>
  `;

  // Hidden until the ladder reveals it (see revealFirstRunBanner) - and hidden
  // from the accessibility tree with it, so a screen reader isn't told about a
  // banner this visit may never show.
  const firstRunEl = viewEl.querySelector<HTMLElement>('.privacy-notice, .personalize-nudge');
  if (firstRunEl) firstRunEl.hidden = true;

  /** Show the one banner this visit is allowed, if there is one. Each mount is a
   *  no-op when its own markup isn't the one that won the slot.
   *
   *  "Visit" means the FIRST gallery mount of this browser session (plans/142
   *  W3): an operator bouncing home between tools all afternoon used to be
   *  dealt the next ladder rung on every return - covering the top-right
   *  controls they were reaching for, mid-flow. A sessionStorage flag keeps the
   *  later mounts of the same session quiet; a new browser session (tomorrow)
   *  deals the next rung as before, so the ladder still empties - just one rung
   *  per sitting, not one per bounce. */
  const BANNER_DEALT_KEY = 'lolly-banner-dealt';
  // Grace window: the boot fast-path can re-mount this gallery seconds later
  // when the post-sync tool index arrives (main.ts), and that re-mount must
  // re-reveal the SAME banner - only a genuinely later return stays quiet.
  const BANNER_REDEAL_GRACE_MS = 15_000;
  const revealFirstRunBanner = (): boolean => {
    if (!firstRunEl) return false;
    try {
      const stamp = Number(sessionStorage.getItem(BANNER_DEALT_KEY));
      if (stamp && Date.now() - stamp > BANNER_REDEAL_GRACE_MS) return false;
      if (!stamp) sessionStorage.setItem(BANNER_DEALT_KEY, String(Date.now()));
    } catch { /* storage off - fall through and show, matching the old cadence */ }
    firstRunEl.hidden = false;
    mountPrivacyNotice(viewEl);
    mountPersonalizeNudge(viewEl, host);
    mountOfflineNudge(viewEl, host);
    return true;
  };

  // Wires the language menu + the profile pill's mobile menu, and (via `headshotId`)
  // resolves the profile-pill avatar OFF the first-paint path - the headshot is a blob
  // fetch + createObjectURL (and the stored object URL goes stale across reloads, so
  // it must be re-fetched by id) - awaiting it before the initial innerHTML delayed
  // the whole gallery. The pill renders name-only immediately; once the headshot
  // resolves the <img> swaps in. `openHistoryOverlay` is a hoisted function
  // declaration, so referencing it here (before its textual definition) is safe.
  mountViewTopbar(viewEl, host, {
    profileMenu: { savedCount: sortedSaved.length, onHistory: openHistoryOverlay },
    headshotId: profile.headshot?.id,
  });

  // Universal drop front door: any file dragged onto the gallery is sniffed and
  // routed (design → Design, PDF → import/compress, media → library or
  // /verify). Scoped to this view's root (its listeners die with the node on
  // navigation) - never a window/document-global handler. drop-router (~6 KB) is
  // dynamic-imported off the boot path; kicked at mount, it resolves in ~ms same-origin,
  // so a file dropped in that sliver is effectively never missed. The cast is erased:
  // the concrete web host carries the picker's upload surface.
  void import('../lib/drop-router.ts').then((m) => m.attachDropRouter(viewEl, host as unknown as PickerHost));

  // Empty catalog: offer a re-sync without a full reload.
  viewEl.querySelector('.gallery-retry')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = t('Retrying…');
    await syncCatalog(host as unknown as Parameters<typeof syncCatalog>[0]);
    await mountGallery(viewEl, host);
  });

  const pillbar    = viewEl.querySelector<HTMLElement>('.filter-pop-pills'); // category pills now live in the filter popover
  const masonry    = viewEl.querySelector<HTMLElement>('.tool-masonry');

  // Cleanup registry - main.js's navigate() calls viewEl._cleanup on unmount. Both
  // the featured row (timers + drift loop) and the personalized-preview queue below
  // register their teardown here so neither keeps running after the user moves on.
  const cleanups: Array<() => void> = [];
  (viewEl as HTMLElement & { _cleanup?: () => void })._cleanup = () => {
    for (const fn of cleanups.splice(0)) { try { fn(); } catch { /* best-effort teardown */ } }
  };
  // False once this gallery is no longer the mounted view - a background job that
  // outlives it (pinSelection) checks this before touching the bar.
  let mounted = true;
  cleanups.push(() => { mounted = false; });

  // A single punchy, bassy, breathy "ahhh" on arrival at the gallery - one-shot (no loop),
  // gesture-gated, silent when sound is off. Cancel on leave so a pending one can't fire elsewhere.
  playGalleryAah();
  cleanups.push(() => cancelArrivalAah());

  // ── Multi-select: marquee + Shift-range (lib/tile-select.ts, shared with
  // projects/catalog) over the tiles' top-left selection dots. Everything repaints
  // IN PLACE - applyView()'s live-node model must never see a re-render here.
  const selectableTiles = (): HTMLElement[] =>
    masonry ? [...masonry.querySelectorAll<HTMLElement>('.gtile[data-select-ref]')] : [];
  function paintSelection(): void {
    for (const el of selectableTiles()) {
      const on = selected.has(el.dataset.selectRef!);
      el.classList.toggle('is-selected', on);
      el.querySelector('.tile-check')?.setAttribute('aria-pressed', String(on));
    }
    syncBulkBar();
  }
  // Marquee + Shift-range wiring (lib/tile-select.ts) is lazy-loaded OFF the boot path:
  // the select dots are already-painted HTML, and the drag-marquee / shift-anchor is a
  // gesture surface, never first paint. Imported fire-and-forget at mount (~ms same-origin);
  // a dot-click or marquee-start in that sliver just no-ops once. resetAnchor/onDotClick
  // below guard on the handle for exactly that window.
  let tileSelect: ReturnType<typeof import('../lib/tile-select.ts')['wireTileSelect']> | null = null;
  void import('../lib/tile-select.ts').then((m) => {
    tileSelect = m.wireTileSelect({
      host: viewEl,
      tiles: selectableTiles,
      refOf: (el) => el.dataset.selectRef!,
      current: () => new Set(selected),
      setRefs: (refs) => { selected.clear(); for (const r of refs) selected.add(r); paintSelection(); },
      clear: () => dropSelection(),
      // Never start a box on a tile, the strips, the chrome bars, a popover, or any
      // control - only in a genuine gap between cards.
      noStart: '.gtile, .featured, .featured-mount, .gallery-topbar, .gallery-footer, '
        + '.filter-popover, .filter-backdrop, .gallery-bulkbar, .gallery-no-results, '
        + 'button, a, input, select, label, dialog',
    });
    cleanups.push(() => tileSelect?.destroy());
  });
  // Empty the selection AND forget the Shift-anchor together (a stale anchor would
  // become the far end of the next Shift-click's range).
  function dropSelection(): void {
    selected.clear();
    tileSelect?.resetAnchor();
    paintSelection();
  }
  // Escape-clears-selection is installed WITH the lazy bulk bar (ensureBulkBar above):
  // there is nothing to clear until a first selection exists, and that first selection
  // is what loads the bar module that owns the handler.

  // Selection dots - delegated on the persistent masonry node so the per-render
  // innerHTML rebuilds don't orphan the handler. Shift-click extends from the anchor.
  masonry?.addEventListener('click', (e) => {
    const dot = (e.target as HTMLElement).closest<HTMLElement>('.tile-check[data-select]');
    if (!dot) return;
    e.preventDefault(); e.stopPropagation();
    const ref = dot.dataset.select!;
    tileSelect?.onDotClick(ref, e.shiftKey, () => {
      if (selected.has(ref)) selected.delete(ref); else selected.add(ref);
      paintSelection();
    });
  });

  // Bulk-bar dispatch is delegated inside ensureBulkBar() at injection time (the bar is
  // lazily built on the first selection), so it can't be bound here to a not-yet-present node.

  // ── Context menu: right-click / long-press on any tile (bulk variant inside a
  // multi-selection) - lib/context-menu.ts, lazy-loaded OFF the boot path (a right-click
  // surface, never first paint). Imported fire-and-forget at mount so it resolves in ~ms
  // same-origin; a right-click landing in that sliver just no-ops that once. ctxMod backs
  // tileMenuHtml/bulkMenuHtml's menuItemHtml, which only run via the callbacks below.
  let ctxMod: typeof import('../lib/context-menu.ts') | null = null;
  void import('../lib/context-menu.ts').then((m) => {
    ctxMod = m;
    const ctxMenu = m.wireTileContextMenu({
      host: viewEl,
      tileSelector: '.gtile[data-select-ref]',
      refOf: (el) => el.dataset.selectRef ?? null,
      isBulkTarget: (ref) => selected.size > 1 && selected.has(ref),
      singleHtml: (tgt) => tileMenuHtml(tgt.ref),
      bulkHtml: () => bulkMenuHtml(),
      onAction: (act, tgt) => { void onMenuAction(act, tgt?.ref ?? null); },
    });
    cleanups.push(() => ctxMenu.destroy());
  });

  // Mount the cinematic featured hero row (the user's favourited tools) at the top. It
  // renders + caches its own looks lazily; the gallery toggles its visibility as the
  // search / filter / hide-previews state changes, and drives the view mode
  // (Gallery | Cover Flow) from one control. Empty (no favourites yet) → not mounted.
  const featuredMount = viewEl.querySelector<HTMLElement>('.featured-mount');
  let featuredHandle: FeaturedRowHandle | null = null;
  cleanups.push(() => featuredHandle?.destroy());
  // (Re)mount the featured hero strip with the given entries, destroying any prior
  // instance first. Called on mount and again whenever favourites change (a starred tool
  // joins the strip). Toggles `has-featured` so the layout collapses if the strip empties.
  function mountFeatured(entries: FeaturedEntry[]): void {
    if (!featuredMount) return;
    featuredHandle?.destroy();
    featuredHandle = entries.length
      // The 'gallery' favourites strip is STATIC now (Andy 2026-08-10): no marquee drift,
      // no example/preset cross-fade - a favourite is the tool's single template, swipe/drag
      // only. Cover Flow keeps its own motion, so only opt the gallery mode into staticStrip.
      ? mountFeaturedRow(featuredMount, entries, host, { viewMode: featuredView, staticStrip: featuredView === 'gallery' })
      : null;
    viewEl.querySelector('.gallery')?.classList.toggle('has-featured', entries.length > 0);
  }
  // Rebuild the strip from the current favourites, then re-apply visibility (a filtered /
  // searched view keeps it hidden).
  function refreshFeatured(): void {
    mountFeatured(featuredEntriesNow());
    updateFeaturedVisibility();
  }
  if (featuredMount) mountFeatured(featuredEntries);
  // Featured view-mode segmented control (Gallery | Cover Flow) in the filter popover - 
  // drives BOTH strips.
  // Scoped to the Featured-view seg specifically - the hook is segHtml()'s own
  // `data-be-seg` name, not the (translated) aria-label, so another .view-seg landing in
  // this popover later can't be grabbed by mistake.
  // The popover is view options only: Theme lives in the profile menu + /profile
  // Appearance, Sound/Neurospicy on the /profile sound card, so neither is duplicated here.
  const viewSeg = viewEl.querySelector<HTMLElement>('.view-seg[data-be-seg="featured-view"]');
  const paintViewSeg = (): void => viewSeg?.querySelectorAll<HTMLElement>('[data-view]').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.view === featuredView)));
  paintViewSeg();
  viewSeg?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-view]');
    if (!btn) return;
    const next = btn.dataset.view as FeaturedViewMode;
    const changed = next !== featuredView;
    featuredView = next;
    try { localStorage.setItem(FEATURED_VIEW_STORAGE, featuredView); } catch { /* storage off */ }
    paintViewSeg();
    // Re-mount (not setViewMode) so the strip re-reads `staticStrip` for the new mode:
    // Gallery is static, Cover Flow animates. setViewMode only flips `coverflow` and leaves
    // `reduced`/the variant queue armed from mount, so a Cover Flow → Gallery switch would
    // keep drifting - exactly the marquee we're killing (Andy 2026-08-10).
    if (changed) {
      refreshFeatured();
      // Each mode has its own character: Cover Flow = cool & futuristic, Gallery = refined.
      playSfx(featuredView === 'coverflow' ? 'coverflow' : 'gallery');
    }
  });
  // Landing state only: the strip is noise above a searched/filtered grid. It is KEPT
  // (collapsed to icon + text via .hide-previews) when previews are off - it doesn't
  // disappear, so the featured picks stay reachable.
  function updateFeaturedVisibility(): void {
    const show = !query && activeCat === 'all';
    if (featuredMount && featuredHandle) { featuredMount.hidden = !show; featuredHandle.setVisible(show); }
  }

  // A demo preview can be absent - it's a build artifact (catalog/previews/) that,
  // though committed, can be missing on a fresh checkout / before `npm run previews`,
  // or drift from the index. The hero img then errors; drop the broken <img> and let
  // the always-present icon backdrop (rendered behind every preview) stand in, so the
  // card shows the tool's own icon rather than a broken image - never a blank or
  // broken tile. Error events don't bubble, so listen in the capture phase. Saved-
  // session thumbs are data: URLs and never hit this path.
  masonry?.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.classList.contains('gtile-hero-img')) return;
    const hero = img.closest('.gtile-hero--preview');
    if (!hero) return; // a saved-session hero failing is handled elsewhere; only demo previews
    // Reveal the hero: the armed cascade keys off .is-ready, normally added on img
    // *load* - which now never fires - so add it here or the tile stays invisible
    // under .previews-armed. The icon backdrop behind the (now-removed) img shows through.
    img.remove();
    hero.classList.add('is-ready', 'gtile-hero--icononly');
  }, true);

  // Demo previews start hidden on the cold paint (the masonry is "previews-armed" - 
  // see armPreviewReveal) and fade in only once their image has actually decoded, so
  // the first view never flashes a blank or half-loaded preview - each appears on its
  // own as it arrives. Like the error handler above, load doesn't bubble → capture.
  masonry?.addEventListener('load', (e) => {
    // A committed preview is usually an <img>, but an animated HTML card is an <iframe>
    // (see previewMedia) - both fire a capture-phase load, and both reveal the hero.
    const el = e.target;
    if (!((el instanceof HTMLImageElement || el instanceof HTMLIFrameElement) && el.classList.contains('gtile-hero-img'))) return;
    el.closest('.gtile-hero--preview')?.classList.add('is-ready');
  }, true);

  // First-visit "open what you see": a left-click on an example preview - or anywhere on a
  // card whose strip is currently showing an example look - opens the tool SEEDED with that
  // exact look, rather than a blank session. So the carousel state you're looking at is the
  // first setup you land in (openExample). Modified / middle clicks fall through to the
  // slide's plain href, so cmd/ctrl/middle-click still open a fresh tab. Delegated on the
  // persistent masonry node (attached once) so it survives the innerHTML rebuilds in render().
  masonry?.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const target = e.target as HTMLElement;
    // Controls with their own behaviour (resume, the selection dot, carousel nav/dots)
    // already stopPropagation or preventDefault; skip anything inside them defensively.
    // The "+ New" chip too: it must reach the template chooser un-seeded, so the
    // example-look hijack below must never claim its click.
    if (target.closest('.gcar-nav, .gcar-dot, [data-resume], [data-select], .gtile-new')) return;
    const tile = target.closest<HTMLElement>('.gtile');
    const gcar = tile?.querySelector<HTMLElement>('.gcar');
    if (!tile || !gcar) return;
    // A click landing ON an example slide uses THAT slide; a click on the card's name / body
    // uses whichever look is currently centred. Either way, null → not an example (paged page,
    // resume frame, or no strip) → leave the default new-session open untouched.
    const clickedSlide = target.closest<HTMLElement>('.gcar-slide[data-ex-index]');
    const idx = clickedSlide ? Number(clickedSlide.dataset.exIndex) : activeExampleIndex(gcar);
    if (idx === null || Number.isNaN(idx)) return;
    e.preventDefault();
    void openExample(tile.dataset.toolId!, idx, tile);
  });

  // The cover links (.gcar-open carousel covers, .gtile-hero tile previews) are
  // aria-hidden duplicates of the card's real name link, kept clickable for mouse +
  // right-click-open. They must never RECEIVE focus: focus inside an aria-hidden
  // subtree is exactly what trips Chrome's "Blocked aria-hidden ... descendant retained
  // focus" console warning. Preventing mousedown's default blocks the focus move (and
  // text-selection) without cancelling the click, so navigation and open-in-new-tab
  // still fire. tabindex="-1" already keeps them out of the tab order.
  masonry?.addEventListener('mousedown', (e) => {
    if ((e.target as HTMLElement).closest('.gcar-open, .gtile-hero')) e.preventDefault();
  });

  const searchStatus = viewEl.querySelector<HTMLElement>('.gallery-search-status');
  const filterFab  = viewEl.querySelector<HTMLButtonElement>('.filter-fab');
  const filterPop  = viewEl.querySelector<HTMLElement>('.filter-popover');
  const filterBackdrop = viewEl.querySelector<HTMLElement>('.filter-backdrop');

  // `#/?cat=&sort=&dir=` seed the browse state for THIS mount - the shape a shared
  // link, a docs recipe or a screenshot run needs to land on a known view. They
  // OUTRANK the stored preferences below but are never written back into
  // localStorage: a link someone pasted must not rewrite their own sort. Like `q`
  // and the `?tool=`/`?history=` flags, they're read at mount and never propagated
  // into a generated link. An unknown value is ignored (the stored default stands).
  const routeParams = new URLSearchParams(opts.params || '');
  let activeCat = 'all';   // active category pill
  // The pill vocabulary exactly: 'all', the favourites sentinel, and whatever
  // categories this profile actually shows (feature flags + only-mode already
  // pruned them). A Set, so an inherited key like 'constructor' can't answer yes.
  const urlCat = routeParams.get('cat');
  if (urlCat && new Set<string>(['all', FAV_CAT, ...visibleCats]).has(urlCat)) activeCat = urlCat;
  let query = initialQuery.toLowerCase();  // current search text (lowercased)
  // The query folded + tokenized ONCE per change (mount + each debounced
  // keystroke), not per tile - matchesQuery runs over every tile per applyView.
  let queryTokens = tokenize(initialQuery);
  let sortKey: SortKey = 'recent';   // global sort default; persisted like the theme
  try {
    const saved = localStorage.getItem(SORT_KEY_STORAGE);
    if (saved && (SORT_KEYS as readonly string[]).includes(saved)) sortKey = saved as SortKey;
  } catch { /* storage off */ }
  const urlSort = routeParams.get('sort');
  if (urlSort && (SORT_KEYS as readonly string[]).includes(urlSort)) sortKey = urlSort as SortKey;
  let sortDir: SortDir = 'desc';   // 'asc' reverses whatever key is active (last results first)
  try {
    const savedDir = localStorage.getItem(SORT_DIR_STORAGE);
    if (savedDir === 'asc' || savedDir === 'desc') sortDir = savedDir;
  } catch { /* storage off */ }
  const urlDir = routeParams.get('dir');
  if (urlDir === 'asc' || urlDir === 'desc') sortDir = urlDir;
  // Entrance reveal runs the cascade once, on the cold mount - not when returning
  // from a tool (cards are already known) nor on filter/search re-renders (those
  // show instantly). Tracked here so render() can decide and disconnect cleanly.
  const isReturning = viewEl.classList.contains('is-returning');
  // (…and not on the mount that upgrades a slim paint to the full index either -
  // upgradesSlimPaint, decided at the top of this mount. See slimPaintedGrid.)
  // Read once at mount, like darkTheme below: the hero rotation timer and the
  // entrance cascade are both decided as the view is built, so a toggle mid-session
  // takes effect on the next gallery visit.
  // A capture run counts as reduced motion for the same reason the featured row does:
  // the tile cross-fade and the entrance cascade are JS-driven, so the harness's
  // FREEZE_CSS cannot still them, and a tile that has flipped to a different example
  // look between two runs rewrites the baseline. See featured-row.ts's `reduced`.
  const prefersReduced = prefersReducedMotion() || captureNeutralPinned();
  // Which theme-tagged example looks the tiles show (transparent-ink looks are filtered
  // to the matching UI theme - see galleryExampleLooks). Read once at mount, like the
  // featured row; switching theme refreshes on the next gallery visit.
  const darkTheme = currentTheme() !== 'light';
  let firstPaint = true;
  let revealObserver: IntersectionObserver | null = null;
  cleanups.push(() => revealObserver?.disconnect());   // render() replaces it; unmount drops the last one

  // Ambient cross-fade for tiles with several saved sessions - the tile cycles
  // through that tool's recent session previews (the same dissolve the featured
  // strip uses). ONE timer scans the DOM each tick, so it survives the masonry
  // re-renders that search / filter / favourite toggles trigger without any
  // per-render re-wiring. Work is staggered across phases (tiles don't all flip
  // at once), and skips tiles that are off-screen or hovered (leave the one the
  // user is aiming at still). Paused wholesale while the tab is hidden; disabled
  // outright under reduced motion (OS or the app's own pref). Torn down via the
  // cleanup registry.
  const HERO_ROTATE_MS = 2100;
  const HERO_ROTATE_PHASES = 3;
  if (!prefersReduced) {
    let heroTick = 0;
    const heroTimer = setInterval(() => {
      if (document.hidden || !masonry) return;
      heroTick++;
      const vh = window.innerHeight || document.documentElement.clientHeight;
      // Read every hero's rect in ONE pass up front, then act - measuring inside the
      // loop would interleave layout reads with the class writes below and thrash.
      const heroes = [...masonry.querySelectorAll<HTMLElement>('.gtile-hero--rotate')];
      const heroRects = heroes.map(h => h.getBoundingClientRect());
      heroes.forEach((hero, i) => {
        if (i % HERO_ROTATE_PHASES !== heroTick % HERO_ROTATE_PHASES) return; // stagger
        const r = heroRects[i]!;
        if (!r.width) return;                      // filtered-out (display:none) tile
        if (r.bottom < 0 || r.top > vh) return;   // off-screen - don't animate
        if (hero.matches(':hover')) return;        // let the user look while aiming
        const frames = [...hero.querySelectorAll<HTMLImageElement>('.gtile-hero-frame')];
        // Only cross-fade to a DECODED frame - a not-yet-decoded one would fade in
        // blank. Until ≥2 have decoded the tile just holds its first frame.
        const ready = frames.filter(f => f.complete && f.naturalWidth > 0);
        if (ready.length < 2) return;
        const cur = ready.findIndex(f => f.classList.contains('is-active'));
        const next = (cur + 1 + ready.length) % ready.length;
        frames.forEach(f => f.classList.remove('is-active'));
        ready[next]!.classList.add('is-active');
      });
    }, HERO_ROTATE_MS);
    cleanups.push(() => clearInterval(heroTimer));
  }

  // ── Example preview strips (carousels) ──────────────────────────────────────
  // A tile with manifest `examples` is a horizontally-scrollable strip: the newest saved
  // session (if any) then a few live-rendered example states. Each example <img> is empty
  // in the markup and rendered lazily - serial, on idle, cached in host.previews under the
  // same `featured:<id>:<i>` key the hero row uses - only once its tile nears the viewport,
  // so a gallery full of example-bearing tools never fires hundreds of off-screen renders.
  const ricIdle = (cb: () => void): number =>
    (typeof requestIdleCallback === 'function' ? requestIdleCallback(cb, { timeout: 3000 }) : setTimeout(cb, 60)) as unknown as number;
  const exJobs: Array<() => Promise<void>> = [];
  let exRunning = false;
  const pumpEx = (): void => {
    if (exRunning) return;
    const job = exJobs.shift();
    if (!job) return;
    exRunning = true;
    ricIdle(() => { void job().finally(() => { exRunning = false; pumpEx(); }); });
  };
  // A paged tool (multi-page-pdf): render each page and rebuild the strip's slides +
  // dots from them (page count is unknown until rendered). The track element persists,
  // so its listeners survive; nav/dots are delegated off .gcar (see wireCarousel).
  async function hydratePaged(gcar: HTMLElement, toolId: string, tool: GalleryTool): Promise<void> {
    if (gcar.dataset.pagedDone === '1') return;
    let urls: string[];
    try {
      urls = await renderFeaturedPages(host, toolId, tool.formats);
    } catch (e) {
      host.log?.('warn', `Gallery pages failed for ${toolId}`, { error: String((e as { message?: unknown })?.message ?? e) });
      return;
    }
    const track = gcar.querySelector<HTMLElement>('.gcar-track');
    if (!gcar.isConnected || !track || !urls.length) return;
    gcar.dataset.pagedDone = '1';
    const openHref = `#/tool/${escape(toolId)}`;
    // Multi-page content reads as a swipeable STACK, not a flat carousel - the same
    // language as carousel-maker's featured card. Show the first few pages as an offset,
    // slightly-rotated deck (front page on top, the rest peeking behind). Cap at 3: enough
    // to say "multiple pages" without clutter; the real page-by-page view is the tool.
    const shown = urls.slice(0, 3);
    // Two layers per page: an OUTER square layer (.gcar-deck-page) carries the fan offset +
    // rotation - expressed as % of the square box, so the spread stays constant no matter the
    // page shape (a razor-thin 5:1 banner fans by the same amount as a portrait sheet). The
    // INNER image (.gcar-deck-card) is sized to the page's real aspect (deckPageFit) so its
    // shadow + rim wrap the true sheet. Seed the size from the manifest render size (no load
    // flash for the common case); the image's own dimensions correct it below.
    const seed = deckPageFit((tool.width && tool.height) ? tool.width / tool.height : 1);
    const pages = shown.map((u, k) =>
      // --d = depth: 0 = front (on top), higher = further back. Positioned + z-ordered in CSS.
      `<span class="gcar-deck-page" style="--d:${k}"><img class="gcar-deck-card" style="width:${seed.w.toFixed(2)}%;height:${seed.h.toFixed(2)}%" src="${u}" alt="" aria-hidden="true" decoding="async"></span>`,
    ).join('');
    track.outerHTML =
      `<a class="gcar-open gcar-deck" href="${openHref}" data-new-tool="${escape(toolId)}" tabindex="-1" aria-hidden="true">${pages}</a>`;
    gcar.classList.add('has-art', 'gcar--deck');   // pages rendered → stop the waiting tracer
    // Correct each card to the decoded image's true aspect (authoritative - covers tools
    // whose rendered page differs from, or omits, its manifest size, incl. wide banners).
    gcar.querySelectorAll<HTMLImageElement>('.gcar-deck-card').forEach(img => {
      const fit = (): void => {
        if (!img.naturalWidth || !img.naturalHeight) return;
        const f = deckPageFit(img.naturalWidth / img.naturalHeight);
        img.style.width = `${f.w.toFixed(2)}%`;
        img.style.height = `${f.h.toFixed(2)}%`;
      };
      if (img.complete) fit();
      else img.addEventListener('load', fit, { once: true });
    });
    // The deck is a static preview - it has no per-page nav/dots (unlike the old carousel).
    gcar.querySelectorAll('.gcar-nav, .gcar-dots').forEach(el => el.remove());
  }

  async function hydrateCarousel(gcar: HTMLElement): Promise<void> {
    const toolId = gcar.dataset.tool;
    const tool = toolId ? toolById.get(toolId) : undefined;
    if (!tool) return;
    const fmt = displayFormatOf(tool.formats);
    if (!fmt) return;
    // perf-ui: skip the live grid-tile preview render (renderFeaturedVariant / renderFeaturedPages
    // rasterise on the main thread) - settle the tile on its static icon instead. Adding has-art
    // stops the waiting tracer so it reads as done, not stuck. Off by default ⇒ byte-identical.
    if (perfUiOn()) { gcar.classList.add('has-art'); return; }
    if (gcar.dataset.paged === '1') { await hydratePaged(gcar, toolId!, tool); return; }
    const looks = resolveExamples(tool);
    const slides = [...gcar.querySelectorAll<HTMLElement>('.gcar-slide--ex')];
    // The one place a look's src is set, so every path shares the same load bookkeeping -
    // and an `error` path. That matters now the bundle is a MANIFEST: a bundled look is a
    // URL, and a URL can 404 (a look file deleted from the catalog, a half-copied deploy,
    // a manifest that ran ahead of the previews). An inlined data-URL never could, so the
    // old code only listened for `load` - and a missing file left the tile's waiting tracer
    // spinning forever on an <img> that would never fire it. Callers that have a fallback
    // pass onError and get the SAME degradation a stale sig already takes: live render.
    const paint = (
      slide: HTMLElement,
      img: HTMLImageElement,
      src: string,
      placeholder = false,
      onError?: () => void,
    ): void => {
      if (placeholder) img.dataset.ph = '1'; else delete img.dataset.ph;
      img.addEventListener('load', () => {
        slide.classList.add('is-loaded');
        gcar.classList.add('has-art');   // first rendered look → stop the waiting tracer
      }, { once: true });
      if (onError) img.addEventListener('error', onError, { once: true });
      img.src = src;
    };

    // The live engine render: the fallback for a look with no bundle entry, one whose sig is
    // stale, and one whose FILE is missing (paint's onError above). That last case must ask
    // for the render under its own cache namespace, because renderFeaturedVariant consults
    // the look manifest itself for the 'featured' namespace (lib/featured-render.ts) - asked
    // the ordinary way it would hand straight back the URL that just 404'd, and the tile would
    // settle on a broken <img> instead of the render this fallback exists to produce. The
    // separate key is honest as well as necessary: it holds the look the bundle could NOT
    // serve, so the next visit (which 404s again) reuses the render instead of repeating it.
    type LiveJob = { slide: HTMLElement; img: HTMLImageElement; i: number; values: Record<string, unknown> };
    const renderLive = async ({ slide, img, i, values }: LiveJob, fileMissing = false): Promise<void> => {
      if (!gcar.isConnected) return;                         // tile replaced by a re-render
      try {
        const thumb = await renderFeaturedVariant(host, toolId!, tool.formats, i, values, fileMissing ? 'featured-missing' : 'featured');
        if (!gcar.isConnected) return;
        paint(slide, img, thumb);
      } catch (e) {
        host.log?.('warn', `Gallery example failed for ${toolId}`, { error: String((e as { message?: unknown })?.message ?? e) });
      }
    };

    // The tool's own committed preview goes in FIRST, before any await: it is a static file
    // the tile can show while the look manifest is still in flight, so the strip is never an
    // empty box waiting on the network (or on the tiles queued ahead of it in exJobs). The
    // real look replaces it below. data-ph marks it as a placeholder so neither the swap nor
    // a re-hydration mistakes it for a rendered look. Only the leading slide gets one - the
    // rest are off-view until the strip is scrolled, and a lead slide (session thumb or
    // authored card) already shows real art, so there is nothing to stand in for. Skipped
    // during a docs capture: a placeholder that never got swapped would be a difference the
    // vector baselines compare exactly (see captureNeutralPinned in armCarousels).
    if (!captureNeutralPinned() && tool.preview && !isHtmlPreview(tool.preview) && !gcar.querySelector('.gcar-slide--lead')) {
      const first = slides[0]?.querySelector<HTMLImageElement>('.gcar-img');
      if (first && !first.getAttribute('src')) paint(slides[0]!, first, tool.preview, true);
    }

    // Bundled looks all resolve off ONE memoised manifest fetch, so every slide asks at
    // once and paints the moment its entry resolves. Only a look with NO bundle entry falls
    // through to the live engine render, and those stay strictly serial - each is a ~350 ms
    // off-screen render plus a main-thread rasterise. The old loop awaited the whole chain
    // in order, which put the cheap manifest lookups behind the expensive renders (and, when
    // the bundle still inlined every look, put all of a tile's art behind a 2.6 MB download).
    const live: LiveJob[] = [];
    await Promise.all(slides.map(async (slide) => {
      const img = slide.querySelector<HTMLImageElement>('.gcar-img');
      if (!img || (img.getAttribute('src') && !img.dataset.ph)) return;   // already rendered
      const i = Number(slide.dataset.exIndex);
      const v = looks[i];
      if (!v) return;
      const values = v.values as Record<string, unknown>;
      const src = await bundledLook(toolId!, i, JSON.stringify(values)).catch(() => null);
      if (!gcar.isConnected) return;                       // tile replaced by a re-render
      // A 404 repairs itself as soon as the browser reports it, rather than joining the
      // serial queue below: the queue exists to keep the COMMON case of live renders off
      // the main thread, and a missing look file is exceptional (one tile, one render).
      if (src) { paint(slide, img, src, false, () => { void renderLive({ slide, img, i, values }, true); }); return; }
      live.push({ slide, img, i, values });
    }));
    for (const job of live) {
      if (!gcar.isConnected) return;
      await renderLive(job);
    }
  }
  let carouselObserver: IntersectionObserver | null = null;
  function armCarousels(): void {
    carouselObserver?.disconnect();
    carouselObserver = null;
    if (!masonry) return;
    const cars = [...masonry.querySelectorAll<HTMLElement>('.gcar')];
    if (!cars.length) return;
    // Legacy (no IntersectionObserver) hydrates every strip; a capture run takes the
    // same path deliberately. Observer-driven hydration is a race against the capture:
    // which strips had fired depended on timing, so the same page serialised a strip
    // more or fewer between runs (±26% and ±3% swings). Hydrating the whole set makes
    // the CONTENT fixed, and settleForCapture then waits for it - off-frame strips are
    // dropped by the shot pipeline's own cull, so this costs bytes in neither direction.
    if (typeof IntersectionObserver === 'undefined' || captureNeutralPinned()) {
      cars.forEach(g => exJobs.push(() => hydrateCarousel(g)));
      pumpEx();
      return;
    }
    carouselObserver = new IntersectionObserver((entries, obs) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        obs.unobserve(e.target);
        exJobs.push(() => hydrateCarousel(e.target as HTMLElement));
        pumpEx();
      }
    }, { rootMargin: '250px 0px' });
    cars.forEach(g => carouselObserver!.observe(g));
  }
  cleanups.push(() => carouselObserver?.disconnect());

  // Motion previews (plans/155 WP-5.3). hover:false because the tile's own pointerenter
  // hook (wireCards) already drives hover - this arm covers keyboard focus everywhere and,
  // on a device with no hover, the centered-tile observer. Re-armed on each full paint
  // because innerHTML replaced the elements the previous observer held.
  let motionPreviews: { destroy(): void } | null = null;
  function armMotion(): void {
    motionPreviews?.destroy();
    motionPreviews = masonry ? armMotionPreviews(masonry, { hover: false }) : null;
  }
  cleanups.push(() => motionPreviews?.destroy());

  // Move to a given slide (by index) and by ±1 (with wrap for the auto-advance loop),
  // then reflect it in the dots. Uses smooth native scroll so touch, trackpad and this
  // code all land on the same scroll-snap points.
  function setCarDot(gcar: HTMLElement, idx: number): void {
    gcar.querySelectorAll<HTMLElement>('.gcar-dot').forEach((d, k) => d.classList.toggle('is-active', k === idx));
  }
  // The strip's box is a FIXED SQUARE (parts/gallery.css .gcar) and every slide is
  // object-fit:contain, so differently-shaped example looks fit within one unchanging
  // frame - no per-look reflow as the carousel advances (which used to jitter the whole
  // masonry). Nothing here resizes the box any more.
  function scrollCarTo(gcar: HTMLElement, idx: number): void {
    const track = gcar.querySelector<HTMLElement>('.gcar-track');
    if (!track || !track.clientWidth) return;
    track.scrollTo({ left: idx * track.clientWidth, behavior: 'smooth' });
    setCarDot(gcar, idx);
  }
  // Child indices of the slides that are actually READY to show - a lead frame (a real
  // src from the start) or an example/page slide whose art has decoded (.is-loaded).
  // Auto-advance and prev/next cycle ONLY these, so a strip with several previews still
  // pending never rotates onto a not-yet-loaded slide's flat skeleton; the set grows as
  // each preview decodes and hydrateCarousel adds .is-loaded.
  function readyCarIndices(track: HTMLElement): number[] {
    const out: number[] = [];
    const kids = track.children;
    for (let i = 0; i < kids.length; i++) {
      const s = kids[i] as HTMLElement;
      if (s.classList.contains('gcar-slide--lead') || s.classList.contains('is-loaded')) out.push(i);
    }
    return out;
  }
  function advanceCarousel(gcar: HTMLElement, dir: number, wrap: boolean): void {
    const track = gcar.querySelector<HTMLElement>('.gcar-track');
    if (!track || !track.clientWidth) return;
    const ready = readyCarIndices(track);
    if (ready.length < 2) return;   // 0–1 loaded → nothing to rotate through yet
    const cur = Math.round(track.scrollLeft / track.clientWidth);
    // Where the centred slide sits within the ready set. If the strip is parked on a
    // slide that hasn't loaded (e.g. a manual dot jump), fall back to the last ready
    // slide at or before it, so the next step still lands on a decoded frame.
    let pos = ready.indexOf(cur);
    if (pos === -1) { pos = 0; for (let k = 0; k < ready.length; k++) if (ready[k]! <= cur) pos = k; }
    let next = pos + dir;
    if (next >= ready.length) next = wrap ? 0 : ready.length - 1;
    if (next < 0) next = wrap ? ready.length - 1 : 0;
    scrollCarTo(gcar, ready[next]!);
  }
  function wireCarousel(gcar: HTMLElement): void {
    const track = gcar.querySelector<HTMLElement>('.gcar-track');
    if (!track) return;
    // Delegated nav/dot clicks off the .gcar root, so the paged path can rebuild the
    // dots/arrows (unknown page count) with no re-wiring. A click on a slide link (not a
    // nav/dot) falls through untouched, so it still opens the tool.
    gcar.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('.gcar-prev')) { e.preventDefault(); advanceCarousel(gcar, -1, true); }
      else if (t.closest('.gcar-next')) { e.preventDefault(); advanceCarousel(gcar, 1, true); }
      else { const dot = t.closest<HTMLElement>('.gcar-dot'); if (dot) { e.preventDefault(); scrollCarTo(gcar, Number(dot.dataset.i)); } }
    });
    // pointer/wheel/touch = the user; NOT the programmatic scrollTo above (which emits no
    // such event), so auto-advance can't pause itself. Sync the dots on any scroll.
    track.addEventListener('scroll', () => { if (track.clientWidth) setCarDot(gcar, Math.round(track.scrollLeft / track.clientWidth)); }, { passive: true });
  }

  // The example index of the slide currently centred in a carousel, or null when that
  // slide isn't an example (the resume/lead frame, a document page, or an empty strip).
  // Lets a click anywhere on the card open the SAME look the strip is showing right now.
  function activeExampleIndex(gcar: HTMLElement): number | null {
    const track = gcar.querySelector<HTMLElement>('.gcar-track');
    if (!track) return null;
    const centred = track.querySelectorAll<HTMLElement>('.gcar-slide')[Math.round(track.scrollLeft / (track.clientWidth || 1))];
    const raw = centred?.dataset.exIndex;
    return raw === undefined ? null : Number(raw);
  }

  // Open a tool seeded with one of its manifest example looks - the first-visit path where
  // the preview the user clicked (or is watching) becomes the tool's opening configuration.
  // The seeded URL is built by the shared `toolSeedHref` helper (also used by the featured
  // row) so parseUrlState in the tool view seeds the identical inputs the tile rendered from,
  // and the two surfaces never drift; any failure falls back to a blank session.
  async function openExample(toolId: string, exIndex: number, tile?: HTMLElement | null): Promise<void> {
    tile?.classList.add('is-navigating');
    const tool = toolById.get(toolId);
    const values = tool ? resolveExamples(tool)[exIndex]?.values : undefined;
    window.location.hash = await toolSeedHref(toolId, values);
  }

  // No auto-advance: the example strips move only when the USER moves them
  // (arrows, dots, swipe/scroll). The old shared ticker rotated every visible
  // strip on a stagger - retired 2026-07-09 by request; a busy grid of
  // self-scrolling cards read as noise, and reduced-motion users already had
  // the static behaviour this makes universal.

  const byName = (a: GalleryTool, b: GalleryTool) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  const primaryFmt = (t: GalleryTool) =>
    (t.exportable !== false && Array.isArray(t.formats) && t.formats.length) ? fmtLabel(t.formats[0]!) : '';

  // Compare two filtered tools by the active sort. Every sort falls back to name so
  // the order is fully stable (ties never reshuffle between renders).
  function sortCompare(a: GalleryTool, b: GalleryTool): number {
    const r = ((): number => {
      switch (sortKey) {
        case 'az': return byName(a, b);
        case 'za': return byName(b, a);
        case 'recent': {
          // Pinned leads first (LEAD_TOOL_ORDER), then newest-appended first.
          const la = leadRank.get(a.id) ?? -1, lb = leadRank.get(b.id) ?? -1;
          if (la !== lb) return la < 0 ? 1 : lb < 0 ? -1 : la - lb;
          return (orderById.get(b.id)! - orderById.get(a.id)!) || byName(a, b);
        }
        case 'category': return (categoryRank(a.category ?? 'other') - categoryRank(b.category ?? 'other')) || byName(a, b);
        case 'format': {
          const fa = primaryFmt(a), fb = primaryFmt(b);
          if (fa !== fb) { if (!fa) return 1; if (!fb) return -1; return fa.localeCompare(fb); } // formatless (transforms) last
          return byName(a, b);
        }
        default: return byName(a, b);
      }
    })();
    // 'asc' flips the whole order (tiebreaker included) so the last results lead.
    return sortDir === 'asc' ? -r : r;
  }

  // The stable, full tile set: every tool that could ever show in the grid (feature
  // flags hide whole categories). Utilities live in the bottom strip in the default
  // browse view, but they ARE rendered as (hidden) grid tiles too so a search can
  // surface them - matchesQuery gates them to query-only (see below).
  // Search / category / sort only ever hide-show or reorder THIS set's tiles - they
  // never change membership - so we render it to the DOM once and mutate in place.
  const allTools: GalleryTool[] = index.tools.filter(t => !hidden.has(t.category));

  // Per-tool search haystacks, folded ONCE at mount (the tool set is stable - 
  // see allTools above): localized name/description PLUS the pristine English
  // stash (`en`, written by localizeToolIndex - plans/99 section 2e) so a Spanish
  // session still finds "Compress PDF" by "compress", plus the tags. Weights
  // are all 1 - this view only gates on match/no-match, it never ranks.
  const searchFields = new Map<string, SearchField[]>(allTools.map(t => [
    t.id,
    [t.name, t.en?.name, t.description, t.en?.description, ...(t.tags ?? []),
      // Template + preset names/categories (plans/142): the curated starting points
      // are the discovery layer - "poster" must find Design via its Poster template
      // even though no tool is called poster. Search-only, like tags.
      ...(t.templates ?? []).flatMap(tp => [tp.name, tp.category, tp.description,
        ...(tp.presets ?? []).map(p => p.name)]),
    ]
      .filter((s): s is string => !!s)
      .map(text => ({ text: fold(text), weight: 1 })),
  ]));

  // The search + active-category predicate, WITHOUT the sort (assumes the tool is
  // already in allTools). Drives the in-place hide-show; sort is applied separately.
  function matchesQuery(t: GalleryTool): boolean {
    const q = query.trim();
    // Utilities live in their own `#/u` view now and NEVER appear in the main
    // gallery - not even via search (the Utilities view has its own search box).
    // In only-mode they're ordinary tiles and take the normal path below.
    if (t.category === 'utility' && !opts.only) return false;
    // Tags carry the vocabulary the name and description do not: a tool called
    // "Finish Preview" is what someone searching "foil" or "spot uv" wants, and
    // "Imperfections" is what they want for "riso". Tags are search-only - they
    // are never rendered, so this widens recall without changing any tile.
    // lib/search semantics (plans/99 M3): folded, multi-word queries AND across
    // tokens over name + English stash + description + tags.
    if (q) {
      return scoreHaystack(searchFields.get(t.id) ?? [], queryTokens) > 0;
    }
    if (activeCat === FAV_CAT) return favourites.has(t.id);   // starred collection
    return activeCat === 'all' || t.category === activeCat;
  }

  function renderPills(): void {
    if (!pillbar) return;
    // `hidden` already excludes 'utility' in the main gallery and everything
    // else in the Utilities view, so it's the one membership test needed.
    const total = index.tools.filter(t => !hidden.has(t.category ?? 'other') && !hiddenTools.has(t.id)).length;
    const allActive = activeCat === 'all' && !query;
    let html = `<button class="gallery-pill${allActive ? ' active' : ''}" data-cat="all" type="button" aria-pressed="${allActive}">${t('All')}<span class="ct">${total}</span></button>`;
    // Favourites - the starred collection. Always shown (even at 0) so it's discoverable;
    // clicking into an empty one explains how to add.
    const favActive = activeCat === FAV_CAT && !query;
    html += `<button class="gallery-pill gallery-pill--fav${favActive ? ' active' : ''}" data-cat="${FAV_CAT}" type="button" aria-pressed="${favActive}"><span class="pill-star" aria-hidden="true">★</span>${t('Favourites')}<span class="ct">${favCount()}</span></button>`;
    for (const cat of visibleCats) {
      const n = grouped[cat]!.filter(t => !hiddenTools.has(t.id)).length;
      const active = activeCat === cat && !query;
      html += `<button class="gallery-pill${active ? ' active' : ''}" data-cat="${escape(cat)}" type="button" aria-pressed="${active}">${escape(t(catLabel(cat)))}<span class="ct">${n}</span></button>`;
    }
    pillbar.innerHTML = html;
  }

  // toolId → its live tile node, rebuilt only on a full render() (rare). applyView()
  // reads it to reorder + hide-show the existing tiles without re-stringifying them.
  const tileById = new Map<string, HTMLElement>();
  // Persistent empty-state line - a real node (not markup) so it survives the in-place
  // filter passes; shown/hidden + re-messaged by applyView(). Lives inside the masonry
  // after the tiles, so with every tile hidden it's the only flowed column item.
  const noResults = document.createElement('p');
  noResults.className = 'gallery-no-results';
  noResults.hidden = true;

  // The grey "Show hidden tools" box - a persistent non-tile node like noResults,
  // kept LAST in the grid by applyView(). Present only while something in this
  // view's scope is hidden; clicking toggles the (per-mount) reveal, under which
  // hidden tiles show dimmed at the end of the grid with Unhide in their menus.
  // textContent only - no markup, so no new raw-HTML sink.
  const hiddenBox = document.createElement('button');
  hiddenBox.type = 'button';
  hiddenBox.className = 'gtile gtile--hiddenbox';
  hiddenBox.hidden = true;
  hiddenBox.addEventListener('click', () => { showHiddenTools = !showHiddenTools; applyView(); });
  // Everything hidden in THIS view's scope: grid tools (allTools already excludes
  // hidden categories) plus, in the Utilities view, hidden view cards.
  const hiddenInScope = (): number =>
    allTools.filter(t => hiddenTools.has(t.id)).length
    + (opts.only === 'utility' ? utilityViews(speechOk).filter(v => hiddenTools.has(viewFavKey(v.id))).length : 0);

  // FULL rebuild: re-stringify EVERY tile in the stable set. Costly (re-inlines base64
  // session thumbs, re-hydrates example <img>s, recreates observers), so it runs only
  // on mount and when the underlying tool SET changes (a saved session deleted). Search
  // / category / sort / direction go through applyView() instead - nodes stay live.
  function render(): void {
    if (!masonry) return;
    // View-backed tiles lead the utility grid; they carry no data-tool-id, so the
    // sort pass below (which re-appends tool tiles in order) leaves them in place
    // at the front rather than shuffling them among the tools.
    const viewCards = opts.only === 'utility' ? utilityViews(speechOk).map(v => viewCardMarkup(v)).join('') : '';
    // Which tiles get eager, high-priority art. Sorted the way applyView() is about to
    // reorder the live nodes - `allTools`' own order is NOT the on-screen order, so
    // taking the first N of it would hand the priority hint to tiles further down the
    // grid. Search/category can still filter an eager tile out of view, but neither is
    // set on the cold load this exists for. mountFeatured() has already run by here, so
    // featuredHandle answers whether a hero row is taking the top of the viewport (and
    // the LCP image with it) - fewer grid tiles are above the fold when it is.
    const eagerIds = new Set(
      [...allTools].sort(sortCompare).filter(t => !hiddenTools.has(t.id))
        .slice(0, featuredHandle ? EAGER_TILES_WITH_HERO : EAGER_TILES).map(t => t.id),
    );
    masonry.innerHTML = viewCards + allTools
      .map(t => cardMarkup(t, latestByTool(t.id), host.capabilities, personalizedByTool.get(t.id), thumbsByTool(t.id), darkTheme, opts.only === 'utility', eagerIds.has(t.id)))
      .join('');
    masonry.append(noResults);
    masonry.append(hiddenBox);
    tileById.clear();
    for (const el of masonry.querySelectorAll<HTMLElement>('.gtile')) {
      const id = el.dataset.toolId;
      if (id) tileById.set(id, el);
    }
    wireCards(masonry);
    // Order + hide-show the fresh tiles BEFORE measuring geometry for the reveal
    // cascade, so the wave reads in final on-screen order.
    revealObserver?.disconnect();
    const animateReveal = firstPaint && !isReturning && !prefersReduced && !upgradesSlimPaint;
    applyView();
    revealObserver = revealCards(masonry, animateReveal);
    // The preview reveal is the one thing a slim paint must NOT arm (plans/155 Task
    // 4.3). Armed, a demo-preview hero sits at opacity:0 until its image decodes - and
    // the icon backdrop lives INSIDE that hero, so arming it on the paint whose whole
    // purpose is "named tiles before any art" would hide the very placeholder the task
    // asks for. Un-armed, each tile shows its icon + the .gtile-iconfill-trace shimmer
    // immediately and the art appears over it as it arrives (the delegated load handler
    // still stamps .is-ready, which is what stops the shimmer - it is not gated on the
    // armed class).
    armPreviewReveal(masonry, animateReveal && !paintedFromSlim);
    armCarousels();   // lazily hydrate example preview strips as their tiles near the viewport
    armMotion();      // motion previews: hover/focus on a mouse, the centered tile on touch
    firstPaint = false;
    // Hand THIS grid to the mount that will upgrade it, if it is a slim paint (see
    // slimPaintedGrid). Nothing to hand on otherwise - the top of the mount already
    // cleared the slot, so a paint from the full index can't leave one standing.
    if (paintedFromSlim) slimPaintedGrid = new WeakRef(masonry);
    // Capture only: stamp the view once every image (including the strips armCarousels
    // is still hydrating) has decoded, so a `waitSelector=` recipe frames a final page.
    settleForCapture(viewEl);
  }

  // IN-PLACE update for search / category / sort / direction - the hot path. Reorders
  // the existing tile nodes (append keeps them live, preserving hydrated <img src> and
  // IntersectionObserver registrations) and toggles a hide class on non-matching ones;
  // it never touches innerHTML, so nothing re-decodes and no observer is recreated.
  function applyView(): void {
    if (!masonry) return;
    renderPills();
    // Dot on the filter trigger whenever a non-default category OR non-default sort
    // is in effect, so the collapsed control still signals "a view choice is active".
    filterFab?.classList.toggle('has-active', activeCat !== 'all' || sortKey !== 'recent' || sortDir !== 'desc');
    // Show the hero row only in the default landing state - a search or category
    // filter makes it noise above the results. Toggle the mount + pause its motion.
    updateFeaturedVisibility();
    // Reorder: append the tiles in sorted order (moves live nodes, no re-render) - 
    // hidden tools trail the visible set so a reveal reads as "the hidden ones, at
    // the end" - then keep the empty-state + Show-hidden nodes last.
    const ordered = [...allTools].sort(sortCompare);
    for (const t of ordered) { if (hiddenTools.has(t.id)) continue; const el = tileById.get(t.id); if (el) masonry.append(el); }
    for (const t of ordered) { if (!hiddenTools.has(t.id)) continue; const el = tileById.get(t.id); if (el) masonry.append(el); }
    masonry.append(noResults);
    masonry.append(hiddenBox);
    // Hide-show: filtered-out tiles get .is-filtered (display:none); count the shown.
    // A hidden tool only ever shows while the reveal is on, and then dimmed
    // (.is-hidden-tool) - search and the Favourites pill skip it otherwise.
    let shown = 0;
    for (const t of allTools) {
      const el = tileById.get(t.id);
      if (!el) continue;
      const isHidden = hiddenTools.has(t.id);
      const match = matchesQuery(t) && (!isHidden || showHiddenTools);
      el.classList.toggle('is-filtered', !match);
      el.classList.toggle('is-hidden-tool', isHidden);
      if (match) shown++;
    }
    // The view tiles aren't in `allTools`, so match them on their own text. Without
    // this a search for "qr" would leave Colour Lab sitting above zero results.
    // The Favourites pill applies to them too (their star writes a view: key into
    // the same favourites list); other category pills leave them showing, as ever.
    for (const v of (opts.only === 'utility' ? utilityViews(speechOk) : [])) {
      const el = masonry.querySelector<HTMLElement>(`[data-view-card="${v.id}"]`);
      if (!el) continue;
      // Same lib/search semantics as matchesQuery (folded, token AND) - a search
      // that found "café" for tools but not view cards would read as a bug.
      const q = query.trim();
      const vHidden = hiddenTools.has(viewFavKey(v.id));
      const match = (!q || scoreHaystack([{ text: fold(`${v.name} ${v.description}`), weight: 1 }], queryTokens) > 0)
        && (activeCat !== FAV_CAT || favourites.has(viewFavKey(v.id)))
        && (!vHidden || showHiddenTools);
      el.classList.toggle('is-filtered', !match);
      el.classList.toggle('is-hidden-tool', vHidden);
      if (match) shown++;
    }
    // The Show-hidden box: last in the grid, only while this view's scope has hidden
    // tiles, label flipping with the reveal. Plain text (see its creation above).
    const nHidden = hiddenInScope();
    hiddenBox.hidden = nHidden === 0;
    hiddenBox.textContent = showHiddenTools ? t('Hide hidden tools') : t('Show hidden tools ({n})', { n: nHidden });
    hiddenBox.setAttribute('aria-pressed', String(showHiddenTools));
    // Re-apply the selection highlight - render() rebuilds tiles unselected, and a
    // filter pass may have moved tiles under a live selection.
    paintSelection();
    if (shown === 0) {
      noResults.innerHTML = query
        ? tRaw('No tools match "<strong>{query}</strong>" - {button}', { query: escape(query.trim()), button: `<button type="button" class="gallery-retry" data-search-clear>${t('clear search')}</button>` })
        : activeCat === FAV_CAT
          ? t('No favourites yet - tap the <span class="star-inline" aria-hidden="true">★</span> on any tool to add it here.')
          : t('No tools to show.');
    }
    noResults.hidden = shown > 0;
    if (searchStatus) {
      searchStatus.textContent = query ? (shown === 1 ? t('1 result') : t('{n} results', { n: shown })) : '';
    }
  }

  function wireCards(container: HTMLElement): void {
    // Example preview strips: arrows, dots, and pause-on-interaction. Re-wired each
    // render since innerHTML replaced the elements the prior listeners were bound to.
    container.querySelectorAll<HTMLElement>('.gcar').forEach(wireCarousel);
    // Hover on a tile's open affordance means the same thing twice: prefetch the tool's
    // files, and (plans/155 WP-5.3) start its motion preview if it has one. Both ride this
    // ONE listener rather than a second hover listener stacked on the same element - the
    // pointer-fine half of the playback policy, with armMotionPreviews below covering
    // keyboard focus and the touch case. pointerleave stops and rewinds.
    container.querySelectorAll<HTMLElement>('[data-new-tool]').forEach(el => {
      el.addEventListener('pointerenter', () => {
        prefetchTool(el.dataset.newTool);
        playMotionIn(el);
      });
      el.addEventListener('pointerleave', () => stopMotionIn(el));
      el.addEventListener('click', () => el.closest('.gtile')?.classList.add('is-navigating'));
    });
    // Resume the latest session (the hero preview).
    container.querySelectorAll<HTMLElement>('[data-resume]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        el.closest('.gtile')?.classList.add('is-navigating');
        window.location.hash = `#/tool/${el.dataset.resume}?slot=${encodeURIComponent(el.dataset.slot!)}`;
      });
    });
    // Favourite / offline / About / history moved off the card: they live in the
    // context menu (right-click / long-press) and the selection toolbar, so the
    // card itself stays a clean open-or-resume surface.
  }

  if (pillbar) {
    pillbar.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-cat]');
      if (!btn) return;
      activeCat = btn.dataset.cat!;
      if (query) { query = ''; queryTokens = []; setSearchBarValue(''); }
      applyView();
      // applyView() rebuilds the pills, dropping focus - restore it to the active one
      // so keyboard users aren't bounced to the top of the tab order. The popover
      // stays open so the choice (and the Hide-previews toggle) remain in reach.
      pillbar.querySelector<HTMLElement>('.gallery-pill.active')?.focus();
    });
  }

  // ── Filter popover: anchored dropdown on desktop, bottom sheet on mobile. ──
  // Matches the color-field popover conventions (Escape + outside-pointerdown
  // close, focus returns to the trigger).
  // The lifecycle (toggle `hidden`, aria-expanded, outside-pointerdown dismissal,
  // Escape, backdrop, focus restore) is the shared one in components/body-popover.ts - 
  // the catalog's view-options popover rides the same helper.
  const filterDisclosure = wireDisclosure(filterFab, filterPop, {
    backdrop: filterBackdrop,
    // Land on the active category pill so the popover's main choice is under the
    // keyboard immediately.
    initialFocus: pop => pop.querySelector<HTMLElement>('.gallery-pill.active, .gallery-pill'),
  });
  // If the view is torn down with the popover open, its document-level pointerdown
  // listener would outlive the detached tree - close() is idempotent and its default
  // returnFocus=false makes this a no-op when already closed.
  cleanups.push(() => filterDisclosure.close());

  // Sound + Neurospicy are no longer in this popover either: the app-level prefs live on
  // the /profile sound card (components/sound-toggle.ts's soundSwitchHtml), so the gallery
  // no longer imports sound-toggle at all - the ambient-audio modules it statically pulls
  // (atmosphere/neurospicy) stay off this route entirely, not just off the boot chunk.

  // "Hide previews" is no longer a per-gallery toggle: it moved to the profile's
  // Accessibility card as the "Hide colourful previews" pref (lib/a11y-prefs.ts),
  // and the CSS that collapses cards + the featured strip now keys off
  // html[data-a11y-previews="hidden"] directly - nothing to wire here.

  // Global sort - persisted like the theme; re-renders the grid in place.
  const sortSelect = viewEl.querySelector<HTMLSelectElement>('.gallery-sort');
  if (sortSelect) {
    sortSelect.value = sortKey;
    sortSelect.addEventListener('change', () => {
      sortKey = sortSelect.value as SortKey;
      try { localStorage.setItem(SORT_KEY_STORAGE, sortKey); } catch { /* storage off */ }
      applyView();   // reorder the live tiles in place - no re-render
    });
  }

  // Direction toggle: flips the active sort so the last results show first.
  const sortDirBtn = viewEl.querySelector<HTMLButtonElement>('.gallery-sort-dir');
  if (sortDirBtn) {
    const syncDirBtn = (): void => {
      const asc = sortDir === 'asc';
      sortDirBtn.classList.toggle('is-asc', asc);
      sortDirBtn.setAttribute('aria-pressed', String(asc));
      sortDirBtn.setAttribute('aria-label', asc ? t('Sort direction: oldest / last first') : t('Sort direction: newest / first first'));
      sortDirBtn.title = asc ? t('Showing last results first - click for the usual order') : t('Reverse - show the last results first');
    };
    syncDirBtn();
    sortDirBtn.addEventListener('click', () => {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      try { localStorage.setItem(SORT_DIR_STORAGE, sortDir); } catch { /* storage off */ }
      syncDirBtn();
      applyView();   // reorder the live tiles in place - no re-render
    });
  }

  // The search field lives in the persistent shell bar (components/search-bar.ts,
  // plans/99 M1) - the view claims it with its placeholder + the live-filter tap
  // and releases on unmount. The ✕, Escape ladder and debounce are the bar's.
  cleanups.push(claimSearchBar({
    placeholder: opts.only ? t('Search utilities…') : t('Search tools…'),
    ariaLabel: opts.only ? t('Search utilities') : t('Search tools'),
    value: initialQuery,
    // Type-to-find on fine-pointer devices (the bar skips touch so the keyboard
    // doesn't pop over the gallery).
    autoFocus: true,
    onQuery: (raw) => { query = raw.toLowerCase(); queryTokens = tokenize(raw); applyView(); },
  }));

  // "clear search" link inside the empty-state line (rebuilt by applyView). The <p> node
  // persists across renders, so one delegated listener covers every future message.
  noResults.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-search-clear]')) clearSearchBar({ focus: true });
  });

  // Global saved-sessions overlay (folders over all tool + batch sessions),
  // opened from the history button beside the profile pill - and, on mobile, from
  // the consolidated profile menu (the standalone history button is hidden there).
  // User images are loaded lazily so folders that also hold images render here too.
  const historyFab = viewEl.querySelector<HTMLButtonElement>('.history-fab');
  async function openHistoryOverlay(): Promise<void> {
    // The thin recents dialog (plans/133 WP-10): the reopen rail + a Projects
    // hand-off. The full folder manager lives in /p now - one folder UI to
    // maintain; per-tool resume stays on the gallery cards' saved badges.
    const { openRecentsDialog } = await import('../components/recents-dialog.ts');
    await openRecentsDialog({
      savedCount: sortedSaved.length,
      // One-click resume (plans/142 W4): the freshest sessions, captioned by
      // filename first, else their tool's display name.
      // The web state bridge's list() carries filename + thumb beyond the HostV1
      // StateEntry (bridge/state.ts); the gallery's own type is the narrow one.
      sessions: (sortedSaved as Array<typeof sortedSaved[number] & { filename?: string | null; thumb?: string | null }>).slice(0, 8).map(e => ({
        slot: e.slot, toolId: e.toolId,
        name: e.filename || nameById.get(e.toolId) || e.toolId,
        thumb: e.thumb, updatedAt: e.updatedAt,
      })),
    });
  }
  historyFab?.addEventListener('click', openHistoryOverlay);

  // A tool's saved-sessions dialog (the context menu's sessions row and the ?history deep-link
  // both land here). Deletes update the in-memory lists + FAB count immediately;
  // the heavy masonry re-render is deferred to onClose, which also restores focus
  // to the card's (stable) info button so keyboard focus isn't dropped to <body>.
  function openHistoryFor(tool: GalleryTool): void {
    showHistoryDialog(tool, entriesByTool.get(tool.id) ?? [], sessionSizes, host, {
      onDelete: (slot) => {
        const arr = entriesByTool.get(tool.id) ?? [];
        const ai = arr.findIndex(x => x.slot === slot);
        if (ai >= 0) arr.splice(ai, 1);
        const si = sortedSaved.findIndex(x => x.slot === slot);
        if (si >= 0) sortedSaved.splice(si, 1);
        const count = historyFab?.querySelector('.history-fab-count');
        if (count) count.textContent = String(sortedSaved.length);
        if (historyFab && sortedSaved.length === 0) historyFab.hidden = true;
      },
      onClose: () => {
        render();
        // Focus lands on the card's name link (the stable per-card control now that
        // the icon row is gone), so keyboard focus isn't dropped to <body>.
        tileById.get(tool.id)?.querySelector<HTMLElement>('.gtile-name')?.focus();
      },
    });
  }

  // ── Group actions (bulk bar + bulk context menu) and the per-tile context menu ──

  /** A tile's display name - tool name or view-card name - for announcements. */
  function refName(ref: string): string {
    return isViewRef(ref) ? (viewByRef(ref)?.name ?? ref) : (toolById.get(ref)?.name ?? ref);
  }

  /** Star or unstar the whole selection (smart toggle: all starred → unstar all). */
  function favouriteSelection(): void {
    if (!selected.size) return;
    const on = !allSelectedFav();
    for (const ref of selected) { if (on) favourites.add(ref); else favourites.delete(ref); }
    void saveFavourites(host, profile, favourites);
    refreshFeatured();
    applyView();
    announce(on ? t('{n} added to favourites', { n: selected.size }) : t('{n} removed from favourites', { n: selected.size }));
  }

  /** Hide (or unhide, when the whole selection is already hidden) the selection. */
  async function hideSelection(): Promise<void> {
    if (!selected.size) return;
    const unhide = allSelectedHidden();
    const n = selected.size;
    for (const ref of selected) { if (unhide) hiddenTools.delete(ref); else hiddenTools.add(ref); }
    await saveHiddenTools(host, profile, hiddenTools);
    dropSelection();
    refreshFeatured();   // a hidden tool leaves the hero strip
    applyView();
    announce(unhide ? t('{n} unhidden', { n }) : t('{n} hidden - find them under “Show hidden tools”', { n }));
  }

  /** Hide/unhide one tile from its context menu. */
  async function hideOne(ref: string): Promise<void> {
    const unhide = hiddenTools.has(ref);
    if (unhide) hiddenTools.delete(ref); else hiddenTools.add(ref);
    await saveHiddenTools(host, profile, hiddenTools);
    if (selected.delete(ref)) paintSelection();
    refreshFeatured();
    applyView();
    announce(unhide ? tRaw('{name} unhidden', { name: refName(ref) }) : tRaw('{name} hidden - find it under “Show hidden tools”', { name: refName(ref) }));
  }

  /** Pin or unpin one tool (context-menu path) - same lifecycle as the tile button. */
  async function pinOne(id: string): Promise<void> {
    if (isViewRef(id) || unavailableIds.has(id)) return;
    const on = !pinnedTools.has(id);
    const nm = toolById.get(id)?.name ?? id;
    try {
      if (on) {
        const manifest = await pinTool(id, ids => prefetchAssetsById(host as unknown as Parameters<typeof prefetchAssetsById>[0], ids));
        pinnedTools.add(id);
        warmEditorChunk(manifest.render?.layout);
        playSfx('victory');
      } else {
        await unpinTool(id);
        pinnedTools.delete(id);
      }
      announce(on ? tRaw('{name} is available offline', { name: nm }) : tRaw('{name} removed from offline', { name: nm }));
    } catch (err) {
      host.log('warn', 'Offline pin failed', { toolId: id, error: String(err) });
      announce(tRaw('Couldn’t save {name} for offline - check your connection', { name: nm }), { assertive: true });
    }
  }

  /**
   * Pin (or unpin) every pinnable tool in the selection as a BACKGROUND JOB, so the
   * run survives leaving the gallery and cancels from the global job toast. The bulk
   * bar is free again the moment the job is handed off - the toast owns the progress
   * line now, which is what stops a long run from disabling its own ✕ Clear.
   *
   * heavy: false - fetch + IndexedDB writes, no wasm inference, so this must neither
   * queue behind nor block a model job (the same rule lib/offline-run.ts states).
   * Cancel is cooperative: pinTool has no abort, so the loop polls between tools and
   * whatever was already pinned stays pinned. Failures are logged, the run continues.
   */
  function pinSelection(): void {
    const unpin = allSelectedPinned();
    const ids = pinnableIds().filter(id => (unpin ? pinnedTools.has(id) : !pinnedTools.has(id)));
    if (!ids.length) return;
    const job = startJob({
      title: unpin ? t('Remove from offline') : t('Downloading for offline'),
      heavy: false,
      cancel: () => { /* cooperative - the loop polls job.cancelled between tools */ },
    });
    void (async () => {
      let failed = 0, done = 0;
      for (const id of ids) {
        if (job.cancelled) break;
        job.progress(done, ids.length, toolById.get(id)?.name ?? id);
        try {
          if (unpin) { await unpinTool(id); pinnedTools.delete(id); }
          else {
            const manifest = await pinTool(id, arr => prefetchAssetsById(host as unknown as Parameters<typeof prefetchAssetsById>[0], arr));
            pinnedTools.add(id);
            warmEditorChunk(manifest.render?.layout);
          }
        } catch (err) {
          failed++;
          host.log('warn', 'Offline pin failed', { toolId: id, error: String(err) });
        }
        done++;
      }
      job.progress(done, ids.length);
      job.finish();
      // The bar's pin label reads off pinnedTools - refresh it only while this
      // gallery is still the mounted view.
      if (mounted) syncBulkBar();
      const ok = done - failed;
      if (!unpin && ok > 0 && !job.cancelled) playSfx('victory');
      if (failed) announce(t('{n} saved for offline, {m} failed - check your connection', { n: ok, m: failed }), { assertive: true });
      else announce(unpin ? t('{n} removed from offline', { n: ok }) : t('{n} available offline', { n: ok }));
    })();
  }

  /** Land in Projects filtered to the selected tools' saved sessions. */
  function viewSessionsForSelection(): void {
    const ids = sessionToolIds();
    if (!ids.length) return;
    window.location.hash = `#/p?tools=${ids.map(encodeURIComponent).join(',')}`;
  }

  // multi-edit's cap - the only ceiling here. "Edit as sheet" (Batch) has none,
  // which is exactly the reassurance the dialog leans on: pick a few now, add more later.
  const MAX_TOGETHER = MULTI_EDIT_MAX;

  /** "Make copies…" - list the selected tools, let the user choose how many fresh
   *  copies of EACH to start with (native number fields, default 1), then open them
   *  side by side (multi-edit, ≤8) or as rows in the Batch grid (no limit). The
   *  copies are ordinary saved sessions seeded from each tool's defaults, so
   *  "you can add more later" is literally true - they land in Projects. */
  function openCopiesDialog(ids: string[]): void {
    if (ids.length < 2) return;
    const nameOf = (id: string): string => toolById.get(id)?.name ?? id;
    const rows = ids.map(id => `
      <li class="copies-row">
        <span class="copies-name">${escape(nameOf(id))}</span>
        <input class="copies-count" type="number" inputmode="numeric" min="1" max="99" value="1"
          data-copy-id="${escape(id)}" aria-label="${t('Copies of {name}', { name: nameOf(id) })}">
      </li>`).join('');
    const content = `
      <h2 class="modal-title" id="copies-title">${escape(t('Make copies'))}</h2>
      <p class="modal-msg">${escape(t('Pick how many of each to start with. You can add more later.'))}</p>
      <ul class="copies-list">${rows}</ul>
      <p class="copies-total" aria-live="polite"></p>
      <div class="modal-actions">
        <button type="button" class="btn" data-act="cancel"><span>${escape(t('Cancel'))}</span></button>
        <button type="button" class="btn" data-dest="batch">${SHEET_ICON}<span>${escape(t('Edit as sheet'))}</span></button>
        <button type="button" class="btn modal-primary" data-dest="multi">${EDIT_ICON}<span>${escape(t('Edit together'))}</span></button>
      </div>`;
    const modal = mountModal(content, {
      className: 'modal copies-dialog',
      ariaLabel: t('Make copies'),
      initialFocus: (el) => el.querySelector<HTMLElement>('.copies-count'),
    });
    const countInputs = (): HTMLInputElement[] => [...modal.el.querySelectorAll<HTMLInputElement>('.copies-count')];
    const counts = (): Array<{ id: string; n: number }> =>
      countInputs().map(inp => ({ id: inp.dataset.copyId!, n: Math.max(1, Math.min(99, Math.floor(Number(inp.value) || 1))) }));
    const total = (): number => counts().reduce((s, c) => s + c.n, 0);
    const together = modal.el.querySelector<HTMLButtonElement>('[data-dest="multi"]')!;
    const totalLine = modal.el.querySelector<HTMLElement>('.copies-total')!;
    const refresh = (): void => {
      const n = total();
      totalLine.textContent = t('{n} copies in total', { n });
      together.disabled = n > MAX_TOGETHER;
      together.title = n > MAX_TOGETHER ? t('Up to {n} for editing together - use a sheet for more', { n: MAX_TOGETHER }) : '';
    };
    refresh();
    let busy = false;
    modal.el.addEventListener('input', (e) => { if ((e.target as HTMLElement).classList?.contains('copies-count')) refresh(); });
    modal.el.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act],[data-dest]');
      if (!el) return;
      if (el.dataset.act === 'cancel') { modal.close(); return; }
      const dest = el.dataset.dest === 'multi' ? 'multi' : 'batch';
      if (busy) return;
      busy = true;
      for (const b of modal.el.querySelectorAll<HTMLButtonElement>('button')) b.disabled = true;
      void (async () => {
        try {
          const plan = planCopies(counts(), nameOf, Date.now());
          for (const p of plan) await host.state.save(p.slot, { __toolId: p.toolId, __label: p.label }, null);
          announce(t('{n} copies added to your projects', { n: plan.length }));
          modal.close();
          window.location.hash = `#/${dest}?s=${plan.map(p => encodeURIComponent(p.slot)).join(',')}`;
        } catch (err) {
          console.error('Make copies failed:', err);
          announce(t('Couldn’t make the copies'), { assertive: true });
          busy = false;
          for (const b of modal.el.querySelectorAll<HTMLButtonElement>('button')) b.disabled = false;
          refresh();   // restore the together-cap disable the reset above cleared
        }
      })();
    });
  }

  /** Copy the canonical link for one tile: /t/<id> for a tool (the crawler-visible
   *  share stub), the app route for a view card. Flashes "Copied!" on the trigger. */
  async function copyLink(ref: string | null, feedbackBtn: HTMLElement | null = null): Promise<void> {
    if (!ref) return;
    const v = isViewRef(ref) ? viewByRef(ref) : null;
    const link = v
      ? `${location.origin}${location.pathname}${v.href}`
      : `${location.origin}/t/${encodeURIComponent(ref)}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      announce(t('Couldn’t copy the link'), { assertive: true });
      return;
    }
    announce(t('Link copied'));
    const span = feedbackBtn?.querySelector('span');
    if (feedbackBtn && span) {
      const orig = span.textContent;
      span.textContent = t('Copied!');
      feedbackBtn.classList.add('is-copied');
      setTimeout(() => { span.textContent = orig; feedbackBtn.classList.remove('is-copied'); }, 1200);
    }
  }

  /** Bulk bar (and bulk context menu) dispatch. */
  async function handleBulk(action: string): Promise<void> {
    if (action === 'clear') { dropSelection(); return; }
    if (action === 'fav') { favouriteSelection(); return; }
    if (action === 'hide') { await hideSelection(); return; }
    if (action === 'pin') { pinSelection(); return; }
    if (action === 'copies') { openCopiesDialog(copyableIds()); return; }
    if (action === 'sessions') { viewSessionsForSelection(); return; }
    if (action === 'info') {
      const ref = [...selected][0];
      if (!ref) return;
      if (isViewRef(ref)) { const v = viewByRef(ref); if (v) showViewInfoDialog(v); }
      else showInfoDialog(toolById.get(ref), host, darkTheme);
      return;
    }
    if (action === 'copylink') {
      await copyLink([...selected][0] ?? null, viewEl.querySelector<HTMLElement>('.gallery-bulkbar [data-bulk="copylink"]'));
    }
  }

  /** The per-tile context menu rows (right-click / long-press). */
  function tileMenuHtml(ref: string): string {
    const menuItemHtml = ctxMod!.menuItemHtml;   // set: only reached via the lazy ctx-menu callbacks
    const fav = favourites.has(ref);
    const hiddenNow = hiddenTools.has(ref);
    if (isViewRef(ref)) {
      const v = viewByRef(ref);
      if (!v) return '';
      return [
        menuItemHtml('open', OPEN_ICON, t('Open')),
        menuItemHtml('fav', STAR_ICON, fav ? t('Remove from favourites') : t('Add to favourites')),
        menuItemHtml('copylink', LINK_ICON, t('Copy link')),
        menuItemHtml('info', INFO_ICON, t('About')),
        menuItemHtml('hide', EYE_ICON, hiddenNow ? t('Unhide') : t('Hide')),
      ].join('');
    }
    const tool = toolById.get(ref);
    if (!tool) return '';
    const unavailable = unavailableIds.has(ref);
    const n = countByTool(ref);
    // "Start a collab" - a private (P2P) collab pairs two devices on this tool from its
    // current state; from a tile that state is the tool's defaults (a blank-slate co-edit),
    // and the pairing's remount-on-connect brings the tool up on both ends. The gate is
    // the shared availability seam (lib/collab-availability.ts, plans/108 Phase 1), asked
    // fresh on every menu open, so this row and the in-tool Share dialog's Private-collab
    // row read one rule: the `private-collab` flag (default on, may be user-/org-off) AND
    // a registered opener. No per-tool capability - private collab works for any tool that
    // can mount, which is what `mountable` tells the seam about an unavailable tool.
    const collabStart = canStartCollab({ kind: 'tool', toolId: ref, mountable: !unavailable }, 'private');
    return [
      unavailable ? '' : menuItemHtml('open', OPEN_ICON, t('Open')),
      menuItemHtml('fav', STAR_ICON, fav ? t('Remove from favourites') : t('Add to favourites')),
      unavailable ? '' : menuItemHtml('pin', DOWNLOAD_ICON, pinnedTools.has(ref) ? t('Remove from offline') : t('Available offline')),
      n > 0 ? menuItemHtml('history', HISTORY_ICON, n === 1 ? t('1 saved session') : t('{n} saved sessions', { n })) : '',
      collabStart ? menuItemHtml('collab', USERS_ICON, t('Start a collab')) : '',
      menuItemHtml('copylink', LINK_ICON, t('Copy link')),
      menuItemHtml('info', INFO_ICON, t('About')),
      menuItemHtml('hide', EYE_ICON, hiddenNow ? t('Unhide tool') : t('Hide tool')),
    ].join('');
  }

  /** The bulk context menu (right-click inside a multi-selection) - mirrors the bar.
   *  Head outside the nested role="menu" list, per the shared a11y shape. */
  function bulkMenuHtml(): string {
    const menuItemHtml = ctxMod!.menuItemHtml;   // set: only reached via the lazy ctx-menu callbacks
    return `<p class="folder-menu-head">${t('{n} selected', { n: selected.size })}</p>`
      + `<div class="folder-menu-list" role="menu" aria-label="${escape(t('Selection actions'))}">${[
        pinnableIds().length ? menuItemHtml('pin', DOWNLOAD_ICON, allSelectedPinned() ? t('Remove from offline') : t('Available offline')) : '',
        copyableIds().length >= 2 ? menuItemHtml('copies', COPIES_ICON, t('Make copies…')) : '',
        sessionToolIds().length ? menuItemHtml('sessions', HISTORY_ICON, t('View sessions')) : '',
        menuItemHtml('fav', STAR_ICON, allSelectedFav() ? t('Unfavourite') : t('Favourite')),
        menuItemHtml('hide', EYE_ICON, allSelectedHidden() ? t('Unhide') : t('Hide')),
      ].join('')}</div>`;
  }

  /** Context-menu dispatch - `ref` null means the bulk menu. */
  async function onMenuAction(act: string, ref: string | null): Promise<void> {
    if (ref === null) { await handleBulk(act); return; }
    if (act === 'open') {
      if (isViewRef(ref)) { const v = viewByRef(ref); if (v) window.location.hash = v.href; }
      else {
        const tool = toolById.get(ref);
        window.location.hash = `#/tool/${ref}${tool?.openQuery ? `?${tool.openQuery}` : ''}`;
      }
      return;
    }
    if (act === 'fav') {
      const on = !favourites.has(ref);
      if (on) favourites.add(ref); else favourites.delete(ref);
      void saveFavourites(host, profile, favourites);
      // The hero strip is favourites-only now, so any star toggle changes its membership.
      refreshFeatured();
      if (activeCat === FAV_CAT) applyView(); else renderPills();
      return;
    }
    if (act === 'pin') { await pinOne(ref); return; }
    if (act === 'history') { const tool = toolById.get(ref); if (tool) openHistoryFor(tool); return; }
    if (act === 'collab') {
      // A tile has no mounted runtime, so there is no live state to seed - a `'tool'`
      // target carries none, and the collab starts at the tool's defaults (a blank-slate
      // co-edit). The opener re-checks the flag itself and the ceremony overlay takes
      // over; on connect its own remount ('lolly:remount') brings the tool up on the
      // inviter's side. startCollab re-asks the seam and inherits openCollabLaunch's
      // tolerance, so a throwing or absent opener reads as a plain false here.
      if (startCollab({ kind: 'tool', toolId: ref, mountable: !unavailableIds.has(ref) }, 'private')) announce(t('Starting a collab'));
      return;
    }
    if (act === 'copylink') { await copyLink(ref); return; }
    if (act === 'info') {
      if (isViewRef(ref)) { const v = viewByRef(ref); if (v) showViewInfoDialog(v); }
      else showInfoDialog(toolById.get(ref), host, darkTheme);
      return;
    }
    if (act === 'hide') { await hideOne(ref); }
  }

  render();

  // ── Deep-link (read-only): open a card's dialog on mount. ───────────────────
  // Read the hash query directly (same shape as main.ts's peekUrlLang) - these
  // flags are this view's own, not router state (only `q` rides opts.params). `?tool=<id>`
  // opens that card's info dialog; adding the `history` flag (or `?history=<id>`)
  // opens its saved-sessions dialog instead; `welcome` re-opens the first-run
  // dialog (see the ladder below). Consumed here only - READ-ONLY flags,
  // never propagated into a generated share link. An unknown/absent id opens
  // nothing; the gallery just renders normally.
  const deepLink = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  const deepLinkTool = toolById.get(deepLink.get('tool') ?? deepLink.get('history') ?? '');
  if (deepLinkTool) {
    if (deepLink.has('history')) openHistoryFor(deepLinkTool);
    else showInfoDialog(deepLinkTool, host, darkTheme);
  }

  // ── First-run ladder: welcome dialog, else ONE banner ───────────────────────
  // The welcome + tips strip are for unbranded installs only, and whether the
  // welcome shows is what decides the banner slot (plans/137 A1), so the whole
  // ladder runs from here - after the unbranded answer, and after the search bar
  // has been claimed (the privacy strip measures that bar to pin itself).
  //
  // Unbranded = the shipped design system is the active one, or (with no
  // registry to ask) token discovery still resolves the lolly-start placeholder
  // `lolly/tokens/brand`; once the user installs a brand, neither is true and
  // this never fires again. The placeholder check rides on the
  // SYNCED asset metadata, so it can resolve null on a pre-sync mount (the
  // boot fast-path paints from the cached tool index before the asset sync
  // lands - including the eviction case where IndexedDB was dropped but the
  // localStorage index survived; main.ts's post-sync re-mount is gated on the
  // TOOL index bytes changing, which says nothing about the asset-meta store).
  // On null we re-run the check ONCE against the catalog index itself - the
  // same cold-load fallback the tokens bridge uses (bridge/tokens.ts
  // findTokensAsset). That's faithful: user tokens live in the same IndexedDB
  // as the asset meta, so a null here means the user store had none either,
  // and the index's first `tokens` asset is exactly what discovery will return
  // once the sync settles. We still only ever prompt off a non-null answer, so
  // the dialog can't flash on a genuinely branded install. Lazy-loaded, so
  // branded installs pay nothing; the continuation re-checks this gallery is
  // still mounted before touching the DOM (the trigger must never surface on
  // another view), and the dialog itself closes on any route change (see
  // components/welcome-dialog.ts) - no cleanup entry here, so the same-route
  // post-sync re-mount keeps it open without a flash.
  const galleryRoot = viewEl.querySelector<HTMLElement>('.gallery');
  void (async () => {
    let locked = false;
    let tokensId: string | undefined;
    let source: string | null = null;
    try {
      // A LOCKED brand (brandLock - e.g. the SUSE build) is branded by decree:
      // there's no brand question to settle, so never greet it with the welcome
      // or the tips strip, whatever the placeholder check below resolves to.
      locked = !!(await host.tokens?.isLocked?.());
      if (!locked) {
        // With a design-system registry the answer is simply which system is
        // active: the SHIPPED one means nothing of the person's is here yet
        // (plans/186 section 3.3). Without one there is no record to read and
        // the placeholder id below decides, exactly as it always has.
        source = await activeDesignSystemSource(host);
        if (!source) {
          tokensId = (await host.assets._findMetaByType('tokens'))?.id;
          if (tokensId === undefined && galleryRoot?.isConnected) {
            const resp = await instanceFetch(instancePath('/catalog/assets/index.json'));
            if (resp.ok) {
              const idx = await resp.json() as { assets?: Array<{ id?: string; type?: string }> };
              tokensId = idx.assets?.find(a => a.type === 'tokens')?.id;
            }
          }
        }
      }
    } catch { /* IDB unavailable / offline - treat as branded; never block or nag here */ }
    if (!galleryRoot?.isConnected) return;
    const unbranded = source ? source === 'shipped' : tokensId === 'lolly/tokens/brand';
    // Branded (or locked): no welcome to wait for, so the banner slot is free.
    // When no banner claims it, a first-run install gets the branded intro strip
    // (plans/140 S4) - same slot discipline, still one surface per visit. The
    // strip module gates itself out for installs with saved work and settles
    // when any tool opens.
    if (locked || !unbranded) {
      // Orientation FIRST on a branded install (plans/170 WP-4, audit 167
      // F-A16): a colleague's very first visit reads "Your brand is loaded…"
      // before any banner rung - the privacy one-liner is one line and keeps
      // its turn on the next visit. Still one surface per visit: the intro OR
      // a rung, never both. The settled-flag pre-check keeps the lazy chunk
      // off every later visit (the key mirrors welcome-dialog's
      // BRANDED_INTRO_KEY - keep the two literals in step).
      let introSettled = true;
      try { introSettled = localStorage.getItem('lolly-branded-intro-dismissed') === '1'; } catch { /* storage off - never nag */ }
      if (!introSettled) {
        const welcome = await import('../components/welcome-dialog.ts');
        if (!galleryRoot.isConnected) return;
        if (await welcome.mountBrandedIntro(viewEl.querySelector<HTMLElement>('.tool-masonry'), host.state)) return;
      }
      revealFirstRunBanner();
      return;
    }
    const welcome = await import('../components/welcome-dialog.ts');
    if (!galleryRoot.isConnected) return; // navigated away while the chunk loaded
    // 'brand' navigates itself; the upload host enables the "Bring your design" card.
    // A welcome visit is the whole ask - the banner stays hidden and the tips
    // strip waits for a later visit.
    // `#/?welcome` forces it open past the dismissed flag, so docs and screenshot
    // runs can capture the greeting deterministically instead of needing a virgin
    // profile. It rides INSIDE the ladder on purpose: everything above still
    // applies, so a locked or already-branded install has already returned and the
    // flag is silently ignored there - a deep link can't nag someone who has a brand.
    if (!welcome.isWelcomeDismissed() || deepLink.has('welcome')) {
      void welcome.showWelcomeDialog(host.profile, host as unknown as PickerHost);
      return;
    }
    if (revealFirstRunBanner()) return;
    welcome.mountBrandTips(viewEl.querySelector<HTMLElement>('.tool-masonry'));
  })();

  // Profile-personalized previews: once the user has opted in to "use my details",
  // re-render the few profile-bound tools that have no saved session - off the
  // critical path (idle, serial) - and lazily swap the personalized image into its
  // card. Feature-detected (host.previews) and scoped via canPersonalize(), so it's
  // a no-op for shells without the cache and for the ~24 tools whose output doesn't
  // change with the profile. The committed preview shows until the swap lands; cache
  // hits were already applied at mount above. See ../personalize-previews.js.
  if (previewSig && host.previews) {
    const cssEscape = (s: string) => (window.CSS && CSS.escape ? CSS.escape(s) : s);
    const toRegenerate = index.tools.filter(t =>
      canPersonalize(t) &&
      !latestByTool(t.id) &&                  // no saved session - only placeholders
      !personalizedByTool.has(t.id) &&        // not already fresh in cache
      toolSupport(t, host.capabilities, presentApis(host)).status !== 'unavailable',
    );
    if (toRegenerate.length) {
      const cancel = regeneratePreviews({
        host,
        tools: toRegenerate,
        sig: previewSig,
        onThumb: (toolId, dataUrl) => {
          personalizedByTool.set(toolId, dataUrl);   // so later re-renders keep it
          if (!masonry?.isConnected) return;         // navigated away mid-render
          const img = masonry.querySelector<HTMLImageElement>(
            `.gtile-hero--preview[data-new-tool="${cssEscape(toolId)}"] .gtile-hero-img`,
          );
          if (img) img.src = dataUrl;
        },
      });
      // Stop the idle render queue when the gallery is torn down or re-mounted
      // (navigate() in main.js calls view._cleanup), so it can't keep rendering
      // off-screen - or double up - after the user has moved on. Registered
      // alongside the featured row's teardown (both run from the one _cleanup).
      cleanups.push(cancel);
    }
  }
}

// ── Card markup ───────────────────────────────────────────────────────────

/**
 * Utility surfaces that are VIEWS rather than tools - pages in the app that
 * belong in the Utilities grid but have no manifest, no render and no session.
 *
 * They get a real tile, the same shape as a tool's, because to a user they are
 * the same kind of thing: something you open from this grid - including a
 * favourite action and a details dialog (via the context menu and the
 * selection toolbar, like every tile). A view's favourite lives in the SAME
 * profile favourites list as a tool's, under a `view:`-prefixed key
 * (viewFavKey) so it can never collide with a tool id (ids are permanent
 * contracts, so the namespace must be carved out, not hoped about). What a view
 * still doesn't get is keep-offline or saved-sessions: it ships with the app
 * shell (always offline-capable, nothing to pin) and has no session store - 
 * wiring those in WOULD mean inventing a fake tool for other subsystems to
 * believe in.
 */
interface UtilityView {
  id: string;
  href: string;
  icon: Parameters<typeof icon>[0];
  name: string;
  description: string;
}

/**
 * `speechOk` gates the Script-audio card on `host.speech?.isAvailable()` - 
 * every call site inside mountGallery passes the one flag computed at mount, so
 * the grid, the featured strip, search and the fav/info wiring can never
 * disagree about whether the card exists.
 */
const utilityViews = (speechOk: boolean): UtilityView[] => [{
  id: 'verify',
  href: '#/verify',
  // The same glyph the footer's Verify pill uses, deliberately: the card exists
  // because people miss that pill, so it has to read as the same destination
  // rather than as a second, separate thing.
  icon: 'shieldCheck',
  name: t('Verify & Inspect'),
  description: t('Check any file on-device: who made it, what it has been through, and what it hides. Metadata, attachments, scripts and tracking links.'),
}, {
  id: 'pdf-extract',
  href: '#/unpack',
  icon: 'document',
  name: t('Unpack'),
  description: t('Take a design file apart: the words, images, fonts, colours and marks inside a PDF, SVG, InDesign, Penpot, Figma, PowerPoint or Photoshop file, each one viewable and keepable. Nothing is uploaded.'),
}, {
  id: 'color-lab',
  href: '#/lab',
  icon: 'palette',
  name: t('Colour Lab'),
  description: t('Inspect any colour: where it lands in OKLCH, which displays can show it, how much chroma is left, and every notation.'),
}, {
  id: 'spreadsheet',
  href: '#/data',
  icon: 'grid',
  name: t('Spreadsheet'),
  description: t('Open, read and edit an .xlsx, .csv or .tsv on your device - no Excel or internet needed. Switch sheets, edit cells, download as CSV or Excel.'),
},
// Script audio only where the speech bridge exists - a card that opened a dead
// surface would break the grid's promise that every tile is something you can
// actually use here and now.
...(speechOk ? [{
  id: 'script-audio',
  href: '#/script',
  icon: 'speech' as const,
  name: t('Script audio'),
  description: t('Write a script and turn it into natural speech, generated on your device. Nothing you type is uploaded.'),
}] : [])];

/** The profile-favourites key for a utility VIEW card - namespaced so it can
 *  never collide with a tool id. */
const viewFavKey = (id: string): string => `view:${id}`;

/** The top-left multi-select dot every gallery tile carries - the same
 *  `.tile-check` primitive as projects/catalog tiles (folder-tiles.ts), with a
 *  gallery-scoped reveal (gallery.css). `ref` doubles as the tile's selection
 *  key: the tool id, or `view:<id>` for a utility view card. */
const selectDot = (ref: string, name: string): string =>
  `<button type="button" class="tile-check" data-select="${escape(ref)}" aria-pressed="false" aria-label="${escape(tRaw('Select {name}', { name }))}">${CHECK_ICON}</button>`;

function viewCardMarkup(v: UtilityView): string {
  return `
    <article class="gtile gtile--utility gtile--view" data-view-card="${escape(v.id)}" data-select-ref="${escape(viewFavKey(v.id))}">
      ${selectDot(viewFavKey(v.id), v.name)}
      <div class="gtile-body gtile-body--link">
        <div class="gtile-cap">
          <span class="tool-card-icon" aria-hidden="true">${icon(v.icon, { size: 24 })}</span>
          <span class="gtile-meta">
            ${/* nosemgrep: lolly-href-escape-is-not-scheme-validation - v.href comes from the hardcoded utilityViews() table ('#/verify', '#/unpack', '#/lab', '#/data', '#/script') */ ''}
            <a class="gtile-name" href="${escape(v.href)}">${escape(v.name)}</a>
            <p class="gtile-desc">${escape(v.description)}</p>
          </span>
        </div>
      </div>
    </article>`;
}

/** Details dialog for a utility VIEW card - the same spec-sheet chrome as a
 *  tool's, on the facts a view actually has (no manifest, no formats, no
 *  defaults - it's a page of the app). */
function showViewInfoDialog(v: UtilityView): void {
  const content = `
    <div class="meta-dialog-body">
      <header class="meta-dialog-head">
        <span class="tool-card-icon meta-dialog-icon" aria-hidden="true">${icon(v.icon, { size: 24 })}</span>
        <div>
          <h2 id="tool-info-title">${escape(v.name)}</h2>
          <p class="meta-dialog-sub">${escape(t('Utility'))} · ${escape(t('Built into the app'))}</p>
        </div>
      </header>
      <p class="meta-dialog-desc">${escape(v.description)}</p>
      <dl class="meta-dialog-facts">
        <div><dt>${t('Privacy')}</dt><dd>${t('Runs entirely on your device')}</dd></div>
        <div><dt>${t('Offline')}</dt><dd>${t('Ships with the app, so it always works offline')}</dd></div>
      </dl>
      <div class="meta-dialog-actions">
        ${/* nosemgrep: lolly-href-escape-is-not-scheme-validation - same hardcoded utilityViews() table route as the card link */ ''}
        <a class="btn meta-dialog-open" href="${escape(v.href)}">${t('Open utility')}</a>
        <button type="button" class="btn meta-dialog-close">${t('Close')}</button>
      </div>
    </div>`;
  playSfx('whisper'); // same airy elevation as the tool details dialog
  const modal = mountModal(content, { className: 'tool-meta-dialog' });
  modal.el.setAttribute('aria-labelledby', 'tool-info-title');
  modal.el.querySelectorAll('.meta-dialog-close').forEach(b => b.addEventListener('click', () => modal.close()));
  modal.el.querySelector('.meta-dialog-open')?.addEventListener('click', () => modal.close());
}

function cardMarkup(
  tool: GalleryTool,
  latest: SavedEntry | undefined,
  shellCaps: readonly string[] | undefined,
  personalizedThumb: string | undefined,
  sessionThumbs: string[] = [],
  darkTheme = false,
  utilityLayout = false,
  eager = false,
): string {
  const sup = toolSupport(tool, shellCaps);
  const unavailable = sup.status === 'unavailable';

  const statusBadge = unavailable
    ? `<span class="badge badge-desktop">${t('Desktop')}</span>`
    : sup.status === 'install'
      ? `<span class="badge badge-install">${t('Add&#8209;on')}</span>`
      : (tool.status !== 'official'
          ? `<span class="badge badge-${tool.status}"${tool.status === 'experimental' ? ` title="${escape(t('Experimental - exports carry a PREVIEW watermark until the tool graduates.'))}"` : ''}>${escape(t(statusLabel(tool.status) || ''))}</span>`
          : '');

  const iconSvg = tool.icon ? `<span class="tool-card-icon" aria-hidden="true">${tool.icon}</span>` : '';
  // A url-source injected tool opens preconfigured (its URL-mode query); every other
  // tool opens blank. escape() the query for the attribute (its & becomes &amp;).
  const openHref = `#/tool/${escape(tool.id)}${tool.openQuery ? `?${escape(tool.openQuery)}` : ''}`;

  // Utilities view (#/u): the icon alone is a clear enough affordance, so drop the
  // preview hero entirely and stack a larger icon ABOVE the title + description. The
  // card is a fixed landscape box (CSS clamps it between 4:3 and 16:9) so every tile
  // is the same height regardless of description length.
  if (utilityLayout) {
    const uHasSession = !!latest && !unavailable;
    const uName = unavailable
      ? `<span class="gtile-name" aria-disabled="true">${escape(tool.name)}</span>`
      : `<a class="gtile-name" href="${openHref}" data-new-tool="${escape(tool.id)}"${uHasSession ? ` aria-label="${escape(tRaw('Start a new {name} session', { name: tool.name }))}"` : ''}>${escape(tool.name)}</a>`;
    return `
      <article class="gtile gtile--utility${unavailable ? ' gtile--unavailable' : ''}" data-tool-id="${escape(tool.id)}" data-select-ref="${escape(tool.id)}">
        ${selectDot(tool.id, tool.name)}
        <div class="gtile-body${unavailable ? '' : ' gtile-body--link'}">
          <div class="gtile-cap">
            ${iconSvg}
            <span class="gtile-meta">
              ${uName}
              <p class="gtile-desc">${escape(tool.description ?? '')}</p>
            </span>
            ${statusBadge}
          </div>
        </div>
      </article>
    `;
  }
  const hasSession = !!latest && !unavailable;          // resumable, with or without a preview
  const hasThumbHero = hasSession && !!latest!.thumb;    // resumable AND has a preview image
  const hasPreview = !unavailable && !hasSession && !!tool.preview; // committed demo preview, no session yet
  // A committed AUTHORED card (tools/<id>/card.svg|png - e.g. pose-geeko's animated-Geeko
  // SVG, which animates natively in an <img>) is served from /tools/, unlike a generated
  // preview (/catalog/previews/…). When a tool ALSO has examples, we lead its carousel
  // with this card so the tile opens on the tool's real, often-animated hero and then
  // swipes to the example looks - the best of "show the motion" + "show the range".
  const animCard = (!unavailable && tool.preview && tool.preview.startsWith('/tools/')) ? tool.preview : null;
  // Paged tool (render.paged, e.g. multi-page-pdf): the tile shows the pages as a stacked
  // DECK (hydratePaged) rather than input-variant looks. Needs a displayable (svg/raster)
  // format. A paged tool that ships its OWN authored card (carousel-maker's hand-tuned
  // stacked-deck card.svg - animCard) is EXCLUDED so it shows that card directly, identical
  // to the featured hero, instead of a live-rendered deck that would drift from it.
  const paged = !unavailable && !!tool.paged && !!displayFormatOf(tool.formats) && !animCard;
  // Example looks (manifest.examples) turn the tile into a horizontally-scrollable
  // preview strip - leading with the newest saved session when there is one, then a
  // handful of live-rendered example states. Supersedes the committed demo preview and
  // the multi-session cross-fade (both are the no-examples fallback below).
  const exampleLooks = (unavailable || paged) ? [] : galleryExampleLooks(tool, darkTheme);
  const hasExamples = exampleLooks.length > 0;
  const hasImageHero = hasThumbHero || hasPreview || hasExamples || paged; // the card leads with a real preview image

  // Visual: hero preview to resume the latest session; a compact resume tile when
  // the session has no captured preview; a committed demo preview (starts a NEW
  // session) when there's no session at all; else an "open to start" tile.
  let visual;
  if (unavailable) {
    visual = `<span class="gtile-tile gtile-tile--static"><span class="gtile-tile-txt">${t('Desktop&nbsp;app only')}</span></span>`;
  } else if (paged) {
    // Multi-page document: rendered as a stacked DECK. Page count is unknown until the
    // doc renders, so start with one skeleton slide; hydratePaged (mountGallery) renders
    // the pages and rebuilds the deck. Box is a fixed square (gallery.css); each card is
    // sized to its page's aspect (deckPageFit), so landscape and portrait pages both read
    // as correctly-shaped sheets rather than letterboxed squares.
    visual = `
      <div class="gcar" data-tool="${escape(tool.id)}" data-paged="1">
        ${iconBackdrop(tool.icon)}
        <ol class="gcar-track"><li class="gcar-slide gcar-slide--ex"><span class="gcar-img" aria-hidden="true"></span></li></ol>
        ${statusBadge}
      </div>`;
  } else if (hasExamples) {
    // Horizontally-scrollable preview strip. Slide 0 is the newest saved session (a
    // data-URL - instant, resumes on click) when one exists; the rest are example
    // states, each an EMPTY <img> hydrated lazily by mountGallery (renderFeaturedVariant,
    // cached under featured:<id>:<i>) as the tile nears the viewport. The box is a FIXED
    // SQUARE (gallery.css) so masonry packs it with no reflow ever, and every slide is
    // object-fit:contain (differently-shaped looks fit within, never cropped). Decorative:
    // the real navigation is the card's name link + info/history buttons, so slides are aria-hidden.
    // Lead slide: a saved-session thumb (resume) wins; else the committed authored card
    // (pose-geeko's animated Geeko) leads with the tool's real hero. Only one lead.
    const leadSlide = hasThumbHero
      ? `<li class="gcar-slide gcar-slide--lead">
           <button class="gcar-open" type="button" data-resume="${escape(latest!.toolId)}" data-slot="${escape(latest!.slot)}" aria-label="${escape(tRaw('Continue {name}', { name: latest!.filename || tool.name }))}">
             <img class="gcar-img" src="${escape(latest!.thumb!)}" alt="" aria-hidden="true" decoding="async">
             <span class="gtile-stamp">${escape(relativeTime(latest!.updatedAt))}</span>
             <span class="gtile-continue">${t('Continue')}</span>
           </button>
         </li>`
      : animCard
        ? `<li class="gcar-slide gcar-slide--lead gcar-slide--card">
             <a class="gcar-open" href="${openHref}" data-new-tool="${escape(tool.id)}" tabindex="-1" aria-hidden="true">
               ${previewMedia(animCard, 'gcar-img', undefined, eager, tool.anim)}
             </a>
           </li>`
        : '';
    const hasLead = hasThumbHero || !!animCard;
    // These <img>s have no src in the markup - hydrateCarousel fills them - so the hint has
    // to be on the element up front, ready for the src it is about to be given. Only the
    // strip's FIRST visible slide gets it: the rest sit off-view until the strip is scrolled,
    // and six high-priority requests per tile would just crowd out the tile next to it.
    const exSlides = exampleLooks.map(({ i }, k) =>
      `<li class="gcar-slide gcar-slide--ex" data-ex-index="${i}">
         <a class="gcar-open" href="${openHref}" data-new-tool="${escape(tool.id)}" tabindex="-1" aria-hidden="true">
           <img class="gcar-img" alt="" aria-hidden="true"${eager && k === 0 && !hasLead ? ' fetchpriority="high"' : ''} decoding="async">
         </a>
       </li>`).join('');
    const slideCount = (hasLead ? 1 : 0) + exampleLooks.length;
    const dots = slideCount >= 2
      ? `<div class="gcar-dots" aria-hidden="true">${Array.from({ length: slideCount }, (_, k) =>
          `<button class="gcar-dot${k === 0 ? ' is-active' : ''}" type="button" data-i="${k}" tabindex="-1" aria-hidden="true"></button>`).join('')}</div>`
      : '';
    const nav = slideCount >= 2
      ? `<button class="gcar-nav gcar-prev" type="button" tabindex="-1" aria-hidden="true" title="${escape(t('Previous example'))}">${CHEVRON_LEFT}</button>
         <button class="gcar-nav gcar-next" type="button" tabindex="-1" aria-hidden="true" title="${escape(t('Next example'))}">${CHEVRON_RIGHT}</button>`
      : '';
    visual = `
      <div class="gcar${hasThumbHero ? ' has-art' : ''}" data-tool="${escape(tool.id)}">
        ${iconBackdrop(tool.icon)}
        <ol class="gcar-track">${leadSlide}${exSlides}</ol>
        ${nav}
        ${dots}
        ${statusBadge}
      </div>`;
  } else if (hasThumbHero) {
    // One saved session → a single preview. Several → the recent previews cross-fade
    // (an ambient "you have a few saved works here"). The first frame is the newest
    // and sits in normal flow so it sets the tile's natural height; the rest are
    // absolutely stacked over it and only .is-active is opaque (the fade is CSS, the
    // ticker in mountGallery advances .is-active). The rotation is decorative - 
    // clicking always resumes the newest, the Continue target.
    const frames = sessionThumbs.length >= 2 ? sessionThumbs : [latest!.thumb!];
    const rotate = frames.length >= 2;
    // Not loading="lazy": the thumbs are data URLs already inlined in this markup
    // (nothing to defer over the network), and a lazy + opacity:0 frame is never
    // considered "intersecting", so it would never decode and the fade would stall.
    const heroImgs = frames.map((thumb, i) =>
      `<img class="gtile-hero-img gtile-hero-frame${i === 0 ? ' is-active' : ' gtile-hero-frame--over'}" src="${escape(thumb)}" alt="" aria-hidden="true" decoding="async">`
    ).join('');
    visual = `
      <button class="gtile-hero${rotate ? ' gtile-hero--rotate' : ''}" data-resume="${escape(latest!.toolId)}" data-slot="${escape(latest!.slot)}"
              aria-label="${escape(tRaw('Continue {name}', { name: latest!.filename || tool.name }))}">
        ${heroImgs}
        <span class="gtile-stamp">${escape(relativeTime(latest!.updatedAt))}</span>
        <span class="gtile-continue">${t('Continue')}</span>
        ${statusBadge}
      </button>`;
  } else if (hasSession) {
    // Session exists but its preview failed to capture - still resumable from the card.
    visual = `<button class="gtile-tile gtile-tile--resume" data-resume="${escape(latest!.toolId)}" data-slot="${escape(latest!.slot)}"
              aria-label="${escape(tRaw('Continue {name}', { name: latest!.filename || tool.name }))}"><span class="gtile-tile-txt">${t('Continue · {time}', { time: relativeTime(latest!.updatedAt) })}</span></button>`;
  } else if (hasPreview) {
    // No saved session, but a committed demo preview exists (npm run thumbs) - show
    // it as a hero that starts a NEW session. Decorative duplicate of the name link
    // (tabindex/aria-hidden so AT hears one link), matching the empty-tile pattern.
    // When the user has opted in to their profile, a personalized re-render replaces
    // the committed placeholder (in cache at mount, or lazily swapped in when ready).
    visual = `
      <a class="gtile-hero gtile-hero--preview" href="${openHref}" data-new-tool="${escape(tool.id)}" tabindex="-1" aria-hidden="true">
        ${iconBackdrop(tool.icon)}
        ${personalizedThumb
          // A personalized re-render is always a raster data URL - a plain <img>.
          ? `<img class="gtile-hero-img" src="${escape(personalizedThumb)}" alt="" aria-hidden="true" loading="lazy" decoding="async">`
          // Fixed-square hero (gallery.css): the img/iframe fills it and contains within,
          // so no per-tool aspect is threaded through - every preview box is the same size.
          : previewMedia(tool.preview!, 'gtile-hero-img', undefined, eager, tool.anim)}
        <span class="gtile-continue">${t('Open')}</span>
        ${statusBadge}
      </a>`;
  } else {
    // No session, no preview, no examples - still lead with the tool's icon (never
    // a network fetch, so never broken) so the tile is a real, on-brand card rather
    // than a bare line of text. Decorative duplicate of the name link (tabindex/
    // aria-hidden so AT hears one link).
    visual = `<a class="gtile-tile gtile-tile--iconled" href="${openHref}" data-new-tool="${escape(tool.id)}" tabindex="-1" aria-hidden="true">${tool.icon ? `<span class="gtile-tile-icon" aria-hidden="true">${tool.icon}</span>` : ''}<span class="gtile-tile-txt">${t('Open to start')}</span></a>`;
  }

  // Caption sub-line: only the last-opened time, and only on resumable cards.
  // The category is deliberately omitted here - it's discoverable via the filter
  // pills and shown in the info dialog - so the card stays about this tool itself.
  const sub = hasSession
    ? t('Last opened · {time}', { time: relativeTime(latest!.updatedAt) })
    : '';

  // Export formats no longer clutter the card - they live in the About dialog now,
  // grouped by vector / raster with the default highlighted (see showInfoDialog).

  // The title is the "start a new session" link. A stretched ::after (see CSS)
  // makes the whole text body - caption + description - its click target, so a
  // fresh session is as easy to hit as the hero's Continue. On a tool that
  // already has a saved session the link carries an explicit aria-label so it
  // reads as "new" against the hero's "Continue".
  const name = unavailable
    ? `<span class="gtile-name" aria-disabled="true">${escape(tool.name)}</span>`
    : `<a class="gtile-name" href="${openHref}" data-new-tool="${escape(tool.id)}"${hasSession ? ` aria-label="${escape(tRaw('Start a new {name} session', { name: tool.name }))}"` : ''}>${escape(tool.name)}</a>`;

  return `
    <article class="gtile${unavailable ? ' gtile--unavailable' : ''}${hasImageHero ? ' gtile--has-preview' : ''}" data-tool-id="${escape(tool.id)}" data-select-ref="${escape(tool.id)}">
      ${selectDot(tool.id, tool.name)}
      ${visual}
      <div class="gtile-body${unavailable ? '' : ' gtile-body--link'}">
        <div class="gtile-cap">
          ${iconSvg}
          <span class="gtile-meta">
            ${name}
            ${sub ? `<span class="gtile-sub">${sub}</span>` : ''}
            <p class="gtile-desc">${escape(tool.description ?? '')}</p>
            ${tool.templates?.length && !unavailable
              // Curated starting points (plans/142): say they exist right on the card.
              // Opening the tool fresh presents the chooser, so the count IS the path.
              ? `<span class="gtile-tpl">${tool.templates.length === 1 ? t('1 template') : tRaw('{n} templates', { n: tool.templates.length })}</span>`
              : ''}
          </span>
          ${unavailable ? ''
            // Persistent "+ New" action on every card: opens the tool's template
            // chooser via the empty-`?template=` boot flag (views/tool.ts reads it as
            // an explicit chooser ask); a tool with no templates just opens blank.
            // openQuery (url-source injected tools) rides along so their seed survives.
            : `<a class="gtile-new" href="#/tool/${escape(tool.id)}?template=${tool.openQuery ? `&amp;${escape(tool.openQuery)}` : ''}" data-new-tool="${escape(tool.id)}" aria-label="${escape(tRaw('Start a new {name} session', { name: tool.name }))}">${t('+ New')}</a>`}
          ${hasImageHero
            // Badge moved onto the preview image (see the hero markup), but that
            // hero is aria-hidden / aria-labelled, so keep the status announced.
            ? (statusBadge ? `<span class="visually-hidden">${escape(t(statusLabel(tool.status) || ''))}</span>` : '')
            : statusBadge}
        </div>
      </div>
    </article>
  `;
}

// ── Info modal ──────────────────────────────────────────────────────────────

function showInfoDialog(tool: GalleryTool | undefined, host: GalleryHost, darkTheme: boolean): void {
  if (!tool) return;
  const caps = Array.isArray(tool.capabilities) ? tool.capabilities : [];
  // Formats + privacy come straight from the catalog index entry - no fetch.
  // Transform-vs-export is decided by the `exportable` flag alone (NOT by whether
  // formats happen to be present), so a tool that declares formats always lists
  // them; only genuinely non-exporting utilities show the transform note.
  // Export formats moved off the tile into this dialog: chips grouped into vector /
  // raster / video / data sections (each keeping the tool's declared order within the
  // group), with the DEFAULT (first-declared) format filled with the accent so a browser
  // sees at a glance what they'll get and the full range on offer.
  const rawFormats = tool.exportable === false || !Array.isArray(tool.formats) ? [] : tool.formats;
  const defaultFmt = rawFormats[0];
  const fmtChip = (f: string): string =>
    `<li class="meta-fmt${f === defaultFmt ? ' meta-fmt--default' : ''}"${f === defaultFmt ? ` title="${escape(t('Default format'))}"` : ''}>${escape(fmtLabel(f))}${f === defaultFmt ? `<span class="visually-hidden"> ${t('(default)')}</span>` : ''}</li>`;
  const fmtGroupsHtml = FMT_KIND_ORDER
    .map(kind => ({ kind, list: rawFormats.filter(f => fmtKind(f) === kind) }))
    .filter(g => g.list.length)
    .map(g => `<div class="meta-fmt-grp"><span class="meta-fmt-kind">${t(FMT_KIND_LABEL[g.kind])}</span><ul class="meta-fmts">${g.list.map(fmtChip).join('')}</ul></div>`)
    .join('');
  const hasFmtChips = tool.exportable !== false && rawFormats.length > 0;
  const exportsDd = tool.exportable === false
    ? t('On-device transform (no file export)')
    : hasFmtChips ? `<div class="meta-fmt-groups">${fmtGroupsHtml}</div>` : '-';
  // Intended canvas size - paired with the format list so the modal answers both
  // "what file" and "how big". Omitted for transforms (size isn't meaningful) and for
  // any tool that declares no render size.
  const dims = tool.exportable === false ? '' : dimText(tool);

  // The same preview the tile shows (previewMedia handles img vs the sandboxed
  // card.html iframe), sized by the tool's declared aspect when it has one.
  const previewAspect = typeof tool.width === 'number' && typeof tool.height === 'number'
    ? ` style="aspect-ratio:${tool.width}/${tool.height}"` : '';

  // Templates and presets share ONE tile shape (.meta-look: media slot + name +
  // optional description) so the two starting-point kinds read as the same idea,
  // and both echo the in-tool Start chooser's tile.
  // "New from template" starting points - metadata carried on the index entry, so
  // this list costs no fetch. Each tile deep-links to the tool's `?template=<tid>`
  // launcher, the same path the in-tool chooser resolves. A template with no
  // authored thumb leads with a category glyph (same mapping as the chooser's
  // glyphFor - kept local so the chooser chunk stays off the gallery boot path).
  const tplGlyph = (tp: { name: string; category?: string }): string => {
    const hay = `${tp.category ?? ''} ${tp.name}`.toLowerCase();
    const key = /carousel|slides?|deck|grid|gallery/.test(hay) ? 'grid'
      : /poster|flyer|cover|image|photo|banner/.test(hay) ? 'image'
      : /story|social|post/.test(hay) ? 'photos'
      : /card|badge|label/.test(hay) ? 'shapes' : 'layers';
    return icon(key as Parameters<typeof icon>[0], { size: 26 });
  };
  const templates = tool.templates ?? [];
  const tplHtml = templates.length ? `
      <section class="meta-sec" aria-label="${escape(t('Templates'))}">
        <h3 class="meta-sec-title">${t('Templates')}</h3>
        <ul class="meta-look-list">
          ${templates.map(tp => `<li><a class="meta-look" data-tpl="${escape(tp.id)}" href="#/tool/${escape(tool.id)}?template=${escape(encodeURIComponent(tp.id))}">
            <span class="meta-look-thumb">${tp.thumb
              ? `<img class="meta-look-img" src="${escape(tp.thumb)}" alt="" loading="lazy" decoding="async">`
              // Glyph placeholder + an empty img the live render fills in
              // (hydrateInfoTemplates - same [src]-reveal CSS the examples use).
              : `<span class="meta-look-glyph" aria-hidden="true">${tplGlyph(tp)}</span><img class="meta-look-img" alt="" decoding="async">`}</span>
            <span class="meta-look-name">${escape(tp.name)}</span>
            ${tp.description ? `<span class="meta-look-desc">${escape(tp.description)}</span>` : ''}
          </a>
          </li>`).join('')}
        </ul>
      </section>` : '';

  // Preset looks (manifest examples) - the same looks the card's preview strip
  // shows, uncapped here. Thumbs live-render lazily through the shared
  // featured:<id>:<i> cache (hydrateInfoPresets), so anything the grid already
  // rendered resolves instantly; a click opens the tool seeded with that look.
  const looks = galleryExampleLooks(tool, darkTheme, Infinity);
  // "Examples", not "Presets" (plans/142): a preset now means a template's curated
  // variant; these are the manifest example looks the card strip shows.
  const exHtml = looks.length ? `
      <section class="meta-sec" aria-label="${escape(t('Examples'))}">
        <h3 class="meta-sec-title">${t('Examples')}</h3>
        <ul class="meta-look-list">
          ${looks.map(({ v, i }, k) => `<li><a class="meta-look" href="#/tool/${escape(tool.id)}" data-ex="${i}">
            <span class="meta-look-thumb"><img class="meta-look-img" alt="" decoding="async"></span>
            <span class="meta-look-name">${escape(v.label || tRaw('Example {n}', { n: k + 1 }))}</span>
          </a></li>`).join('')}
        </ul>
      </section>` : '';

  // Templates or presets fill a second column on desktop; without them the dialog
  // keeps its single-column spec-sheet shape (the CSS keys off the wide class).
  const wide = !!(tplHtml || exHtml);
  const content = `
    <div class="meta-dialog-body">
      <header class="meta-dialog-head">
        ${tool.icon ? `<span class="tool-card-icon meta-dialog-icon" aria-hidden="true">${tool.icon}</span>` : ''}
        <div>
          <h2 id="tool-info-title">${escape(tool.name)}</h2>
          <p class="meta-dialog-sub">${escape(t(catLabel(tool.category)))} · ${escape(t(statusLabel(tool.status) || ''))}</p>
        </div>
      </header>
      <div class="meta-dialog-cols">
        <div class="meta-dialog-main">
          ${tool.preview ? `<div class="meta-dialog-preview"${previewAspect}>${previewMedia(tool.preview, 'meta-dialog-preview-img')}</div>` : ''}
          <p class="meta-dialog-desc">${escape(tool.description ?? '')}</p>
          <dl class="meta-dialog-facts">
            <div${hasFmtChips ? ' class="meta-fmts-row"' : ''}><dt>${t('Exports')}</dt><dd>${exportsDd}</dd></div>
            ${dims ? `<div><dt>${t('Size')}</dt><dd>${escape(dims)}</dd></div>` : ''}
            ${caps.length ? `<div><dt>${t('Uses')}</dt><dd>${caps.map(c => escape(capabilityLabel(c))).join(', ')}</dd></div>` : ''}
            ${tool.privacy === 'on-device' ? `<div><dt>${t('Privacy')}</dt><dd>${t('Runs entirely on your device')}</dd></div>` : ''}
            ${tool.version ? `<div><dt>${t('Version')}</dt><dd>${escape(tool.version)}</dd></div>` : ''}
            ${tool.added ? `<div><dt>${t('Added')}</dt><dd>${escape(addedDateText(tool.added))}</dd></div>` : ''}
          </dl>
        </div>
        <div class="meta-dialog-side">
          ${tplHtml}
          ${exHtml}
          <section class="meta-defaults" aria-label="${escape(t('Default settings'))}" hidden>
            <h3 class="meta-sec-title">${t('Defaults')}</h3>
            <dl class="meta-defaults-list"></dl>
          </section>
        </div>
      </div>
      <div class="meta-dialog-actions">
        <a class="btn meta-dialog-open" href="#/tool/${escape(tool.id)}">${tool.category === 'utility' ? t('Open utility') : t('Open tool')}</a>
        <button type="button" class="btn meta-dialog-close">${t('Close')}</button>
      </div>
    </div>`;
  playSfx('whisper'); // airy elevation as the tool details rise in
  const modal = mountModal(content, { className: `tool-meta-dialog${wide ? ' tool-meta-dialog--wide' : ''}` });
  modal.el.setAttribute('aria-labelledby', 'tool-info-title');
  modal.el.querySelectorAll('.meta-dialog-close').forEach(b => b.addEventListener('click', () => modal.close()));
  modal.el.querySelector('.meta-dialog-open')?.addEventListener('click', () => modal.close());
  // A template link navigates via its href; just take the dialog down with it.
  modal.el.querySelectorAll('.meta-look:not([data-ex])').forEach(a => a.addEventListener('click', () => modal.close()));
  // A preset opens the tool seeded with that exact look (same path as clicking the
  // card's example slide). Modified / middle clicks keep the plain href fallback.
  modal.el.querySelectorAll<HTMLElement>('.meta-look[data-ex]').forEach(a => {
    a.addEventListener('click', (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      const hit = looks.find(l => l.i === Number(a.dataset.ex));
      void toolSeedHref(tool.id, hit?.v.values).then(href => { modal.close(); window.location.hash = href; });
    });
  });
  void fillDefaultsList(modal.el, tool.id);
  void hydrateInfoPresets(modal.el, host, tool, looks);
  void hydrateInfoTemplates(modal.el, host, tool);
}

/** Live-render the template tiles (plans/142 WP-2), serially, through the SAME
 *  template:<toolId>:<tid> cache the in-tool Start chooser uses - a template the
 *  chooser already rendered resolves instantly, and vice versa. Values are fetched
 *  per template (the index is metadata-only); a failure leaves the glyph. */
async function hydrateInfoTemplates(dialog: HTMLElement, host: GalleryHost, tool: GalleryTool): Promise<void> {
  const metas = (tool.templates ?? []).filter(tp => !tp.thumb);
  if (!metas.length) return;
  const esc = (s: string): string => (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(s) : s);
  const { fetchTemplateValues } = await import('./template-chooser.ts');
  for (const tp of metas) {
    if (!dialog.isConnected) return;
    const img = dialog.querySelector<HTMLImageElement>(`.meta-look[data-tpl="${esc(tp.id)}"] .meta-look-img`);
    if (!img || img.getAttribute('src')) continue;
    try {
      const values = await fetchTemplateValues(tool.id, tp.id);
      if (!values || !dialog.isConnected) continue;
      const thumb = await renderFeaturedVariant(host, tool.id, tool.formats, tp.id, values as Record<string, unknown>, 'template');
      if (!dialog.isConnected || !thumb) continue;
      img.src = thumb;   // the [src] CSS reveals it; the glyph sits behind
    } catch { /* leave the glyph */ }
  }
}

/** Live-render the preset thumbs, serially, through the same featured:<id>:<i>
 *  cache the card strips and the hero row use - a look the grid already rendered
 *  resolves from cache instantly. Stops when the dialog closes; a failed render
 *  just leaves that tile's flat placeholder. */
async function hydrateInfoPresets(dialog: HTMLElement, host: GalleryHost, tool: GalleryTool, looks: Array<{ v: FeaturedVariant; i: number }>): Promise<void> {
  for (const { v, i } of looks) {
    if (!dialog.isConnected) return;
    const img = dialog.querySelector<HTMLImageElement>(`.meta-look[data-ex="${i}"] .meta-look-img`);
    if (!img || img.getAttribute('src')) continue;
    try {
      const thumb = await renderFeaturedVariant(host, tool.id, tool.formats, i, v.values as Record<string, unknown>);
      if (!dialog.isConnected || !thumb) continue;
      img.src = thumb;   // the [src] CSS reveals it once set
    } catch { /* leave the placeholder */ }
  }
}

// ── Info dialog: the defaults spec list ──────────────────────────────────────
// The gallery index deliberately carries no input model, so the dialog fetches
// the manifest on open and renders each input's out-of-the-box value - a small
// spec sheet, not a settings UI. Failure (offline, tool gated) just leaves the
// section hidden; the dialog stands on the index data alone.

/** One input's default, formatted for the spec list. null = skip the row. */
function defaultText(input: Record<string, unknown>): { text: string; swatch?: string } | null {
  const d = input.default;
  const type = String(input.type ?? 'text');
  if (type === 'file') return null;                       // user-supplied by nature - no default exists
  if (d === undefined || d === null || d === '') return { text: '-' };
  switch (type) {
    case 'boolean': return { text: d ? t('On') : t('Off') };
    case 'color': {
      const v = String(d);
      return { text: v, swatch: /^(#[0-9a-fA-F]{3,8}|transparent)$/.test(v) ? v : undefined };
    }
    case 'select': {
      const opts = Array.isArray(input.options) ? input.options as Array<{ value?: unknown; label?: unknown }> : [];
      const hit = opts.find(o => (o && typeof o === 'object' ? o.value : o) === d);
      return { text: String((hit && typeof hit === 'object' && hit.label) || d) };
    }
    case 'blocks': return { text: Array.isArray(d) ? (d.length === 1 ? t('1 item') : t('{n} items', { n: d.length })) : '-' };
    case 'vector': return { text: Array.isArray(d) ? d.join(' × ') : String(d) };
    case 'number': return { text: String(d) + (input.unit ? ` ${input.unit}` : '') };
    default: {
      const s = String(d);
      return { text: s.length > 42 ? `${s.slice(0, 41)}…` : s };
    }
  }
}

async function fillDefaultsList(dialog: HTMLElement, toolId: string): Promise<void> {
  let inputs: Array<Record<string, unknown>>;
  try {
    const resp = await instanceFetch(instancePath(`/tools/${encodeURIComponent(toolId)}/tool.json`));
    if (!resp.ok) return;
    const manifest = await resp.json() as { inputs?: Array<Record<string, unknown>> };
    inputs = Array.isArray(manifest.inputs) ? manifest.inputs : [];
  } catch { return; }
  const section = dialog.querySelector<HTMLElement>('.meta-defaults');
  const list = dialog.querySelector<HTMLElement>('.meta-defaults-list');
  if (!section || !list || !dialog.isConnected || !inputs.length) return;

  const MAX_ROWS = 14; // a spec sheet, not a scroll chore - the tool itself shows the rest
  const rows: string[] = [];
  for (const input of inputs) {
    if (rows.length >= MAX_ROWS) break;
    const v = defaultText(input);
    if (!v) continue;
    const label = String(input.label ?? input.id ?? '');
    const fromProfile = typeof input.bindToProfile === 'string'
      ? `<span class="meta-default-note">${t('from profile')}</span>` : '';
    rows.push(`<div class="meta-default-row">
      <dt>${escape(label)}</dt>
      <dd>${v.swatch ? `<span class="meta-default-swatch${v.swatch === 'transparent' ? ' color-swatch--transparent' : ''}"${v.swatch !== 'transparent' ? ` style="background:${escape(v.swatch)}"` : ''} aria-hidden="true"></span>` : ''}<span class="meta-default-value">${escape(v.text)}</span>${fromProfile}</dd>
    </div>`);
  }
  const skipped = inputs.filter(i => String(i.type) !== 'file').length - rows.length;
  if (!rows.length) return;
  list.innerHTML = rows.join('') +
    (skipped > 0 ? `<div class="meta-default-row meta-default-more"><dt></dt><dd>${t('+ {n} more in the tool', { n: skipped })}</dd></div>` : '');
  section.hidden = false;
}

// ── History modal ───────────────────────────────────────────────────────────

interface ShowHistoryDialogOpts {
  onDelete?(slot: string): void;
  onClose?(): void;
}

function showHistoryDialog(tool: GalleryTool | undefined, entries: SavedEntry[], sizes: Record<string, number>, host: GalleryHost, { onDelete, onClose }: ShowHistoryDialogOpts = {}): void {
  if (!tool) return;
  const countText = (n: number) => (n === 1 ? t('1 saved session') : t('{n} saved sessions', { n }));
  // Defer the gallery re-render until the dialog closes: rebuilding the masonry
  // (and the (h) trigger button) mid-dialog would break the UA's focus restore.
  let changed = false;
  const content = `
    <div class="meta-dialog-body">
      <header class="meta-dialog-head">
        ${tool.icon ? `<span class="tool-card-icon meta-dialog-icon" aria-hidden="true">${tool.icon}</span>` : ''}
        <div>
          <h2 id="tool-history-title">${escape(tool.name)}</h2>
          <p class="meta-dialog-sub history-count">${countText(entries.length)}</p>
        </div>
      </header>
      <ul class="saved-list history-list">
        ${entries.map(e => savedItem(e, sizes[e.slot])).join('')}
      </ul>
      <div class="meta-dialog-actions">
        <button type="button" class="btn meta-dialog-close">${t('Close')}</button>
      </div>
    </div>`;
  const modal = mountModal(content, {
    className: 'tool-meta-dialog tool-history-dialog',
    onClose: () => { if (changed) onClose?.(); },
  });
  modal.el.setAttribute('aria-labelledby', 'tool-history-title');
  modal.el.querySelectorAll('.meta-dialog-close').forEach(b => b.addEventListener('click', () => modal.close()));

  modal.el.querySelectorAll<HTMLElement>('[data-resume]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      modal.close();
      window.location.hash = `#/tool/${el.dataset.resume}?slot=${encodeURIComponent(el.dataset.slot!)}`;
    });
  });
  modal.el.querySelectorAll<HTMLElement>('[data-delete]').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      const slot = el.dataset.delete!;
      // confirm-dialog is lazy-loaded here (off the boot path) - this is a click handler,
      // so paying its ~1 KB on the delete gesture is free.
      const { confirmDialog } = await import('../components/confirm-dialog.ts');
      const ok = await confirmDialog({
        title: t('Delete session?'),
        message: t('Delete this saved session? This can’t be undone.'),
        confirmLabel: t('Delete'),
      });
      if (!ok) return;
      await host.state.delete(slot);
      el.closest('.saved-row')?.remove();
      onDelete?.(slot);            // update in-memory state only - render happens on close
      changed = true;
      announce(t('Session deleted'));
      const left = modal.el.querySelectorAll('.saved-row').length;
      const countEl = modal.el.querySelector('.history-count');
      if (countEl) countEl.textContent = countText(left);
      if (left === 0) modal.close();
    });
  });
}

// ── Saved-session row (shared by the history modal) ─────────────────────────
// Builds on folder-tiles.ts's sessionRow() - the shared row primitive behind
// this history list AND the profile Storage manager's session list
// (component-audit rec 6). Only this view's chrome (a full-row resume trigger,
// the h4/small tags its own stylesheets key off) lives here; the batch/thumb/
// size resolution is shared. (A data-search row attribute used to be built here
// too - nothing ever read it; dropped per plans/99 M3's sweep.)

function savedItem(entry: SavedEntry, bytes: number | undefined): string {
  const batch = isBatchSlot(entry.slot);
  const when = entry.updatedAt ? fmtDateTime(new Date(entry.updatedAt)) : '';
  const title = batch ? (entry.label || t('Batch session')) : (entry.filename || entry.toolId);
  // The tool name is the row's title (h4) just above, so the sub-line only needs
  // the timestamp - no need to repeat the name.
  // sessionRow() escapes `subtitle` itself - tRaw keeps that the single escaping step.
  const subtitle = batch ? tRaw('Batch · {when}', { when }) : when;
  // Tool sessions resume into #/tool; batch sessions resume into #/pro.
  const resumeAttrs = batch
    ? `data-batch data-slot="${escape(entry.slot)}"`
    : `data-resume="${escape(entry.toolId)}" data-slot="${escape(entry.slot)}"`;
  return sessionRow(entry, {
    rowClass: `saved-row${batch ? ' saved-row--batch' : ''}`,
    thumbClass: 'saved-thumb',
    thumbImgAttrs: 'aria-hidden="true"',
    batchIcon: PACKAGE_ICON,
    openClass: 'saved-resume',
    openAttrs: resumeAttrs,
    openLabel: `${batch ? t('Open batch') : t('Resume')} ${entry.label ?? entry.slot}`,
    metaClass: 'saved-label',
    titleTag: 'h4',
    title,
    subTag: 'small',
    subtitle,
    sizeBytes: bytes,
    deleteAttr: `data-delete="${escape(entry.slot)}"`,
    deleteClass: 'saved-delete',
    deleteTitle: t('Delete'),
    deleteLabel: t('Delete'),
  });
}

// ── Misc helpers ────────────────────────────────────────────────────────────

/** Tools already prefetched this page-load. The hover hook used to be `{ once: true }`,
 *  which guarded this incidentally; it now fires on every enter (it drives motion playback
 *  too), so the guard has to be here - and it is the better place regardless, since one
 *  tool can appear in both the featured row and the grid. */
const prefetched = new Set<string>();

function prefetchTool(toolId: string | undefined): void {
  if (!toolId || prefetched.has(toolId)) return;
  prefetched.add(toolId);
  const base = `/tools/${toolId}`;
  for (const file of ['tool.json', 'template.html', 'hooks.js']) {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'fetch';
    link.href = `${base}/${file}`;
    document.head.appendChild(link);
  }
}

function relativeTime(iso: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const s = Math.max(0, (Date.now() - then) / 1000);
  if (s < 60) return t('just now');
  const m = s / 60; if (m < 60) return t('{n}m ago', { n: Math.round(m) });
  const h = m / 60; if (h < 24) return t('{n}h ago', { n: Math.round(h) });
  const d = h / 24; if (d < 7) return t('{n}d ago', { n: Math.round(d) });
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function fmtDateTime(d: Date): string {
  const date = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}
