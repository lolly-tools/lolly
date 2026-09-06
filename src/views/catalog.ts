// SPDX-License-Identifier: MPL-2.0
/**
 * Catalog view (route /#/c or /#/catalog) - the third top-level destination alongside
 * Tools and Projects.
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

import { escape, safeHref } from '../utils.ts';
import { sendTargetId, sendTargetsFor } from '../lib/send-target.ts';
import { isHiddenSlot } from '../lib/batch-slots.ts';
import {
  matchesType as matchesTypeRule,
  visibleAssets as visibleAssetsRule,
  buildSearchHaystack,
  matchesQuery as matchesQueryRule,
  matchContext as matchContextRule,
  favItems as favItemsRule,
  selectableIds as selectableIdsRule,
  pruneSelection as pruneSelectionRule,
  sortAssets,
  assetAddedAt,
  assetModifiedAt,
  TYPE_FILTER_TYPES,
  type TypeFilter,
  type CatSort,
} from './catalog-filter.ts';
import { audioTransportHtml, wireAudioTransport } from '../lib/audio-transport.ts';
import type { VizHandle } from '../lib/butterchurn-viz.ts';
import { t, tRaw } from '../i18n.ts';
import { showUndoToast, flushUndoToasts } from '../lib/undo-toast.ts';
import { createFolderStore, folderPath, type FolderHost } from '../folders.ts';
import { genAiPill, assetAiKind, aiSignalsChip, GENAI_CLAIM } from '../lib/genai-pill.ts';
import { announce } from '../a11y.ts';
import { fmtBytes } from '../lib/format.ts';
import { mountModal } from '../components/modal.ts';
import type { ModalHandle } from '../components/modal.ts';
import { mountFeaturedRow } from '../components/featured-row.ts';
import type { FeaturedEntry, FeaturedRowHandle, FeaturedViewMode } from '../components/featured-row.ts';
import { viewTopbarHtml, mountViewTopbar } from '../components/view-topbar.ts';
import { claimSearchBar, clearSearchBar, setSearchBarQuery } from '../components/search-bar.ts';
import { themeSegmentHtml, wireThemeSegment } from '../components/theme-toggle.ts';
import { soundSegmentHtml, wireSoundSegment } from '../components/sound-toggle.ts';
import { segHtml } from '../lib/seg.ts';
import { VISUAL_TYPES } from '../lib/asset-kinds.ts';
import { wireDisclosure } from '../components/body-popover.ts';
import { mountZoomHud } from '../components/zoom-hud.ts';
import { playSfx, playCatalogAah, cancelArrivalAah } from '../lib/sfx.ts';
import { autoplayLottieThumbs, mountLottieMarker, destroyLottiePlayers, lottiePlayerFor } from './lottie-mount.ts';
import { motionVideoThumb, armMotionPreviews } from '../lib/preview-media.ts';
import { extractAssetMetadata } from '../lib/asset-metadata.ts';
import { analyzeVerifyText, buildHighlightSegments, heatBucket } from './valid-text.ts';
import type { TextSignalPanel, TextSignalMark } from './valid-text.ts';
import { confirmDialog, choiceDialog, promptDialog, closeConfirmDialogs } from '../components/confirm-dialog.ts';
import { armViewEnter } from '../view-enter.ts';
import {
  libCategory, LIB_GROUPS, categoryLabel, loadAssetCategories, saveAssetCategory,
} from '../lib/asset-category.ts';
import {
  assetBaseId,
  loadFavouriteAssets, saveFavouriteAssets,
  loadHiddenAssets, saveHiddenAssets,
} from '../lib/asset-favourites.ts';
import { mountUploadDropzone } from '../lib/upload-dropzone.ts';
// Type only - the trim module itself is a lazy chunk, loaded when the action is used.
import type { TrimProposal } from '../lib/design-system/trim-offer.ts';
import { icon } from '../lib/icons.ts';
import { wireTileSelect } from '../lib/tile-select.ts';
import { wireTileContextMenu, menuItemHtml } from '../lib/context-menu.ts';
import { bulkBarHtml as buildBulkBar, syncBulkBar as syncSharedBulkBar, wireEscapeClearsSelection } from '../lib/bulk-bar.ts';
import { startJob } from '../lib/jobs.ts';
import type { BulkBarConfig } from '../lib/bulk-bar.ts';
import type { PickerHost } from './picker.ts';
import type { UpscaleHost } from './upscale-dialog.ts';
import type { MatteHost } from './matte-dialog.ts';
import type { ExtractAudioHost } from '../lib/extract-audio.ts';
import type { VideoJobHost } from '../lib/video-jobs.ts';
import { mountAudioThumbs, replaceUserUpload, storeUserUpload, UPLOAD_ACCEPT } from './picker.ts';
import { mountTextThumbs } from '../lib/text-thumbs.ts';
import { mountPdfThumbs } from '../lib/pdf-thumbs.ts';
import DOMPurify from 'dompurify';
import { looksLikeMarkdown, mdToHtml } from '../lib/markdown.ts';
import { audioThumbPlaceholder } from '../lib/audio-thumb.ts';
import { peaksFingerprint, derivePeaks, memoPeaks } from '../lib/audio-peaks.ts';
import { createVizCycle } from '../lib/viz-cycle.ts';
import { audioThumbSvg, type AudioThumbShape } from '../lib/audio-thumb.ts';
import { audioThumbPool, audioThumbInk, type ThumbTheme } from '../lib/audio-thumb-colour.ts';
import {
  loadAudioCovers, saveAudioCover, resolveAudioLook, vizPresetOf, isVizCover, type AudioCover,
} from '../lib/audio-covers.ts';
import { songUrlToWavBlobUrl } from '../lib/zzfxm-render.ts';
import { modUrlToWavBlobUrl, isModuleFormat, modDecoderAvailable } from '../lib/mod-render.ts';
import { attachAudioMeter } from '../lib/audio-meter.ts';
import { exportSwatches, paletteEntriesToSwatches, type SwatchExportFormat } from '../lib/swatch-export.ts';
import { groupPalette, isTransparent, swatch } from '../lib/swatches.ts';
import '../styles/parts/platform.css'; // .plat-swatch* card/chip styles for the Swatches panel - catalog reuses swatch() but doesn't otherwise load platform.css, so a cold land-on-catalog (e.g. iOS) left the chips unstyled
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';
import { perfUiOn } from '../feature-flags.ts';
import { offsetToUv, halfWindow, type Loupe } from '../lib/loupe-gl.ts';
import { parseHex, hexToOklch, oklchToHex } from '../../../../engine/src/brand-derive.ts';
import { rampOklab } from '../../../../engine/src/color-tools.ts';
import { rgbToCmyk } from '../../../../engine/src/color.ts';
import { categoryGlyph } from '../lib/category-icons.ts';
import { staggerReveal } from '../lib/reveal.ts';
import { PALETTE } from '../palette.ts';
import type { PaletteEntry } from '../palette.ts';
import { livePalette } from '../lib/live-palette.ts';
import { FONTS, WEIGHT_RAMP, FONT_LICENSE } from '../lib/typefaces.ts';
import type { FontDownload } from '../lib/typefaces.ts';
import { listUserFonts, familyFromTokenValue } from '../user-fonts.ts';
import {
  restyleIconTheme, buildThemedAssetId, parseThemedAssetId, treatmentFilterSvg,
  buildTreatedAssetId, parseTreatedAssetId, wrapRasterWithTreatment,
  GENERATED_SOURCE_TYPE,
  extractC2paStore, verifyC2pa, humanizeText, LEXICON_VERSION,
  analyzeTextSignals, suggestRewrites, applySuggestion, rewordableSpans, rewordCandidates,
} from '@lolly/engine';
import type { HumanizeResult, RewordSuggestion, RewordSpan, RewordCandidate } from '@lolly/engine';
import type { RewordStatus } from '../lib/reworder.ts';
// The shared "Reworded with Lolly" note - constants + a queued check only; the
// reworder facade behind it stays a lazy import (see wm-note.ts's header).
import { wmNoteSlot } from '../lib/wm-note.ts';
import { appendVisibleText, visibleTextHtml } from '../lib/invisible-chars.ts';
import { tsigFactsHtml } from './tsig-facts.ts';
import { lampStripHtml, type TrustLamp } from './trust-lamps.ts';
// The on-device model tier's shared seam (plans/126 WP-A): consent line,
// estimate row and honesty copy for the classifier check.
import { aiModelSlot } from './tsig-model-note.ts';
import { prepareAssetForVerify, setPendingVerify } from '../lib/verify-handoff.ts';
import { lollyBadge } from '../lib/lolly-badge.ts';
import type { C2paActionInput } from '../../../../engine/src/c2pa.ts';
// The shared derived-asset provenance path (plans/148 WP-E) - lifted out of this
// view so the tool-side framing bake signs identically.
import {
  signDerived as sharedSignDerived, sourceIngredients as sharedSourceIngredients,
  STAMPABLE_FORMATS as STAMPABLE, type DerivedSignInputs,
} from '../lib/derived-asset.ts';
import type { AssetRef, HostV1, IngredientCredential, Profile } from '@lolly-tools/core/host-v1';
import type { PhotoTreatment } from '../../../../engine/src/photo-treatment.ts';
import type { IconTheme } from '../../../../engine/src/icon-theme.ts';

// The user's headshot is a user asset but is managed on /profile (and backs
// profile.headshot) - keep it out of the Catalog grid so it can't be orphaned here.
const HEADSHOT_ID = 'user/headshot';
// Only assets that thumbnail as an image belong in the grid; palette/tokens/font/
// profile entries are engine data (Swatches + Fonts panels cover those below).
// Shared with the folder overlays, which had no filter at all - see lib/asset-kinds.ts.

/** A font as the catalogue renders it - a bundled spec or an on-device user font. */
interface CatFont {
  family: string; role: string; stack: string; typeLine: string;
  downloads: FontDownload[]; onDevice: boolean;
}

// Coarse filetype filter for the sticky toolbar - buckets over the asset types, NOT one
// option per export format (which would be a huge, noisy list): Image = raster
// photos/logos, Vector = SVG/EPS artwork, Motion = video + Lottie animations, Audio =
// the music/audio tiles admitted into the catalogue view (see the allAssets filter below).
// TypeFilter + its bucket table live in catalog-filter.ts with the predicates
// that read them, so the type and the rule cannot drift apart.
// Toolbar glyphs (Lucide house style). Each button shows icon + label on desktop and
// collapses to the icon alone on mobile (see .cat-btn-label in catalog.css).
const catIco = (inner: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const CAT_ICONS = {
  all:      catIco('<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>'),
  image:    catIco('<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>'),
  vector:   catIco('<path d="M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z"/><path d="m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.879a1 1 0 0 0 .776.746L13 18"/><path d="m2.3 2.3 7.286 7.286"/><circle cx="11" cy="11" r="2"/>'),
  motion:   catIco('<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>'),
  audio:    catIco('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
  model:    catIco('<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>'),
  lut:      catIco('<circle cx="9" cy="9" r="7"/><circle cx="15" cy="15" r="7"/>'),
  text:     catIco('<path d="M17 6.1H3"/><path d="M21 12.1H3"/><path d="M15.1 18H3"/>'),
  collapse: catIco('<path d="m7 20 5-5 5 5"/><path d="m7 4 5 5 5-5"/>'),
  expand:   catIco('<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>'),
  eye:      catIco('<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>'),
  eyeOff:   catIco('<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>'),
  upload:   catIco('<path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>'),
};
// Update a sticky-toolbar toggle (Collapse-all / Show-hidden) in place: swap its glyph
// + label span and keep the accessible name in sync. A plain `.textContent =` would drop
// the SVG icon entirely - and, since these buttons are icon-only on the toolbar (the
// label is hidden), leave a bare word behind - as well as re-width the centred pill.
function setCatToggle(btn: HTMLElement, icon: string, label: string): void {
  btn.innerHTML = `${icon}<span class="cat-btn-label">${label}</span>`;
  btn.title = label;
  btn.setAttribute('aria-label', label);
}
// Each type filter has a signature click sound: image = a camera shutter snick,
// vector = a pencil scribble, motion = a film reel spinning up to smooth, audio = a
// synth pulse lighting up like a waveform.
const TYPE_FILTERS: { key: TypeFilter; label: string; icon: string; sfx?: string }[] = [
  { key: 'all', label: 'All', icon: CAT_ICONS.all },
  { key: 'image', label: 'Image', icon: CAT_ICONS.image, sfx: 'aperture' },
  { key: 'vector', label: 'Vector', icon: CAT_ICONS.vector, sfx: 'scribble' },
  { key: 'motion', label: 'Motion', icon: CAT_ICONS.motion, sfx: 'reel' },
  { key: '3d', label: '3D', icon: CAT_ICONS.model },
  { key: 'lut', label: 'LUTs', icon: CAT_ICONS.lut },
  { key: 'audio', label: 'Audio', icon: CAT_ICONS.audio, sfx: 'waveform' },
  { key: 'text', label: 'Text', icon: CAT_ICONS.text },
];

/** Stand-in for the search index when there is no query to match against. */
const EMPTY_HAYSTACK: ReadonlyMap<string, string> = new Map();

/** One stored user-upload record - mirrors bridge/assets.ts's non-exported
 *  UserAssetRecord for the fields the trim rewrite reads and carries forward
 *  (the same local mirror views/picker.ts keeps for its upload write). */
interface UserAssetRecordLike {
  id: string;
  type: AssetRef['type'];
  format: string;
  blob?: Blob;
  version?: string;
  checksum?: string;
  width?: number;
  height?: number;
  meta?: Record<string, unknown>;
  credential?: Uint8Array;
  credentialFormat?: string;
  aiGenerated?: 'full' | 'partial';
}

/** The persisted per-asset AI-likelihood note (plans/125), kept on a USER upload's
 *  `meta.aiSignals` after an in-modal Analyse text / Read text run. `v` keys the
 *  verdict to the tell lexicon that produced it: a LEXICON_VERSION bump silently
 *  retires every stale note rather than letting an old verdict outlive its rules. */
interface AiSignalsNote {
  v: number;
  band: TextSignalPanel['band'];
  score: number;
  source: 'digital' | 'ocr';
  family?: string;
  confidence?: 'low' | 'high';
}

// The web shell's concrete host exposes more than the tool-facing HostV1 contract; we
// reach for the user-asset helpers + profile.set(). main.ts passes the concrete WebHost
// (assignable to HostV1), so the parameter stays HostV1 and this narrows locally.
interface CatalogHost extends HostV1 {
  assets: HostV1['assets'] & {
    _listUserAssets(): Promise<AssetRef[]>;
    _deleteUserAsset(id: string): Promise<void>;
    _duplicateUserAsset(id: string): Promise<string | null>;
    _renameUserAsset(id: string, name: string): Promise<void>;
    _restampUserAsset(id: string, patch: { blob: Blob; credential: Uint8Array; credentialFormat: string }): Promise<void>;
    // The retro-trim's read + write (see measureTrim / commitTrim). Records, not
    // AssetRefs: a rewrite has to carry forward everything the ref does not surface.
    _exportUserAssets(): Promise<readonly UserAssetRecordLike[]>;
    _uploadUserAsset(record: UserAssetRecordLike): Promise<void>;
    // The meta-only annotation write (AI-signals note, declare-AI-origins): no
    // quota metering, no pin-preserve - the stored bytes are untouched.
    _updateUserAssetMeta(id: string, meta: Record<string, unknown>, patch?: { aiGenerated?: 'full' | 'partial' | null }): Promise<void>;
    _iconThemes?(): Promise<IconTheme[]>;
    _photoTreatments?(): Promise<PhotoTreatment[]>;
  };
  profile: HostV1['profile'] & { set(profile: Profile): Promise<unknown> };
}

// Two-colour icons ('themable', c1/c2) and multi-colour illustrations ('illustration',
// monochromatic remap) both take a colour theme - the engine recolour handles each shape.
// Content-credentialed icons are included: a recolour breaks the embedded byte
// binding, but the download path re-signs the result with the original credential
// preserved as an ingredient (see downloadSigned), so the chain survives the edit.
const isThemable = (ref: AssetRef): boolean => {
  const tags = ref.meta?.tags as string[] | undefined;
  return Boolean(tags?.includes('themable') || tags?.includes('illustration'));
};

// Sentinel "theme" = the asset's own bytes, unchanged. Downloading the original
// keeps any embedded Content Credential intact byte-for-byte; a recolour changes
// the bytes, so its now-mismatched credential is stripped from them - and the
// download is re-signed with a Lolly manifest that records the recolour and
// carries the original credential as an ingredient.
const ORIGINAL_THEME = '__original';
const stripC2paManifest = (svg: string): string =>
  svg.replace(/<metadata>\s*<c2pa:manifest>[\s\S]*?<\/c2pa:manifest>\s*<\/metadata>/g, '')
    .replace(/<c2pa:manifest>[\s\S]*?<\/c2pa:manifest>/g, '');
const isVector = (ref: AssetRef): boolean => ref.type === 'vector';
// The date a CATALOG asset's file was first added to its brand pack, as the index
// carries it (`added`, YYYY-MM-DD, stamped by npm run build:catalog). Read at noon
// UTC so a reader west of UTC is not shown the day before. Empty string when the
// asset has no date, which is every upload - those carry a millisecond stamp
// instead and go through assetAddedAt.
const catalogAddedText = (ref: AssetRef): string => {
  const iso = typeof ref.meta?.added === 'string' ? ref.meta.added : '';
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};
// A safe, readable download filename from an asset's name (or id), + extension.
function downloadName(ref: AssetRef, ext: string): string {
  const base = String(ref.meta?.name ?? ref.id.split('/').pop() ?? 'asset')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^\w.\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'asset';
  return `${base}.${ext}`;
}
const svgTextToDataUrl = (svg: string): string => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
// Read a Blob's bytes as a `data:` URI - a self-contained href for an SVG <image>
// (an SVG used as an image may not load external refs), so a photo can be baked into
// a treatment wrapper client-side.
const blobToDataUrl = (blob: Blob): Promise<string> => new Promise((res, rej) => {
  const fr = new FileReader();
  fr.onload = () => res(String(fr.result));
  fr.onerror = () => rej(fr.error ?? new Error('blob read failed'));
  fr.readAsDataURL(blob);
});
// Rasterise an SVG (given as its markup) to a Blob at exact pixel dimensions, in the
// given image type. Drawing from a same-origin data URL avoids canvas tainting, so
// toBlob always succeeds. JPEG gets an opaque white fill first (it has no alpha).
async function svgToRaster(svgText: string, w: number, h: number, mime = 'image/png', quality = 0.97): Promise<Blob> {
  const img = new Image();
  img.decoding = 'async';
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error('SVG decode failed'));
    img.src = svgTextToDataUrl(svgText);
  });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D context');
  if (mime === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, mime, quality));
  if (!blob) throw new Error('raster encode failed');
  return blob;
}
const svgToPng = (svgText: string, w: number, h: number): Promise<Blob> => svgToRaster(svgText, w, h, 'image/png');
// Read the intrinsic aspect ratio (w/h) from an SVG's viewBox, falling back to its
// width/height attributes (many exporters omit viewBox), default 1. Percentage sizes
// (e.g. width="100%") carry no ratio, so they're ignored.
function svgAspect(svgText: string): number {
  const vb = /viewBox\s*=\s*["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)/.exec(svgText);
  if (vb) { const w = parseFloat(vb[1]!), h = parseFloat(vb[2]!); if (w > 0 && h > 0) return w / h; }
  const dim = (name: string): number => {
    const m = new RegExp(`\\b${name}\\s*=\\s*"([^"]+)"|\\b${name}\\s*=\\s*'([^']+)'`, 'i').exec(svgText);
    const v = (m?.[1] ?? m?.[2] ?? '').trim();
    return !v || v.endsWith('%') ? NaN : parseFloat(v);   // parseFloat tolerates unit suffixes (px/pt)
  };
  const w = dim('width'), h = dim('height');
  if (w > 0 && h > 0) return w / h;
  return 1;
}

// The SVG's user-space extent [minX, minY, width, height] - from viewBox, else its
// width/height attrs, else a unit square. Used to map a crop fraction onto the real
// coordinate system so a vector crop stays vector (just a narrower viewBox).
function svgViewBox(svgText: string): [number, number, number, number] {
  const vb = /viewBox\s*=\s*["']\s*([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)/.exec(svgText);
  if (vb) {
    const p = [vb[1], vb[2], vb[3], vb[4]].map(Number);
    if (p.every(n => isFinite(n)) && p[2]! > 0 && p[3]! > 0) return p as [number, number, number, number];
  }
  const dim = (name: string): number => {
    const m = new RegExp(`\\b${name}\\s*=\\s*"([^"]+)"|\\b${name}\\s*=\\s*'([^']+)'`, 'i').exec(svgText);
    const v = (m?.[1] ?? m?.[2] ?? '').trim();
    return !v || v.endsWith('%') ? NaN : parseFloat(v);
  };
  const w = dim('width'), h = dim('height');
  return [0, 0, w > 0 ? w : 100, h > 0 ? h : 100];
}

// Crop a vector by narrowing ONLY the root <svg>'s viewBox to the sub-rect (content
// coordinates are untouched, so it stays fully vector); width/height are set to the
// crop's size and preserveAspectRatio is forced to none so the box maps 1:1 (no
// letterbox). Only the opening tag is rewritten - child width/height are left alone.
function cropSvg(svgText: string, box: [number, number, number, number]): string {
  const [x, y, w, h] = box;
  const m = /<svg\b([^>]*)>/i.exec(svgText);
  if (!m) return svgText;
  const attrs = m[1]!.replace(/\s(viewBox|width|height|preserveAspectRatio)\s*=\s*("[^"]*"|'[^']*')/gi, '');
  const open = `<svg${attrs} viewBox="${x} ${y} ${w} ${h}" width="${Math.round(w)}" height="${Math.round(h)}" preserveAspectRatio="none">`;
  return svgText.replace(m[0], open);
}

// ── Icons (Lucide house style) ────────────────────────────────────────────────
const STAR_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
const SHARE_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>';
const TAG_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r="1.5" fill="currentColor"/></svg>';
const TRASH_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
const EYE_OFF_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>';
const EYE_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
const DOWNLOAD_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
// Lucide "crop"
const CROP_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>';
const CHEVRON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 6 15 12 9 18"/></svg>';
// Larger left/right chevrons for the details modal's prev/next paging.
const CHEVRON_LEFT = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 6 9 12 15 18"/></svg>';
const CHEVRON_RIGHT = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 6 15 12 9 18"/></svg>';
const SLIDERS_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>';
const PENCIL_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const ZOOM_IN_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>';
const ZOOM_OUT_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><line x1="8" y1="11" x2="14" y2="11"/></svg>';
// A 2x2 pixel grid - the smooth ⇄ pixel-accurate interpolation toggle in the zoom pill.
const INTERP_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';
// Four corner brackets - the "zoom to fit" (reset to 100%) button in the zoom pill.
const FIT_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>';
const CHECK_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
const COPY_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
// Swap arrows - "replace this file with another", keeping the same id.
const REPLACE_ICON = icon('repeat', { size: 15 });
// Replace's file-picker accept for a still-image asset - a subset of UPLOAD_ACCEPT that omits
// video/audio/lottie/data/PDF/PPTX, so the OS dialog only offers files that can actually stand
// in for an image. (replaceUserUpload still enforces the kind at ingest as the hard guard.)
const REPLACE_IMAGE_ACCEPT = 'image/svg+xml,image/png,image/apng,image/jpeg,image/webp,image/gif,image/avif,image/heic,image/heif,image/bmp,.bmp,image/x-icon,.ico,.cur,.svg,.svgz';
// Filled play/pause glyphs for the details-modal Lottie playback overlay.
const PLAY_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const PAUSE_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
// Shield-check glyph for the "Check Content Credentials" action.
const SHIELD_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>';

// Containers the C2PA reader can inspect (engine c2pa-verify sniffFormat / EXTRACTORS):
// any asset in one of these formats CAN be checked, so its details page offers the
// checker - whether or not it currently carries a credential (a plain file honestly
// reports "No Content Credentials"). Audio joined the reader with the wav RIFF
// binding + mp3 (see /verify's accept list), then Ogg Opus (opus/ogg - the
// OpusTags comment binding, engine c2pa-containers placeOgg); lottie/JSON, fonts
// and tokens are still not readable, so they get no checker.
const VERIFIABLE_FORMATS = new Set(['pdf', 'png', 'apng', 'jpg', 'jpeg', 'gif', 'svg', 'tiff', 'webp', 'avif', 'mp4', 'm4a', 'webm', 'mkv', 'mp3', 'wav', 'opus', 'ogg']);
const isVerifiableAsset = (ref: AssetRef): boolean =>
  VERIFIABLE_FORMATS.has(String(ref.format ?? '').toLowerCase());

// True while the details modal is in inline-crop mode: the crop box owns the preview stage,
// so attachZoom's wheel/drag must stand down (and restore on exit). Module-level because
// attachZoom lives here, outside the view closure that flips it - one modal is open at a time.
let cropModeActive = false;

/**
 * Pan/zoom the details-modal preview so a user can inspect an asset closely. Zoom *sizes*
 * the media element (`.cat-thumb`) - explicit width/height in px - rather than CSS-scaling
 * it, so a vector re-rasterises crisply at every step. (Icons carry a tiny intrinsic size - 
 * e.g. `boxes` is 10.58px - which `max-width/object-fit` only *caps*, never upscales, so the
 * old `transform: scale()` was magnifying a ~11px bitmap.) At 100% the art is fit to the
 * stage; pan is a cheap translate, clamped so it can't be dragged fully out of view, and the
 * cursor point is held fixed on wheel/button zoom (focal-zoom formula about the centred
 * origin). Double-click toggles. All listeners live on the stage element, thrown away with
 * the modal - nothing to tear down.
 */
function attachZoom(dlg: HTMLDialogElement): void {
  const stage = dlg.querySelector<HTMLElement>('.cat-zoom-stage');
  const media = stage?.querySelector<HTMLElement>('.cat-thumb') ?? null;
  const hudEl = dlg.querySelector<HTMLElement>('.cat-zoom-hud');
  if (!stage || !media) return;
  const img = media as HTMLImageElement;
  // A Lottie preview is a mounted <svg> player (data-lottie-src marker), not an <img>: it has no
  // naturalWidth, and the SVG arrives asynchronously - so we read the aspect from its viewBox and
  // re-fit once it lands, rather than from decode()/load.
  const isLottie = media.hasAttribute('data-lottie-src');
  const isVideo = media.tagName === 'VIDEO';   // a <video class="cat-thumb"> is pan/zoomable too
  const MIN = 0.15, FIT = 1, MAX = 20;   // out to 15%, fit=100%, in to 2000%
  const PAD = 20;                        // matches .cat-zoom-stage padding
  let s = 1, tx = 0, ty = 0;
  // The optional glass loupe (lib/loupe-gl.ts), lazy-mounted only when a pixel-peeper turns it
  // on. Null the rest of the time - zero cost. Re-captures its texture on scale change (below).
  let loupe: Loupe | null = null;
  // The s=1 "fit" box: the largest aspect-preserving rectangle inside the padded stage.
  // Zoom multiplies this box; the SVG/image then renders at that true pixel size. Measured
  // ONCE and locked - never re-measured in place. (In the mobile layout the stage height is
  // indefinite, so an already-enlarged media inflates stage.clientHeight; re-measuring off
  // that would feed back into an ever-growing base. Locking + the viewport cap below make it
  // impossible.) `object-fit: contain` (from CSS) centres the art, so a 0×0-reporting SVG
  // just falls back to the stage aspect without a runaway.
  let baseW = 0, baseH = 0, clipW = 0, clipH = 0, baseLocked = false;
  const measureBase = (): void => {
    // Lock the visible clip box at the SAME moment as the fit box, while the media is reset to
    // fit and the stage is deflated to its true size. clampPan must clamp against these locked
    // values - never a live getBoundingClientRect(). On the mobile layout the stage height is
    // indefinite (`.cat-details-preview` is `max-height: 46vh` + `overflow: hidden`), so a
    // zoomed media inflates the stage's live height to its own; clamping off that would collapse
    // the vertical pan range to ~0 and make the top/bottom corners unreachable.
    clipW = Math.min(stage.clientWidth, window.innerWidth);
    clipH = Math.min(stage.clientHeight, window.innerHeight);
    const availW = Math.max(1, clipW - PAD * 2);
    const availH = Math.max(1, clipH - PAD * 2);
    // Aspect: an <img> exposes naturalWidth/Height; a Lottie renders an <svg viewBox> we read once
    // it has mounted. Until either is known, fall back to the stage aspect (the SVG's own
    // preserveAspectRatio keeps the art undistorted meanwhile - measureBase re-runs on load).
    let ar = availW / availH;
    if (img.naturalWidth > 0 && img.naturalHeight > 0) ar = img.naturalWidth / img.naturalHeight;
    else if (isVideo) {
      const v = media as HTMLVideoElement;
      if (v.videoWidth > 0 && v.videoHeight > 0) ar = v.videoWidth / v.videoHeight;
    }
    else if (isLottie) {
      const vb = media.querySelector('svg')?.viewBox?.baseVal;
      if (vb && vb.width > 0 && vb.height > 0) ar = vb.width / vb.height;
    }
    baseW = availW; baseH = availW / ar;
    if (baseH > availH) { baseH = availH; baseW = availH * ar; }
    baseLocked = true;
  };
  const clampPan = (): void => {
    // The pan range is the ABSOLUTE gap between the art and the stage, per axis, so
    // the art can sit anywhere from centred to one edge aligned with the matching
    // stage edge. This is what lets a cursor-anchored (focal) zoom actually hold its
    // point: the fit box is sized to the CONSTRAINING dimension, so most assets have
    // a wide margin in the other axis at low zoom - a `max(0, overflow)` clamp pinned
    // that axis to centre and yanked the cursor point back to the middle on the first
    // wheel steps ("zoom doesn't follow the mouse"). Using the absolute gap gives the
    // focal offset room while still never letting the art leave the viewport.
    const mx = Math.abs(baseW * s - clipW) / 2;
    const my = Math.abs(baseH * s - clipH) / 2;
    tx = Math.min(mx, Math.max(-mx, tx));
    ty = Math.min(my, Math.max(-my, ty));
  };
  const apply = (): void => {
    if (!baseLocked) measureBase();
    media.style.maxWidth = 'none';
    media.style.maxHeight = 'none';
    media.style.width = `${baseW * s}px`;
    media.style.height = `${baseH * s}px`;
    // The media is absolutely positioned at the stage centre (CSS left/top:50%); translate(-50%,-50%)
    // pulls it back onto that centre, then (tx,ty) pans. Grid-centring an oversized item pins it to
    // the top-left, which broke focal zoom - see the .cat-zoom-stage CSS note. Order is irrelevant for
    // pure translations, but the -50% must be present so the art's centre = stage centre + (tx,ty).
    media.style.transform = `translate(-50%, -50%) translate(${tx}px, ${ty}px)`;
    hud?.setReadout(`${Math.round(s * 100)}%`);
    // "zoomed" (pannable) only when the art is bigger than the fit box; at or below fit it is
    // centred with nothing to pan.
    stage.classList.toggle('is-zoomed', s > FIT + 0.001);
  };
  const zoomTo = (next: number, ox = 0, oy = 0): void => {
    const s2 = Math.min(MAX, Math.max(MIN, next));
    if (s2 === s) return;
    // Hold the cursor point fixed: screen offset = t + s·p about the centre origin.
    tx = ox - (s2 / s) * (ox - tx);
    ty = oy - (s2 / s) * (oy - ty);
    s = s2;
    if (s <= FIT + 0.001) { tx = 0; ty = 0; }   // fit or zoomed out ⇒ re-centre
    clampPan();
    apply();
    syncLoupe();   // scale changed ⇒ (de)activate the easter egg and re-capture if it's on
  };
  const offsetFrom = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = stage.getBoundingClientRect();
    return [e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)];
  };
  // A dedicated Fit button (leading the pill) resets to FIT (100%, the largest aspect-fit
  // box); the readout also resets on click, so either returns to fit.
  // Interpolation toggle, docked in the pill after a hairline (the HUD's `extras` slot):
  // smooth (bicubic, the default) ⇄ pixel-accurate (nearest-neighbor), so pixel-peepers can
  // read the exact pixels when zoomed in. Skipped for a Lottie - inline SVG has no raster to
  // sharpen. `image-rendering: pixelated` on the media is the whole effect.
  let pixelated = false;
  const closeLoupe = (): void => {
    loupe?.dispose();
    loupe = null;
    stage.classList.remove('has-loupe');
  };
  // The glass loupe is an EASTER EGG for pixel-peepers: no button of its own, and it exists only in
  // the one rare spot where a peeper lives - the stage zoomed all the way in (2000%) AND switched to
  // pixel-accurate viewing. Hitting that combination auto-mounts the WebGL magnifier (lib/loupe-gl.ts,
  // lazy-imported on first use); leaving it (zoom out, or interpolation back on) tears it down. Only
  // for a still image on a hover-capable pointer, stood down under reduced-motion / the perf-UI flag.
  const loupeCapable = !isLottie && !isVideo
    && typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches
    && !prefersReducedMotion() && !perfUiOn();
  const loupeWanted = (): boolean => pixelated && s >= MAX - 0.001;   // MAX = 20 = 2000%
  const activateLoupe = async (): Promise<void> => {
    if (!loupeCapable || loupe) return;
    const { mountLoupe } = await import('../lib/loupe-gl.ts');
    if (loupe || !loupeWanted()) return;   // condition lapsed (or already mounted) while importing
    // A big lens - ~62% of the stage's short side, clamped - so the peeper gets a generous glass.
    const r = stage.getBoundingClientRect();
    const size = Math.max(320, Math.min(520, Math.round(Math.min(r.width, r.height) * 0.62)));
    const l = mountLoupe(stage, img, () => [baseW * s, baseH * s], size);
    if (!l) return;   // no WebGL, or a tainted cross-origin source ⇒ silently stay on plain zoom
    loupe = l;
    stage.classList.add('has-loupe');
  };
  // Reconcile the loupe with the live state - called whenever zoom or the toggle changes.
  const syncLoupe = (): void => {
    if (!loupeCapable) return;
    const want = loupeWanted();
    if (want && !loupe) { void activateLoupe(); return; }
    if (!want && loupe) { closeLoupe(); return; }
    if (loupe) loupe.refresh();   // still on, scale changed ⇒ re-capture so a vector stays crisp
  };
  const interpBtn = document.createElement('button');
  interpBtn.type = 'button';
  interpBtn.className = 'cat-zoom-btn cat-zoom-interp';
  interpBtn.innerHTML = INTERP_ICON;
  interpBtn.setAttribute('aria-pressed', 'false');
  interpBtn.setAttribute('aria-label', t('Pixel-accurate zoom'));
  interpBtn.title = t('Smooth / pixel-accurate');
  interpBtn.addEventListener('click', () => {
    pixelated = !pixelated;
    media.style.imageRendering = pixelated ? 'pixelated' : '';
    interpBtn.classList.toggle('is-active', pixelated);
    interpBtn.setAttribute('aria-pressed', String(pixelated));
    syncLoupe();   // the loupe only appears when pixel-accurate meets 2000%
  });
  const hud = hudEl ? mountZoomHud(hudEl, {
    ariaLabel: t('Zoom'),
    classes: { btn: 'cat-zoom-btn', pct: 'cat-zoom-pct', fit: 'cat-zoom-fit', sep: 'cat-zoom-sep' },
    initialReadout: '100%',
    onZoom: (dir) => zoomTo(s * (dir > 0 ? 1.5 : 1 / 1.5)),
    onFit: () => { s = FIT; tx = 0; ty = 0; apply(); syncLoupe(); },
    fitPosition: 'start',
    fitContent: FIT_ICON, fitAriaLabel: t('Fit to view'), fitTitle: t('Fit to view'),
    outContent: ZOOM_OUT_ICON,
    inContent: ZOOM_IN_ICON,
    outAriaLabel: t('Zoom out'), outTitle: t('Zoom out'),
    inAriaLabel: t('Zoom in'), inTitle: t('Zoom in'),
    pctAriaLabel: t('Reset zoom'), pctTitle: t('Reset zoom'),
    extras: isLottie ? [] : [interpBtn],
  }) : null;
  stage.addEventListener('wheel', (e) => {
    if (cropModeActive) return;   // inline crop owns the stage
    e.preventDefault();
    const [ox, oy] = offsetFrom(e);
    zoomTo(s * (e.deltaY < 0 ? 1.15 : 1 / 1.15), ox, oy);
  }, { passive: false });
  let dragging = false, lastX = 0, lastY = 0;
  stage.addEventListener('pointerdown', (e) => {
    if (cropModeActive || s <= FIT) return;   // pan only when zoomed IN past fit
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    stage.classList.add('is-panning');
    try { stage.setPointerCapture(e.pointerId); } catch { /* not supported */ }
  });
  stage.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    tx += e.clientX - lastX; ty += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    clampPan(); apply();
  });
  const endDrag = (e: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    stage.classList.remove('is-panning');
    try { stage.releasePointerCapture(e.pointerId); } catch { /* already released */ }
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  // Glass loupe render pass. Registered AFTER the pan handler so tx/ty are already updated for
  // this same pointermove. No rAF - the lens redraws only when the pointer moves.
  stage.addEventListener('pointermove', (e) => {
    if (!loupe) return;
    const [ox, oy] = offsetFrom(e);
    const W = baseW * s, H = baseH * s;
    const uv = offsetToUv(ox, oy, W, H, tx, ty);
    if (!uv) { loupe.hide(); return; }   // cursor off the art
    const [hu, hv] = halfWindow(W, H, loupe.size);
    const r = stage.getBoundingClientRect();
    loupe.render(e.clientX - r.left - loupe.size / 2, e.clientY - r.top - loupe.size / 2, uv[0], uv[1], hu, hv);
  });
  stage.addEventListener('pointerleave', () => loupe?.hide());
  stage.addEventListener('dblclick', (e) => {
    if (cropModeActive) return;
    const [ox, oy] = offsetFrom(e);
    zoomTo(s > FIT ? FIT : 2.5, ox, oy);   // dbl-click toggles fit ⇄ 250%
  });
  // Re-fit once the intrinsic aspect ratio is known. `decode()` resolves after the bytes are
  // decoded (unlike `complete`, which can be true with naturalWidth still 0); fall back to the
  // load event for older engines. Reset to 100% and drop the inline size first so the stage
  // deflates to its true dimensions before we re-measure.
  const refit = (): void => {
    s = FIT; tx = 0; ty = 0;
    media.style.width = ''; media.style.height = '';
    baseLocked = false;
    apply();
    syncLoupe();
  };
  if (isLottie) {
    // The player's <svg> mounts a tick or two after the modal opens; re-fit the moment it lands so
    // the fit box matches the animation's true aspect (else it stays at the stage-aspect fallback).
    // The observer is dropped after the first mount, or GC'd with the modal if it never arrives.
    if (media.querySelector('svg')) refit();
    else {
      const mo = new MutationObserver(() => {
        if (media.querySelector('svg')) { mo.disconnect(); refit(); }
      });
      mo.observe(media, { childList: true, subtree: true });
    }
  } else if (isVideo) {
    const v = media as HTMLVideoElement;
    if (v.videoWidth) refit();
    else v.addEventListener('loadedmetadata', refit, { once: true });
  } else if (img.naturalWidth === 0) {
    if (typeof img.decode === 'function') img.decode().then(refit).catch(() => {});
    img.addEventListener('load', refit, { once: true });
  }
  // Free the loupe's GL context when the modal closes (a <dialog> fires 'close' on .close()).
  dlg.addEventListener('close', closeLoupe, { once: true });
  apply();
}

interface ViewElement extends HTMLElement { _cleanup?: () => void; }

export async function mountCatalog(viewEl: HTMLElement, hostIn: HostV1, params = ''): Promise<void> {
  const host = hostIn as CatalogHost;
  // Titles the tab AND labels this view for the next view's back pill (lib/back-nav.ts).
  document.title = tRaw('{name} - Lolly', { name: t('Catalogue') });
  // Deep link: /#/c?asset=<id> focuses (scrolls to + highlights) that asset on load.
  const linkedAsset = new URLSearchParams(params).get('asset');
  // Deep link: /#/c?section=<key>[,<key>…] lands with those sections EXPANDED (over the
  // collapsed-by-default state) and scrolls the first into view - the section-level sibling
  // of ?asset=. Validated against ALL_SECTION_KEYS at apply time (below).
  const linkedSections = (new URLSearchParams(params).get('section') || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  // Live state, re-read on reload(); the render reads these closure vars.
  let profile: Profile | null = null;
  let allAssets: AssetRef[] = [];
  let assetById = new Map<string, AssetRef>();
  // Uploads soft-deleted behind a live undo toast (lib/undo-toast.ts): out of
  // sight immediately, actually deleted only when the toast settles. reload()
  // filters them so a mid-toast refresh can't resurrect the tile.
  const pendingDeletes = new Set<string>();
  let favSet = new Set<string>();
  let hiddenSet = new Set<string>();
  let overrides: Record<string, string> = {};
  // Lazily-built { assetId → lowercased search haystack }. Rebuilt on the first
  // matchesQuery of a search burst; invalidated whenever `overrides` (category labels
  // feed the haystack) or `allAssets` changes. Route every overrides write through
  // setOverrides so a future assignment can't leave a stale category label in search.
  let searchHaystack: Map<string, string> | null = null;
  const setOverrides = (v: Record<string, string>) => { overrides = v; searchHaystack = null; };
  let headshotUrl = '';
  // `#/c?hidden` and `#/c?type=<bucket>` seed the two grid filters for THIS mount -
  // the same read-only, consumed-on-mount contract as `?asset=`/`?section=`/`?q=`
  // above: never persisted, never written back into a generated link. Enough for a
  // shared link or a screenshot recipe to land on a known grid. `type` is checked
  // against the bucket table itself (a Set - an object lookup would answer yes to
  // 'constructor'); anything unrecognised leaves the default 'all' standing.
  let showHidden = new URLSearchParams(params).has('hidden');
  let loadFailed = false;                    // the catalog query threw - a total sync failure, distinct from an empty catalogue
  const urlType = new URLSearchParams(params).get('type');
  let typeFilter: TypeFilter = urlType && new Set<string>(['all', ...Object.keys(TYPE_FILTER_TYPES)]).has(urlType)
    ? urlType as TypeFilter
    : 'all';                                 // filetype filter in the sticky toolbar (all/image/vector/motion/audio/text)
  // Footer search text (lowercased); filters the asset grid. Seeded from #/c?q=… on
  // mount (plans/99 M0) with the same trim+lowercase the input handler applies.
  let query = (new URLSearchParams(params).get('q') || '').trim().toLowerCase();
  let iconThemes: IconTheme[] = [];          // two-colour pairings for themable icons (styler)
  let catIconTheme: string | null = null;    // colour applied to a themable category's grid (null = base)
  const iconSvgCache = new Map<string, string>();  // base SVG text per themable-icon id - the recolour source
  let photoTreatments: PhotoTreatment[] = [];  // greyscale/duotone washes for raster photo groups (like iconThemes)
  let catPhotoTreatment: string | null = null; // treatment applied to a raster category's grid (null = original)
  const TREATMENT_FILTER_PREFIX = 'lolly-pt-'; // id prefix for the injected <filter> defs (live CSS preview)
  const collapsed = new Set<string>();      // section keys folded; survives re-render + persisted (see COLLAPSE_KEY)
  let mounted = true;                        // false after the view swaps out (guards async)
  let firstPaint = true;                     // arm the entrance cascade only on the first render
  let dlDialog: HTMLDialogElement | null = null;        // the download dialog, if open
  let dlModal: ModalHandle<void> | null = null;
  let detailsDialog: HTMLDialogElement | null = null;   // the asset details modal, if open
  let detailsModal: ModalHandle<void> | null = null;
  // The active brand's palette (host.tokens, cached) - set once in reload() before
  // the first render; swatchesSectionHtml() reads this closure var synchronously.
  let palette: readonly PaletteEntry[] = PALETTE;
  // The fonts THIS brand actually carries - its declared font tokens matched to
  // the bundled specs, plus any on-device Google fonts the user added. Replaces
  // the old hardcoded FONTS list so a custom brand no longer shows SUSE's faces.
  let catFonts: CatFont[] = [];
  /** The user's per-asset cover overrides + the brand colour pool they resolve against.
   *  Both live for the mount: the pool is theme-dependent and the overrides are read on
   *  every tile paint, so re-deriving either per tile would be pure waste. */
  let coverMap: Map<string, AudioCover> = new Map();
  let coverPool: string[] = [];

  // Multi-select of the user's OWN uploads (a closure Set of user-asset ids; survives the
  // render() that wipes viewEl.innerHTML). Only user uploads are selectable - shared
  // catalog assets can't be deleted (they're a permanent contract), only hidden. Mirrors
  // the projects view's checkbox + floating bulk-bar pattern.
  const selected = new Set<string>();

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
  const selectableTiles = (): HTMLElement[] =>
    [...viewEl.querySelectorAll<HTMLElement>('.cat-tile .cat-check[data-select]')]
      .map(dot => dot.closest<HTMLElement>('.cat-tile'))
      .filter((tile): tile is HTMLElement => !!tile);

  const tileSelect = wireTileSelect({
    host: viewEl,
    tiles: selectableTiles,
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
      syncSelectAll();
      syncBulkBar();
    },
    clear: () => handleBulk('clear'),
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
        const uploads = refs.map(id => assetById.get(id)).filter((r): r is AssetRef => !!r && r.source === 'user');
        if (uploads.length) softDeleteUploads(uploads);
      },
      rename: (ref) => {
        const a = assetById.get(ref);
        if (a && a.source === 'user') void renameUserAsset(a);
      },
    },
  });

  // ── Context menu: right-click / long-press on any asset tile (lib/context-menu.ts,
  // shared with gallery + projects). Exposes the actions that previously lived only
  // behind the details modal; a tile inside a multi-selection of uploads opens the
  // BULK menu mirroring the bulk bar. Single-item Duplicate/Delete reuse the
  // (confirmed) bulk flows over a one-item selection - see onTileMenuAction.
  function catTileMenuHtml(id: string): string {
    const ref = assetById.get(id);
    if (!ref) return '';
    const base = assetBaseId(id);
    const isUser = ref.source === 'user';
    return [
      menuItemHtml('open', icon('externalLink'), t('Details')),
      menuItemHtml('fav', icon('star'), favSet.has(base) ? t('Remove from favourites') : t('Add to favourites')),
      menuItemHtml('download', icon('download'), t('Download…')),
      ref.source === 'user' ? menuItemHtml('convert-copy', icon('duplicate'), t('Convert a copy…')) : '',
      isUser ? menuItemHtml('saved-versions', icon('duplicate'), t('Saved versions…')) : '',
      menuItemHtml('send', icon('upload'), t('Send to…')),
      menuItemHtml('share', icon('link'), t('Copy link')),
      menuItemHtml('select', icon('check'), selected.has(id) ? t('Deselect') : t('Select')),
      menuItemHtml('add-to-project', icon('folder'), t('Add to project…')),
      isUser ? menuItemHtml('duplicate', icon('duplicate'), t('Duplicate')) : '',
      menuItemHtml('hide', icon('eye'), hiddenSet.has(base) ? t('Unhide') : t('Hide')),
      isUser ? menuItemHtml('delete', icon('trash'), t('Delete'), { danger: true }) : '',
    ].join('');
  }
  // Mirrors the bulk bar's gating: favourite/hide for any selection, the
  // destructive rows only when the whole selection is the user's own uploads.
  function catBulkMenuHtml(): string {
    const uploads = allSelectedUploads();
    return `<p class="folder-menu-head">${t('{n} selected', { n: selected.size })}</p>`
      + `<div class="folder-menu-list" role="menu" aria-label="${escape(t('Selection actions'))}">${[
        menuItemHtml('fav', icon('star'), allSelectedFav() ? t('Unfavourite') : t('Favourite')),
        menuItemHtml('add-to-project', icon('folder'), t('Add to project…')),
        menuItemHtml('hide', icon('eye'), allSelectedHidden() ? t('Unhide') : t('Hide')),
        uploads ? menuItemHtml('duplicate', icon('duplicate'), t('Duplicate')) : '',
        uploads ? menuItemHtml('download', icon('download'), t('Download')) : '',
        uploads ? menuItemHtml('delete', icon('trash'), t('Delete'), { danger: true }) : '',
      ].join('')}</div>`;
  }
  async function onTileMenuAction(act: string, id: string | null): Promise<void> {
    if (id === null) { handleBulk(act); return; }   // bulk menu mirrors the bulk bar
    const ref = assetById.get(id);
    if (!ref) return;
    if (act === 'open') { openDetails(ref); return; }
    if (act === 'fav') { await toggleFavourite(id); return; }
    if (act === 'download') { await openAssetDownloadDialog(ref); return; }
    if (act === 'saved-versions') { const { openAssetVersions } = await import('./asset-versions.ts'); await openAssetVersions(id, host, reload); return; }
    if (act === 'convert-copy') {
      try {
        const { validateConvertFiles } = await import('../lib/file-conversion.ts');
        const response = await fetch(ref.url);
        if (!response.ok) throw new Error(t('Could not read this file.'));
        // User uploads resolve to device-owned Blob URLs, never an arbitrary remote fetch.
        const blob = await response.blob(); validateConvertFiles([blob]);
        const { openFileInUtility } = await import('../lib/drop-router.ts');
        const name = String(ref.meta?.name || ref.id.split('/').pop() || 'asset');
        openFileInUtility('convert', new File([blob], name.includes('.') ? name : `${name}.${ref.format}`, { type: blob.type }));
      } catch (error) { announce(error instanceof Error ? error.message : String(error), { assertive: true }); }
      return;
    }
    if (act === 'send') { await openSendDialog(ref); return; }
    if (act === 'share') {
      try { await navigator.clipboard.writeText(assetLink(ref)); announce(t('Link copied')); }
      catch { announce(t('Couldn’t copy the link'), { assertive: true }); }
      return;
    }
    if (act === 'select') { toggleSelect(id); return; }
    if (act === 'add-to-project') { await addToProject([id]); return; }
    if (act === 'duplicate' || act === 'delete') {
      // "This tile", not "the selection": a multi-selection containing the tile would
      // have opened the bulk menu instead, so replacing the selection here is faithful.
      selected.clear(); selected.add(id);
      for (const tile of viewEl.querySelectorAll<HTMLElement>('.cat-tile')) {
        const on = selected.has(tile.dataset.id ?? '');
        tile.classList.toggle('is-selected', on);
        tile.querySelector('.cat-check')?.setAttribute('aria-pressed', String(on));
      }
      syncSelectAll(); syncBulkBar();
      handleBulk(act);
      return;
    }
    if (act === 'hide') { await setHidden(assetBaseId(id), !hiddenSet.has(assetBaseId(id))); }
  }
  const tileMenu = wireTileContextMenu({
    host: viewEl,
    tileSelector: '.cat-tile[data-id]',
    refOf: (tile) => tile.dataset.id ?? null,
    isBulkTarget: (id) => selected.size > 1 && selected.has(id),
    singleHtml: (tgt) => catTileMenuHtml(tgt.ref),
    bulkHtml: () => catBulkMenuHtml(),
    onAction: (act, tgt) => { void onTileMenuAction(act, tgt?.ref ?? null); },
  });

  // Favourites strip presentation - the same cinematic component as the Tools hero,
  // with a Gallery ↔ Cover Flow view mode and an on/off switch, both persisted. Kept
  // shorter than the hero (the previews shouldn't dominate the page here).
  const FAV_VIEW_KEY = 'lolly-catalog-fav-view';
  const FAV_STRIP_KEY = 'lolly-catalog-fav-strip';
  let favView: FeaturedViewMode = 'gallery';
  let favStripOn = true;
  let featuredHandle: FeaturedRowHandle | null = null;   // the mounted favourites strip, if any
  let lottieThumbs: { destroy(): void } | null = null;   // on-screen-gated lottie grid autoplayer
  let audioThumbs: { destroy(): void } | null = null;    // on-screen-gated waveform upgrader
  let textThumbs: { destroy(): void } | null = null;     // on-screen-gated text-excerpt upgrader
  let motionThumbs: { destroy(): void } | null = null;   // intent gate for every video thumbnail
  let pdfThumbs: { destroy(): void } | null = null;      // on-screen-gated PDF first-page upgrader
  let viewOptsOpen = false;
  let closeViewOpts: () => void = () => {};              // set in wire(); called on teardown
  // Section sort (plans/132 WP-A) - applied per section, persisted per device.
  // Last modified is the DEFAULT (Andy, 2026-08-20 - matches Projects): uploads
  // lead with what was touched most recently; catalog assets carry no dates, so
  // the stable sort leaves their curated order untouched. The menu's 'Default'
  // option = the curated manifest order (uploads newest-first from the bridge).
  const SORT_PREF_KEY = 'lolly-catalog-sort';
  // Layout + density (plans/132 WP-I): grid (default) | list rows, and a
  // comfortable | compact tile size. Both persisted, both pure CSS classes.
  const LAYOUT_PREF_KEY = 'lolly-catalog-layout';
  const DENSITY_PREF_KEY = 'lolly-catalog-density';
  let catLayout: 'grid' | 'list' = localStorage.getItem(LAYOUT_PREF_KEY) === 'list' ? 'list' : 'grid';
  let catDensity: 'comfortable' | 'compact' = localStorage.getItem(DENSITY_PREF_KEY) === 'compact' ? 'compact' : 'comfortable';
  const CAT_SORTS: readonly CatSort[] = ['default', 'name', 'added', 'modified', 'size', 'type'];
  let catSort: CatSort = 'modified';
  try {
    const stored = localStorage.getItem(SORT_PREF_KEY) as CatSort | null;
    if (stored && CAT_SORTS.includes(stored)) catSort = stored;
  } catch { /* storage off */ }
  try {
    const v = localStorage.getItem(FAV_VIEW_KEY);
    if (v === 'coverflow' || v === 'gallery') favView = v;
    if (localStorage.getItem(FAV_STRIP_KEY) === 'off') favStripOn = false;
  } catch { /* storage off */ }

  // Section fold state persists across reloads (like the fav-strip prefs above).
  // First-visit default (2026-08-20 audit): the ASSET sections open - a library
  // should lead with its content, not a stack of closed headers - with only the
  // reference material (swatches/fonts) folded. Once the user touches any fold
  // the stored set is the whole truth, exactly as before.
  const COLLAPSE_KEY = 'lolly-catalog-collapsed';
  const ALL_SECTION_KEYS = ['your-uploads', ...LIB_GROUPS.map(g => g.key), 'hidden', 'swatches', 'fonts'];
  const FIRST_VISIT_COLLAPSED = ['swatches', 'fonts'];
  try {
    const stored = localStorage.getItem(COLLAPSE_KEY);
    const keys = stored ? (JSON.parse(stored) as string[]) : FIRST_VISIT_COLLAPSED;
    for (const k of keys) collapsed.add(k);
  } catch { for (const k of FIRST_VISIT_COLLAPSED) collapsed.add(k); }
  const persistCollapsed = (): void => {
    try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...collapsed])); } catch { /* storage off */ }
  };
  // Keep the address bar in step with the currently-EXPANDED sections (…#/c?section=a,b)
  // via replaceState - no navigation / no remount - so the live view is itself a copy-able
  // deep link. A bare #/c when everything is folded. Runs on user fold/unfold only.
  const syncSectionUrl = (): void => {
    const open = ALL_SECTION_KEYS.filter(k => !collapsed.has(k));
    const base = location.hash.split('?')[0] || '#/c';
    try {
      history.replaceState(history.state, '', `${location.pathname}${base}${open.length ? `?section=${open.join(',')}` : ''}`);
    } catch { /* history unavailable - non-fatal */ }
  };

  // The active brand's fonts: its declared font tokens (matched to a bundled spec
  // when the family is one Lolly ships, so it keeps downloads + licence), then any
  // Google fonts the user installed on this device. De-duped by family.
  async function computeBrandFonts(): Promise<CatFont[]> {
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

  async function reload(): Promise<void> {
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
    if (!mounted) return;
    palette = livePal;
    coverMap = loadAudioCovers(prof);
    coverPool = audioThumbPool(livePal, host, (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light') as ThumbTheme);
    catFonts = await computeBrandFonts().catch(() => [] as CatFont[]);
    loadFailed = failed;
    profile = prof;
    favSet = loadFavouriteAssets(prof);
    hiddenSet = loadHiddenAssets(prof);
    setOverrides(loadAssetCategories(prof));
    headshotUrl = prof?.headshot?.id
      ? (await host.assets.get(prof.headshot.id).catch(() => null))?.url || ''
      : '';
    const userVisual = user.filter(a => a.id !== HEADSHOT_ID);
    // Catalog first, then user uploads. Only image-thumbnailable types from the catalog
    // (palette/tokens/font catalog entries are engine data covered elsewhere), a user's OWN
    // audio upload, AND catalog focus-music (audio tagged 'neurospicy' - the generated
    // songs + lo-fi loops) so they can be auditioned here. Other catalog audio (music beds)
    // stays out. Each audio tile renders a player in the details modal.
    allAssets = [...catalog, ...userVisual]
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
    if (pendingDeletes.size) allAssets = allAssets.filter(a => !pendingDeletes.has(a.id));
    assetById = new Map(allAssets.map(a => [a.id, a]));
    searchHaystack = null; // asset set changed - drop the stale search index

    // Colour pairings for the themable-icon styler - only if the catalog supplies them.
    if (allAssets.some(isThemable) && typeof host.assets._iconThemes === 'function') {
      iconThemes = await host.assets._iconThemes().catch(() => [] as IconTheme[]);
    }
    // Photo colour treatments (greyscale/duotone) for raster groups - the bitmap sibling
    // of the icon colours; only fetched when the catalogue actually holds raster assets.
    if (allAssets.some(a => a.type === 'raster') && typeof host.assets._photoTreatments === 'function') {
      photoTreatments = await host.assets._photoTreatments().catch(() => [] as PhotoTreatment[]);
      if (catPhotoTreatment && !photoTreatments.some(t => t.id === catPhotoTreatment)) catPhotoTreatment = null;
    }
  }

  // ── markup ───────────────────────────────────────────────────────────────────
  // The shared .gallery-topbar shell (component-audit rec 11) - the view-toggle + the
  // language FAB + profile pill are unified in view-topbar.ts; only the "view options"
  // button (`right`) and its popover are catalog's own.
  function catalogTopbarHtml(): string {
    return viewTopbarHtml({
      active: 'catalog',
      right: `<button type="button" class="filter-fab cat-viewopts-btn" aria-label="${escape(t('View options'))}" aria-haspopup="true" aria-expanded="${viewOptsOpen}" title="${escape(t('View options'))}">${SLIDERS_ICON}</button>`,
      popover: `
        <div class="cat-viewopts filter-popover" role="group" aria-label="${escape(t('Catalog view options'))}"${viewOptsOpen ? '' : ' hidden'}>
          ${themeSegmentHtml()}
          ${soundSegmentHtml()}
          <p class="filter-pop-head">${t('Layout')}</p>
          ${segHtml('catalog-layout', [
            { id: 'grid', label: t('Grid') },
            { id: 'list', label: t('List') },
          ], catLayout, t('Catalog layout'), { attr: 'data-catlayout' })}
          ${segHtml('catalog-density', [
            { id: 'comfortable', label: t('Comfortable') },
            { id: 'compact', label: t('Compact') },
          ], catDensity, t('Tile density'), { attr: 'data-catdensity' })}
          <p class="filter-pop-head">${t('Sort by')}</p>
          ${segHtml('catalog-sort', [
            { id: 'default', label: t('Default') },
            { id: 'name', label: t('Name') },
            { id: 'added', label: t('Added') },
            { id: 'modified', label: t('Modified') },
            { id: 'size', label: t('Size') },
            { id: 'type', label: t('Type') },
          ], catSort, t('Sort assets by'), { attr: 'data-catsort' })}
          <p class="filter-pop-head">${t('Favourites')}</p>
          ${segHtml('favourites-view', [
            { id: 'gallery', label: t('Gallery') },
            { id: 'coverflow', label: t('Cover Flow') },
          ], favView, t('Favourites view mode'), { attr: 'data-favview' })}
          <label class="filter-pop-check">
            <input type="checkbox" class="cat-favstrip-toggle field-check"${favStripOn ? ' checked' : ''}>
            <span>${t('Show favourites strip')}</span>
          </label>
        </div>`,
      profile: { firstname: profile?.firstname, headshotUrl },
    });
  }

  // One collapsible section shell - the category, hidden, Swatches and Fonts groups all
  // use it, so "Collapse all" and the [data-cat-toggle] handler treat them uniformly.
  // Driven by the `collapsed` Set; an active search force-expands every group so matches
  // are never hidden behind a fold. `count` is optional (null → no pill); `extraClass`
  // lets a group opt into extra chrome (e.g. the reference-panel divider).
  function groupSection(key: string, label: string, count: number | null, bodyHtml: string, extraClass = ''): string {
    const isCollapsed = collapsed.has(key) && !query;
    return `<section class="cat-group${isCollapsed ? ' is-collapsed' : ''}${extraClass ? ' ' + extraClass : ''}" data-group="${escape(key)}">
      <button type="button" class="cat-group-head" data-cat-toggle="${escape(key)}" aria-expanded="${!isCollapsed}">
        <span class="cat-group-chevron">${CHEVRON}</span>
        <span class="cat-group-icon">${categoryGlyph(key)}</span>
        <span class="cat-group-title">${escape(t(label))}</span>
        ${count != null ? `<span class="cat-group-count">${count}</span>` : ''}
      </button>
      <div class="cat-group-body">${bodyHtml}</div>
    </section>`;
  }
  // Asset groups wrap their tiles in the responsive .cat-grid.
  const sectionHtml = (key: string, label: string, count: number, tilesHtml: string): string =>
    groupSection(key, label, count, `<div class="cat-grid">${tilesHtml}</div>`);

  // `asSpan` renders the thumbnail with span-only markup (for nesting inside a <button>);
  // otherwise a plain <img>/<div>. Both are used: tiles nest it in the open-details button.
  function thumbHtml(ref: AssetRef, asSpan = false, full = false): string {
    const tag = asSpan ? 'span' : 'div';
    if (ref.meta?._placeholder) return `<${tag} class="cat-thumb cat-thumb-stub">${escape(ref.type)}</${tag}>`;
    // A brand PALETTE asset. Its swatches are the live brand palette (the same
    // source the Swatches panel paints from), so it needs no fetch. A grid tile is
    // a compact mosaic of the presets; the details modal (full) is Colour Lab in a
    // card - every preset with its hex + OKLCH and a freshly EXTRAPOLATED OKLab
    // tint→shade ramp (the exact derivation the #/lab view uses), so the "hard-coded
    // presets and their extrapolated values" all read at a glance.
    if (ref.type === 'palette') {
      const g = groupPalette(palette);
      const presets = [...g.brand, ...g.spectrum];
      const solid = (presets.length ? presets : palette).filter(c => !isTransparent(c.hex));
      if (full) {
        const rows = solid.map(c => {
          const o = hexToOklch(c.hex);
          if (!o) return '';
          // Same tint→shade curve as the Colour Lab view: chroma pulled in at the
          // pale end and pushed out at the dark end so the ramp reads clean top and
          // bottom; the perceptual spacing is rampOklab's correctLightness.
          const ramp = rampOklab(
            [oklchToHex({ l: 0.97, c: o.c * 0.22, h: o.h }), c.hex, oklchToHex({ l: 0.13, c: o.c * 0.5, h: o.h })],
            9, { correctLightness: true },
          );
          const cells = ramp.map(hx => `<span class="cat-lab-step" style="background:${escape(hx)}" title="${escape(hx)}"></span>`).join('');
          const oklch = `oklch(${(o.l * 100).toFixed(1)}% ${o.c.toFixed(3)} ${Math.round(o.h)})`;
          return `<div class="cat-lab-row">`
            + `<span class="cat-lab-swatch" style="background:${escape(c.hex)}"></span>`
            + `<span class="cat-lab-name">${escape(c.label)}</span>`
            + `<code class="cat-lab-hex">${escape(c.hex)}</code>`
            + `<code class="cat-lab-oklch">${escape(oklch)}</code>`
            + `<span class="cat-lab-ramp">${cells}</span></div>`;
        }).join('');
        return `<${tag} class="cat-thumb cat-swatch-lab">${rows}</${tag}>`;
      }
      const cells = solid.slice(0, 12).map(c => `<span style="background:${escape(c.hex)}"></span>`).join('');
      return `<${tag} class="cat-thumb cat-thumb-swatches" aria-hidden="true">${cells}</${tag}>`;
    }
    // Lottie: a looping player mounted over the still poster - autoplayLottieThumbs mounts it
    // while the tile is on screen; the poster background (or a ▶ for a posterless user upload)
    // is the resting frame. The json is the play source: a library lottie exposes it on
    // meta.animationUrl (ref.url is the poster); a user upload's url IS the json.
    if (ref.type === 'lottie') {
      const json = ref.source === 'user' ? ref.url : (typeof ref.meta?.animationUrl === 'string' ? ref.meta.animationUrl : '');
      const poster = ref.source !== 'user' && typeof ref.meta?.posterUrl === 'string' ? ref.meta.posterUrl : '';
      // A looping SVG player mounted over the still poster. Grid tiles get it via
      // autoplayLottieThumbs (on-screen gated); the details modal (full) mounts one player and
      // makes it zoomable - a Lottie renders as SVG, so it inspects crisply like vector art,
      // with a play/pause overlay (openDetails). The poster is the resting background until the
      // player loads; a posterless user upload shows a centred ▶. In the modal attachZoom sizes
      // the box explicitly, so the "no intrinsic height" grid caveat doesn't apply.
      if (json) {
        const style = poster ? ` style="background-image:url('${escape(poster)}')"` : '';
        return `<${tag} class="cat-thumb cat-thumb-motion" data-lottie-src="${escape(json)}" data-lottie-fit="contain"${style} aria-hidden="true">${poster ? '' : '▶'}</${tag}>`;
      }
      if (poster) return `<img class="cat-thumb" src="${escape(poster)}" alt="" loading="lazy" decoding="async">`;
      return `<span class="cat-thumb cat-thumb-stub" aria-hidden="true">▶</span>`;
    }
    // A video needs a <video> (an <img> src=mp4 would break). <video> is phrasing
    // content, so it's valid inside the tile's <button> - no span/div switch needed.
    // It PLAYS ONLY ON INTENT - hover/focus on a mouse, the most-centered tile on touch -
    // through the one policy in lib/preview-media.ts, armed by mountMotionThumbs below.
    // It used to be `autoplay preload="metadata"` with no visibility gate, so painting the
    // grid fetched a header for every clip in the catalog and played all of them at once.
    // (gif/apng/animated-webp are type:'raster' and animate natively in the <img> below.)
    // In the details modal (`full`) the user has explicitly opened THIS asset, so it is
    // the one video that should load and play on sight - the intent gate exists to stop a
    // grid of them, not to make an opened clip sit there dead with no poster to show.
    if (ref.type === 'video') {
      return full
        ? `<video class="cat-thumb" src="${escape(ref.url)}" muted loop autoplay playsinline preload="metadata"></video>`
        : motionVideoThumb(ref.url, 'cat-thumb');
    }
    // Audio. In the details modal (full) it gets a real <audio controls> player to preview;
    // on a grid tile it draws its own MEASURED waveform (mountAudioThumbs swaps the glyph
    // for one once peaks exist - a glyph, never an invented shape, until then). The grid
    // tile nests the thumb inside a <button>, where an interactive <audio> control is
    // invalid - so the player is the `full` path only (the modal preview isn't a button).
    // Both use `tag` (span inside a button, div in the modal).
    if (ref.type === 'audio') {
      if (full) {
        // zzfxm songs and tracker modules are song data, not a playable audio file - 
        // mark them so openDetails renders them to a WAV blob (plays in ANY browser, no
        // codec dependency). Encoded audio plays directly; an onerror surfaces an
        // unsupported-format note instead of failing quietly.
        const zz = ref.format === 'zzfxm';
        const mod = isModuleFormat(ref.format);
        const srcAttr = zz ? `data-zzfxm-url="${escape(ref.url)}"`
          : mod ? `data-mod-url="${escape(ref.url)}"`
          : `src="${escape(ref.url)}"`;
        // A big live level meter above the controls (same bar look + theming as the
        // Neurospicy player's - lib/audio-meter.ts draws both). Wired in openDetails.
        // The audio surface ESCALATES rather than switching modes: the bars analyser is
        // what you get for free, a visualiser is one click up, and immersive is one more - 
        // the same ladder the Neurospicy player uses (inline → panel → fullscreen). The
        // cover commit lives at the top of it because "keep what I'm looking at" is the
        // whole interaction; there is no separate picker to learn.
        // The MEDIA fills the stage; every control lives in the one shared bar. The
        // visualiser and the meter occupy the same box (one hidden at a time), so
        // escalating never changes the pane's height.
        return `<${tag} class="cat-thumb cat-thumb-audio cat-stage" data-audio-stage>`
          + `<canvas class="cat-audio-meter" data-audio-meter width="640" height="160" role="button" tabindex="0" aria-label="${escape(t('Switch visualisation'))}"></canvas>`
          + `<div class="cat-audio-viz" data-audio-viz hidden></div>`
          + `<div class="cat-stage-bar">`
            // The element is the PLAYBACK ENGINE, not the UI: the meter and the visualiser
            // both tap it, and an element yields only one MediaElementSource ever, so it
            // stays exactly where it is. Only its native chrome goes - see lib/audio-transport.
            + `<audio ${srcAttr} preload="metadata" data-audio-preview></audio>`
            + audioTransportHtml({
              play: t('Play'), pause: t('Pause'), seek: t('Seek'),
              mute: t('Mute'), unmute: t('Unmute'), volume: t('Volume'),
            })
            // The look controls only exist once you have escalated - before that the bar
            // is just a player, which is all an asset you are auditioning needs.
            // Two dials, deliberately separate: PRESET (the form) and COLOUR (the paint).
            // Shuffling one must not disturb the other - that is the difference between
            // adjusting a look and losing it.
            + `<span class="cat-viz-group" data-audio-vizbar hidden>`
              + `<button type="button" class="cat-viz-btn" data-viz-prev title="${escape(t('Previous preset'))}" aria-label="${escape(t('Previous preset'))}">‹</button>`
              + `<span class="cat-viz-name" data-viz-name></span>`
              + `<button type="button" class="cat-viz-btn" data-viz-next title="${escape(t('Next preset'))}" aria-label="${escape(t('Next preset'))}">›</button>`
              + `<button type="button" class="cat-viz-btn" data-viz-shuffle title="${escape(t('Shuffle preset'))}" aria-label="${escape(t('Shuffle preset'))}">🎲</button>`
              + `<button type="button" class="cat-viz-btn" data-viz-colour-shuffle title="${escape(t('Shuffle brand colour'))}" aria-label="${escape(t('Shuffle brand colour'))}">🎨</button>`
              + `<button type="button" class="cat-viz-btn" data-viz-immerse title="${escape(t('Immersive'))}" aria-label="${escape(t('Immersive'))}">⛶</button>`
              + `<button type="button" class="cat-viz-btn is-primary" data-viz-cover>${escape(t('Use as cover'))}</button>`
            + `</span>`
            + `<button type="button" class="cat-viz-hint" data-viz-toggle aria-pressed="false">${escape(t('Visualiser'))}</button>`
          + `</div>`
          + `<p class="cat-audio-note" role="status" hidden></p></${tag}>`;
      }
      // .cat-thumb-motion is the "an inline SVG fills this box" rule (`> svg` at 100%),
      // written for the Lottie player and doing the identical job here.
      return `<${tag} class="cat-thumb cat-thumb-motion cat-thumb-audio" data-audio-thumb="${escape(ref.id)}" data-audio-fp="${escape(peaksFingerprint(ref))}">`
        + audioThumbPlaceholder({ label: String(ref.meta?.name ?? ref.id) })
        + `</${tag}>`;
    }
    // A text asset (.txt/.md, plans/125): the bytes ARE the text, so an <img src=text>
    // is a broken image. The modal (full) shows a real reading preview filled after mount
    // from the asset url (the fetch is async; this markup is built sync). A grid tile shows
    // a calm document stub. A tabular data asset gets its own stub glyph.
    if (ref.type === 'text' || ref.type === 'data') {
      if (full && ref.type === 'text') {
        // The reading surface: raw monospace <pre> (textContent-filled) plus a
        // rendered-markdown sibling the toggle swaps in, and a small tools pill
        // (font zoom for both modes; the render toggle unhides for md-shaped
        // text once the fetch lands). Rendered HTML is DOMPurify-sanitised.
        return `<${tag} class="cat-thumb cat-thumb-text"><pre class="cat-text-preview" data-text-src="${escape(ref.url)}">${escape(t('Loading…'))}</pre>`
          + `<div class="cat-md-rendered" data-md-rendered hidden></div>`
          + `<span class="cat-text-tools">`
          + `<button type="button" data-act="text-zoom-out" title="${escape(t('Smaller text'))}" aria-label="${escape(t('Smaller text'))}">${icon('zoomOut', { size: 14 })}</button>`
          + `<button type="button" data-act="text-zoom-in" title="${escape(t('Larger text'))}" aria-label="${escape(t('Larger text'))}">${icon('zoomIn', { size: 14 })}</button>`
          + `<button type="button" data-act="text-render" hidden aria-pressed="false" title="${escape(t('Rendered or monospace'))}" aria-label="${escape(t('Rendered or monospace'))}">${icon('document', { size: 14 })}</button>`
          + `</span></${tag}>`;
      }
      // A text tile starts as the calm ¶ glyph and is upgraded post-mount by
      // lib/text-thumbs.ts (mountTextThumbGrid): a brand-inked excerpt sized by
      // document length, focused on the hottest AI-signal region with its heat
      // marks, and a faint corner score donut - the audio-waveform treatment,
      // for text. Data assets keep the ▦ stub (their bytes are not prose).
      if (ref.type === 'text') {
        return `<${tag} class="cat-thumb cat-thumb-stub cat-thumb-ttxt" data-text-thumb="${escape(ref.id)}" aria-hidden="true">¶</${tag}>`;
      }
      // A stored PDF (an auto-saved render keeps its credentialed bytes verbatim,
      // so it is typed 'data') starts as the ▦ stub and is upgraded
      // post-mount to a first-page vector preview by lib/pdf-thumbs.ts
      // (mountPdfThumbGrid) - the audio/text-thumb treatment, for documents.
      const fmt = String(ref.meta?.format ?? '').toLowerCase();
      if (fmt.startsWith('pdf') || /\.pdf$/i.test(String(ref.meta?.name ?? ''))) {
        return `<${tag} class="cat-thumb cat-thumb-stub" data-pdf-thumb="${escape(ref.id)}" aria-hidden="true">▦</${tag}>`;
      }
      return `<${tag} class="cat-thumb cat-thumb-stub" aria-hidden="true">▦</${tag}>`;
    }
    // A 3-D model (GLB) or a LUT (.cube colour grade): the tile can't render the mesh
    // or run the grade live, so it shows a rendered still poster (a companion PNG that
    // query() surfaces on meta.posterUrl), exactly as a lottie/video tiles from its
    // poster - a LUT's poster is the grade applied to a reference chart. Same still in
    // the details modal.
    if (ref.type === 'model' || ref.type === 'lut') {
      const poster = typeof ref.meta?.posterUrl === 'string' ? ref.meta.posterUrl : '';
      return poster
        ? `<img class="cat-thumb" src="${escape(poster)}" alt="" loading="lazy" decoding="async">`
        : `<${tag} class="cat-thumb cat-thumb-stub" aria-hidden="true">◈</${tag}>`;
    }
    // Grid tiles show the small `thumb` derivative (query() puts its url on meta.thumbUrl);
    // the details/zoom modal passes full=true to keep the original for close inspection.
    const src = !full && typeof ref.meta?.thumbUrl === 'string' && ref.meta.thumbUrl ? ref.meta.thumbUrl : ref.url;
    return `<img class="cat-thumb" src="${escape(src)}" alt="" loading="lazy" decoding="async">`;
  }

  // The catalog's compact render of a text AI-likelihood report (plans/125), the
  // counterpart to the verify view's panel. A SIGNAL, never a verdict: hedged heading,
  // "not proof" summary. Reads fine unstyled (headings + a list), so it needs no new CSS.
  function catTextSignalsHtml(panel: TextSignalPanel): string {
    const heading: Record<TextSignalPanel['band'], string> = {
      none: t('No signals that this text was AI-generated'),
      weak: t('A few weak signals that this text may be AI-generated'),
      notable: t('Signals that this text may be AI-generated'),
      strong: t('Strong signals that this text may be AI-generated'),
    };
    const title: Record<string, string> = {
      'model-fingerprint': t('Model fingerprint'),
      'invisible-char': t('Invisible characters'),
      'tag-chars': t('Hidden tag characters'),
      'variation-selectors': t('Unusual variation selectors'),
      'bidi-override': t('Bidirectional override characters'),
      'mixed-script': t('Mixed-script words'),
      'anomalous-space': t('Unusual spacing'),
      'ai-vocabulary': t('AI-favoured vocabulary'),
      'ai-phrasing': t('AI stock phrasing'),
      'ai-structure': t('AI sentence structure'),
      'claude-tell': t('Claude-associated phrasing'),
      'smart-punctuation': t('Curly quotes / smart punctuation'),
      'em-dash-density': t('Heavy em-dash use'),
      'list-heavy': t('List-heavy structure'),
      'uniform-burstiness': t('Unusually uniform sentences'),
      'chatbot-leftover': t('Chatbot boilerplate'),
      'template-placeholder': t('Unfilled template placeholders'),
      'uniform-paragraphs': t('Unusually uniform paragraphs'),
      'ai-span': t('Concentrated AI-like section'),
      'family-tell': t('Model-associated phrasing'),
      'spelling-variant-mix': t('Mixed US/British spelling'),
      'model-estimate': t('On-device model estimate'),
    };
    const rows = panel.rows.map((r) => `<li><strong>${escape(title[r.kind] ?? r.kind)}</strong>${r.detail ? ` - ${escape(r.detail)}` : ''}</li>`).join('');
    // The heat-bar minimap, start of the text to its end - the same rolling windows
    // the verify view paints. `cell.heat` is a plain 0-1 number the engine already
    // rounded, and it is the ONLY thing interpolated into the style attribute, as a
    // custom property the stylesheet turns into a colour.
    const heatbar = panel.heatmap && panel.heatmap.cells.length >= 4
      ? `<div class="cat-tsig-heatbar" role="img" aria-label="${escape(t('Where AI-writing signals concentrate in this text'))}">${panel.heatmap.cells.map((c) => `<i style="--h:${c.heat}"></i>`).join('')}</div>`
      : '';
    const guess = panel.guessFamily
      ? (panel.guessConfidence === 'high'
        ? `<p class="cat-tsig-guess">${tRaw('Identified as <strong>{family}</strong> from a leaked model fingerprint.', { family: escape(panel.guessFamily) })}</p>`
        : `<p class="cat-tsig-guess">${tRaw('Best guess (low confidence): consistent with <strong>{family}</strong> output.', { family: escape(panel.guessFamily) })}</p>`)
      : '';
    // The runners-up behind a LOW-confidence guess keep the winner honest ("leans X
    // over Y", not "is X"). A leaked fingerprint needs no runners-up.
    // Absence of a leaked marker is not a failed check: chat apps strip their own
    // scaffolding on copy, so most AI text carries none. Said out loud (mirrors valid.ts).
    const noMarker = panel.band !== 'none' && !panel.pixelSourced && !panel.rows.some((r) => r.kind === 'model-fingerprint')
      ? `<p class="cat-tsig-cands">${escape(t('No leaked model markers were found in this text. Chat apps usually strip them from copied answers, so their absence proves nothing either way.'))}</p>`
      : '';
    const cands = panel.guessConfidence === 'low' && (panel.guessCandidates?.length ?? 0) >= 2
      ? `<p class="cat-tsig-cands">${escape(t('Style comparison across families:'))} ${escape(panel.guessCandidates!.map((c) => `${c.family} ${c.strength}`).join(' · '))}</p>`
      : '';
    // The score donut: a centred hero gauge with the rating INSIDE the ring.
    // Colour follows the BAND (a state, not a series); the number wears text
    // tokens, so colour is never the only carrier. Numeric-only SVG.
    const gn = Math.max(0, Math.min(100, Math.round(panel.score)));
    const gc = 2 * Math.PI * 26;
    const gOn = (gn / 100) * gc;
    const gauge = `<div class="cat-tsig-gauge-wrap"><svg class="cat-tsig-gauge" viewBox="0 0 64 64" role="img" aria-label="${escape(tRaw('Signal score {n} of 100', { n: gn }))}" data-band="${escape(panel.band)}">`
      + '<circle class="cat-tsig-gauge-track" cx="32" cy="32" r="26"/>'
      + `<circle class="cat-tsig-gauge-fill" cx="32" cy="32" r="26" stroke-dasharray="${gOn.toFixed(2)} ${gc.toFixed(2)}"/>`
      + `<text class="cat-tsig-gauge-num" x="32" y="34">${gn}</text>`
      + '<text class="cat-tsig-gauge-den" x="32" y="45">/100</text>'
      + '</svg></div>';
    // The reword-watermark slot (lib/wm-note.ts): filled after render ONLY on
    // a detection - the one signal here that names its source with confidence.
    const wm = panel.text != null ? wmNoteSlot(panel.text, 'cat-tsig-guess cat-tsig-wm') : '';
    // The model-tier slot (views/tsig-model-note.ts): consent line / estimate /
    // honesty copy; a conclusive estimate re-renders this panel via the callback.
    const modelSlot = aiModelSlot(panel, 'cat-tsig-note', (p) => catTextSignalsHtml(p));
    return `<div class="cat-tsig" data-band="${escape(panel.band)}" role="note" data-tsig-root>
      <p class="cat-tsig-head">${icon('aiSpark', { size: 14 })} <strong>${escape(heading[panel.band])}</strong></p>
      ${wm}
      ${gauge}
      ${heatbar}
      ${rows ? `<ul class="cat-tsig-list">${rows}</ul>` : ''}
      ${guess}
      ${cands}
      ${noMarker}
      ${modelSlot}
      ${panel.facts ? tsigFactsHtml(panel.facts) : ''}
      <p class="cat-tsig-note${panel.band === 'strong' ? ' guide-warn' : panel.band === 'notable' ? ' guide-hint' : ''}">${escape(panel.summary)}</p>
    </div>`;
  }

  /** Extracted text with its flagged spans wrapped in confidence-graded <mark>s.
   *  The tier class keeps the coarse amber/red base; the heat bucket (t1 coolest,
   *  t5 hottest) refines it to the same 5-step temperature the verify view grades. */
  function catHighlightHtml(text: string, marks: TextSignalMark[]): string {
    // Tooltip names the grade so the reader knows what is ignorable - the
    // copy maps buckets exactly as valid.ts's heatGradeWord does.
    const grade = (b: number): string => b >= 4 ? t('a strong tell') : b === 3 ? t('a moderate signal') : t('a weak hint, safe to ignore');
    return buildHighlightSegments(text, marks).map((s) => {
      if (!s.tier) return visibleTextHtml(s.text, 'cat-invis');
      const b = heatBucket(s.heat ?? 0);
      return `<mark class="cat-hl cat-hl--${escape(s.tier)} cat-hl--t${b}" title="${escape(grade(b))}">${visibleTextHtml(s.text, 'cat-invis')}</mark>`;
    }).join('');
  }

  /** The reword machinery's render state (plans/127), owned by the details modal
   *  and rebuilt from the CURRENT cleaned text after every accepted edit. */
  interface RewordUiState {
    /** Deterministic suggestions for the current cleaned text (Tier 1). */
    suggestions: RewordSuggestion[];
    /** Sentences worth offering the model (Tier 2), in document order. */
    spans: RewordSpan[];
    /** Gated model alternatives per span index. Absent = not asked yet;
     *  empty array = asked and nothing survived the gate. */
    alts: ReadonlyMap<number, RewordCandidate[]>;
    /** True once any model candidate was accepted - the save then stamps genAI. */
    modelTouched: boolean;
    /** Model tier standing ('unstaged' hides the section entirely). */
    status: RewordStatus;
    /** One-time model download size, for the consent line. */
    modelBytes: number;
    /** The cleaned text the indices refer to. */
    cleaned: string;
  }

  /** The Humanize result: what the deterministic clean-up changed, the cleaned text with
   *  its remaining (semantic) tells highlighted, deterministic plain-wording suggestions
   *  (accepted per row, still no genAI stamp), the on-device model's reword offers when
   *  staged (accepting one flags the saved copy as AI-assisted - plans/127), and the
   *  honest AI-origins opt-in - a nudge to declare, never an auto-stamp.
   *  `canDeclare` = the asset is a user upload: the declare action writes onto the
   *  record's meta, and built-in catalog content is an immutable checksum-validated
   *  contract, so the button must never render for it (it would be a dead control). */
  function catTextWorkHtml(panel: TextSignalPanel, result: HumanizeResult | null, canDeclare: boolean, rw: RewordUiState, edited: boolean, truncated: boolean): string {
    // What Fix characters changed - only once it has run.
    const fixed = result
      ? `<p class="cat-tsig-head">${icon('wrench', { size: 14 })} <strong>${t('Characters fixed to house style, on-device')}</strong></p>
        ${result.changes.length
          ? `<ul class="cat-tsig-list">${result.changes.map((c) => `<li><strong>${escape(c.label)}</strong> ×${c.count}</li>`).join('')}</ul>`
          : `<p class="cat-tsig-note">${t('Nothing to fix. The characters in this text already match house style.')}</p>`}`
      : '';
    // The edits live INLINE now: the sidebar narrates what is marked in the
    // preview and offers the bulk apply; each decision happens at the text.
    const n = rw.suggestions.length;
    const m = rw.status !== 'unstaged' ? rw.spans.length : 0;
    const guidance = n + m
      ? `<div class="cat-reword-sec">
          <p class="cat-tsig-head"><strong>${t('Suggested edits')}</strong></p>
          <p class="cat-tsig-note">${n ? tRaw('{n} wording swaps are underlined in the preview.', { n }) : ''}
            ${m ? tRaw('{n} sentences have a dotted underline: the on-device model can offer a plainer version. Accepting one flags the saved copy as AI-assisted, and model wording carries Lolly\'s public reword watermark so AI-written text stays detectable on Verify.', { n: m }) : ''}
            ${t('Click a highlight to decide each one.')}</p>
          ${rw.status === 'need-download' && m ? `<p class="cat-tsig-note">${escape(tRaw('First use downloads the rewriter once (~{mb} MB); it works offline after that.', { mb: Math.round(rw.modelBytes / (1024 * 1024)) }))}</p>` : ''}
          ${n > 1 ? `<button type="button" class="btn cat-reword-apply-all" data-act="reword-suggest-all">${escape(tRaw('Apply all {n} swaps', { n }))}</button>` : ''}
          ${truncated ? `<p class="cat-tsig-note">${t('The preview shows the first part of a long document; Apply all still covers the whole text.')}</p>` : ''}
        </div>`
      : `<p class="cat-tsig-note">${t('No wording edits to offer for this text.')}</p>`;
    // Save/copy only once the working copy differs from the file - before that
    // they would duplicate Copy text and save an identical asset.
    const saveLabel = rw.modelTouched ? t('Add to catalog (flagged as AI-assisted)') : t('Add to catalog');
    const actions = edited
      ? `<div class="cat-humanize-actions"><button type="button" class="btn cat-act-copy-clean" data-act="copy-clean">${icon('duplicate', { size: 14 })}<span>${t('Copy edited text')}</span></button><button type="button" class="btn cat-act-save-clean" data-act="save-clean">${icon('filePlus', { size: 14 })}<span>${saveLabel}</span></button></div>`
      : '';
    // Offer the honest declaration only when signals remain - so it reads as encouragement
    // to do the right thing, not a prompt on obviously-human text - and only where the
    // declaration can actually land (a user upload, per `canDeclare` above).
    const declare = canDeclare && panel.band !== 'none'
      ? `<p class="cat-tsig-note">${t('If this text did come from AI, you can flag its AI origins on the asset so that travels honestly wherever it is used.')} <button type="button" class="btn cat-act-declare-ai" data-act="declare-ai-origins">${t('Flag AI origins')}</button></p>`
      : '';
    return `${catTextSignalsHtml(panel)}<div class="cat-tsig" role="note">
      ${fixed}
      ${guidance}
      ${actions}
      ${declare}
    </div>`;
  }

  /** Decode a raster asset URL to the RGBA frame host.ocr.run expects. */
  async function rasterToOcrFrame(url: string): Promise<{ width: number; height: number; data: Uint8ClampedArray }> {
    const bmp = await createImageBitmap(await (await fetch(url)).blob());
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width; canvas.height = bmp.height;
    const cx = canvas.getContext('2d');
    if (!cx) throw new Error('no 2d context');
    cx.drawImage(bmp, 0, 0);
    const img = cx.getImageData(0, 0, bmp.width, bmp.height);
    const frame = { width: bmp.width, height: bmp.height, data: img.data };
    bmp.close?.();
    return frame;
  }

  // A row of two-colour theme swatches (the icon "colours" picker) - shared by the download
  // dialog, the asset-details modal and the icons-category header, so they all offer the same
  // control. Reuses the download dialog's .cat-dl-theme / .cat-dl-duo chrome; `active` marks
  // the current pairing.
  const iconSwatchRow = (active: string | null): string =>
    `<div class="cat-dl-themes" role="group" aria-label="${escape(t('Icon colours'))}">${iconThemes.map(th =>
      `<button type="button" class="cat-dl-theme${th.id === active ? ' is-active' : ''}" data-theme="${escape(th.id)}" data-sfx="shimmer" data-voice="${escape(th.label ?? th.id)}" aria-pressed="${th.id === active}" title="${escape(th.label ?? th.id)}"><span class="cat-dl-duo" style="background:${escape(th.previewBg ?? '#fff')}"><i style="background:${escape(String(th.c2 ?? '#888'))}"></i><i style="background:${escape(String(th.c1 ?? '#333'))}"></i></span></button>`).join('')}</div>`;

  // The bitmap sibling of iconSwatchRow: a photo-treatment strip for raster groups. Leads
  // with an "Original" (no-treatment) button, then one gradient swatch per treatment
  // (greyscale ramp / duotone shadow→highlight). Reuses the .cat-dl-theme chrome; the extra
  // .cat-dl-treat class routes clicks to the treatment handler (not the icon one).
  const treatmentSwatchRow = (active: string | null): string => {
    const swatch = (t: PhotoTreatment): string => {
      if (t.kind === 'greyscale') return 'linear-gradient(135deg,#2b2b2b,#e9e9e9)';
      const stops = [t.shadow ?? '#333', t.mid, t.highlight ?? '#eee'].filter(Boolean).map(c => escape(String(c)));
      return `linear-gradient(135deg,${stops.join(',')})`;
    };
    return `<div class="cat-dl-themes" role="group" aria-label="${escape(t('Photo colour treatment'))}">`
      + `<button type="button" class="cat-dl-theme cat-dl-treat${!active ? ' is-active' : ''}" data-treatment="" data-voice="${escape(t('Original'))}" aria-pressed="${!active}" title="${escape(t('Original - no treatment'))}" style="width:auto;padding:0 9px;font-size:11px;font-weight:600">${t('Original')}</button>`
      + photoTreatments.map(tr =>
        `<button type="button" class="cat-dl-theme cat-dl-treat${tr.id === active ? ' is-active' : ''}" data-treatment="${escape(tr.id)}" data-sfx="shimmer" data-voice="${escape(tr.label ?? tr.id)}" aria-pressed="${tr.id === active}" title="${escape(tr.label ?? tr.id)}"><span class="cat-dl-duo" style="background:${swatch(tr)}"></span></button>`).join('')
      + `</div>`;
  };

  // aiSignalsChip moved to lib/genai-pill.ts (shared with the asset picker so
  // the risk shows at the moment an ingredient is chosen).
  /** Inline passport credential results, per id|version - hashing an asset's
   *  bytes is not free, and paging back should be. */
  const PASSPORT_CRED_CACHE = new Map<string, { found: boolean; state: string; trusted: boolean } | null>();

  /** A DOM-built copy of genAiPill (text form) - for in-place updates where a
   *  string would need a new raw-HTML sink. */
  function genAiPillEl(): HTMLElement {
    const pill = document.createElement('span');
    pill.className = 'chip genai-pill';
    pill.title = GENAI_CLAIM;
    const lbl = document.createElement('span');
    lbl.className = 'genai-pill-lbl';
    lbl.textContent = 'Gen AI';
    pill.appendChild(lbl);
    return pill;
  }

  /** Add/remove the declared Gen AI pill on this asset's grid tile in place -
   *  the reflectAiChipInPlace discipline (DOM API only, idempotent). */
  function reflectGenAiInPlace(ref: AssetRef): void {
    const sub = viewEl.querySelector<HTMLElement>(`.cat-tile[data-id="${CSS.escape(ref.id)}"] .cat-tile-sub`);
    if (!sub) return;
    const existing = sub.querySelector<HTMLElement>('.genai-pill');
    if (!assetAiKind(ref)) { existing?.remove(); return; }
    if (existing) return;
    const chip = sub.querySelector('.cat-ai-chip');
    const pill = genAiPillEl();
    if (chip) sub.insertBefore(pill, chip); else sub.appendChild(pill);
  }


  /** Drop the chip into the open modal's title row + this asset's grid tile in
   *  place - the same in-place discipline as reflectFavInGrid (no full re-render).
   *  DOM API only, so no new raw-HTML sink. Idempotent: an existing chip is
   *  updated, never doubled. */
  function reflectAiChipInPlace(ref: AssetRef): void {
    const sig = ref.meta?.aiSignals as AiSignalsNote | undefined;
    if (!sig || sig.v !== LEXICON_VERSION || (sig.band !== 'notable' && sig.band !== 'strong')) return;
    const spots = [
      detailsDialog?.querySelector<HTMLElement>('.cat-details-name') ?? null,
      viewEl.querySelector<HTMLElement>(`.cat-tile[data-id="${CSS.escape(ref.id)}"] .cat-tile-sub`),
    ];
    for (const spot of spots) {
      if (!spot) continue;
      const chip = spot.querySelector<HTMLElement>('.cat-ai-chip') ?? spot.appendChild(document.createElement('span'));
      chip.className = 'cat-ai-chip';
      chip.dataset.band = sig.band;
      chip.title = t('Signals consistent with AI-generated text were found in this asset. A signal, not proof.');
      chip.textContent = t('AI?');
    }
  }

  /**
   * Write an analysis verdict onto a USER upload's meta so the confidence travels
   * with the asset. Built-in catalog content is an immutable checksum-validated
   * contract and is NEVER mutated - this returns without writing for it.
   *
   * The same read-then-`_updateUserAssetMeta` merge the declare-ai-origins action
   * uses: a meta-only write at the storage layer, so every other field (blob,
   * credential, version) rides forward untouched, cached object URLs survive, and
   * neither the quota check nor the version-pin preserver runs - annotating an
   * asset adds no bytes and must never freeze a pinned duplicate. Best-effort on
   * purpose: the panel already rendered, so a failed write must never surface as
   * a failed analysis.
   */
  async function persistAiSignals(ref: AssetRef, panel: TextSignalPanel, source: 'digital' | 'ocr'): Promise<void> {
    if (ref.source !== 'user') return;
    const aiSignals: AiSignalsNote & { at: string } = {
      at: new Date().toISOString(),
      v: LEXICON_VERSION, band: panel.band, score: panel.score, source,
      ...(panel.guessFamily ? {
        family: panel.guessFamily,
        ...(panel.guessConfidence ? { confidence: panel.guessConfidence } : {}),
      } : {}),
    };
    try {
      const recs = await host.assets._exportUserAssets();
      const rec = recs.find((r) => r.id === ref.id);
      if (!rec) return;
      await host.assets._updateUserAssetMeta(ref.id, { ...rec.meta, aiSignals });
      // Reflect on the in-memory ref too, so the chip shows without a reload.
      ref.meta = { ...(ref.meta ?? {}), aiSignals };
      reflectAiChipInPlace(ref);
    } catch { /* best-effort persistence - the on-screen analysis already told the user */ }
  }

  function assetTile(ref: AssetRef): string {
    const base = assetBaseId(ref.id);
    const fav = favSet.has(base);
    const hidden = hiddenSet.has(base);
    const name = String(ref.meta?.name ?? ref.id);
    const fmt = ref.type === 'lottie' ? 'LOTTIE' : (ref.format ? String(ref.format).toUpperCase() : '');
    const isUser = ref.source === 'user';
    const sourceLabel = isUser ? t('Yours') : t('Catalogue');
    // Generative-AI disclosure - authored on a catalog entry OR auto-detected from an
    // upload's C2PA credential. Shows a violet GEN AI pill in the caption; collapses to a
    // sparkle circle on narrow tiles (see catalog.css).
    const aiKind = assetAiKind(ref);
    // EVERY tile carries a selection checkbox (2026-08-09 - people expect a grid to
    // marquee): catalog assets select for bulk favourite/hide; the destructive bulk
    // actions gate on an all-uploads selection instead (catalog assets are a permanent
    // contract). The whole tile body (bar the checkbox) opens the details modal.
    // Favourite moved off the tile (context menu + selection toolbar), matching the
    // gallery cards.
    const sel = selected.has(ref.id);
    return `
      <div class="cat-tile${fav ? ' is-fav' : ''}${hidden ? ' is-hidden-asset' : ''}${sel ? ' is-selected' : ''}" data-id="${escape(ref.id)}" draggable="true">
        <button type="button" class="cat-check" data-select="${escape(ref.id)}" aria-pressed="${sel}" aria-label="${escape(tRaw('Select {name}', { name }))}" title="${escape(t('Select'))}">${CHECK_ICON}</button>
        <button type="button" class="cat-tile-open" data-open="${escape(ref.id)}" aria-label="${escape(tRaw('View {name} details', { name }))}">
          <span class="cat-tile-fig">${thumbHtml(ref, true)}</span>
          <span class="cat-tile-cap">
            <span class="cat-tile-name" title="${escape((() => {
              const added = assetAddedAt(ref);
              return added ? `${name} - ${tRaw('added {date}', { date: new Date(added).toLocaleDateString() })}` : name;
            })())}">${escape(name)}</span>
            <span class="cat-tile-sub"><span class="cat-src cat-src--${isUser ? 'user' : 'lib'}">${sourceLabel}</span>${fmt ? ` · ${escape(fmt)}` : ''}${aiKind ? genAiPill(aiKind) : ''}${aiSignalsChip(ref)}${(() => {
              // Match context (plans/132 WP-C item 4): while searching, say WHY a tile
              // is in the result set when the name alone doesn't show it.
              if (!query) return '';
              const ctx = matchContextRule(ref, query, x => categoryLabel(libCategory(x, overrides)));
              return ctx ? ` <span class="cat-match-chip" title="${escape(t('This is what the search matched'))}">${escape(ctx)}</span>` : '';
            })()}</span>
          </span>
        </button>
      </div>`;
  }

  // The rules below live in ./catalog-filter.ts - pure, DOM-free and unit-tested
  // (catalog-filter.test.ts). This view keeps the mutable state; the module owns
  // the logic. These wrappers just bind the current state to it, so every call
  // site in mountCatalog reads exactly as it did before the extraction.
  const visibleAssets = (): AssetRef[] => visibleAssetsRule(allAssets, hiddenSet, assetBaseId);
  const matchesType = (a: AssetRef): boolean => matchesTypeRule(a, typeFilter);
  // Tracker modules (.xm/.it/.mod) are song data the libopenmpt worker renders to PCM.
  // Where that decoder cannot instantiate there is nothing to play, so the cards go
  // rather than sit there with a note glyph (Andy, 2026-09-03). Optimistic until the
  // probe answers - the healthy path never flickers - and a false answer repaints.
  let modulesPlayable: boolean | null = null;
  const playableHere = (a: AssetRef): boolean => modulesPlayable !== false || !isModuleFormat(a.format);
  void modDecoderAvailable().then((ok) => {
    modulesPlayable = ok;
    if (!ok) rerender();
  });
  // The search index, memoised across keystrokes and dropped whenever the asset
  // set or the category overrides change (see setOverrides and the reload path).
  // Built on FIRST SEARCH, never merely on render - indexing every asset for a
  // user who never types in the box would be pure waste.
  function haystack(): ReadonlyMap<string, string> {
    if (!searchHaystack) {
      searchHaystack = buildSearchHaystack(allAssets, x => categoryLabel(libCategory(x, overrides)));
    }
    return searchHaystack;
  }
  const matchesQuery = (a: AssetRef): boolean =>
    !query || matchesQueryRule(a, query, haystack());
  const favItems = (): AssetRef[] => favItemsRule(visibleAssets(), favSet, assetBaseId);

  // Favourite SWATCHES ride the same favourites set under a `swatch:` prefix (a palette
  // entry has no asset id; its stable key is its label). Prefixed keys never match an
  // asset id, so every asset-only consumer of the set ignores them.
  const swatchFavKey = (label: string): string => `swatch:${label}`;
  const favSwatches = (): PaletteEntry[] => palette.filter(c => favSet.has(swatchFavKey(c.label)));

  // The "Your uploads" section - a standard `.cat-group` that is ALWAYS rendered in the
  // browse view (even with zero uploads): its body leads with a drop area, so adding files
  // to the library is a first-class affordance in the grid itself, not just inside the picker.
  // The "Select all / Deselect all" control lives INSIDE the collapsible body (not the
  // header) so it folds away with the grid when the section is collapsed - a bulk-select
  // toggle over a hidden grid just reads as confusing (and it's dropped entirely at 0 items).
  function uploadsSectionHtml(items: AssetRef[]): string {
    const key = 'your-uploads';
    const isCollapsed = collapsed.has(key) && !query;
    const allSel = items.length > 0 && items.every(a => selected.has(a.id));
    // Your own raster uploads get the same photo-treatment strip the library photo
    // groups do - pick a greyscale/duotone wash and the whole uploads grid recolours
    // in place (retreatGroup keys off tile type, not source, so it just works).
    const treatable = photoTreatments.length > 0 && items.some(a => a.type === 'raster');
    const colourRow = treatable
      ? `<div class="cat-dl-section cat-group-colours"><span class="cat-dl-label">${t('Colour')}</span>${treatmentSwatchRow(catPhotoTreatment)}</div>`
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
        ${items.length ? `<div class="cat-grid">${items.map(assetTile).join('')}</div>` : ''}
      </div>
    </section>`;
  }

  function assetsSectionHtml(): string {
    const hiddenItems = allAssets.filter(a => hiddenSet.has(assetBaseId(a.id)));
    // A delete can empty the active filter's bucket - its toolbar button would vanish
    // (shownFilters below only offers non-empty buckets) while the filter kept hiding
    // every asset with no visible control explaining why. Fall back to All instead.
    if (typeFilter !== 'all' && !allAssets.some(a => matchesTypeRule(a, typeFilter))) typeFilter = 'all';
    // Filter by search first; the count + category buckets both read the matched set.
    const visible = visibleAssets().filter(matchesQuery).filter(matchesType).filter(playableHere);

    // A total sync failure (nothing loaded) reads distinctly from a genuinely empty
    // catalogue - a "couldn't load" message with a Retry that re-runs the load (wired in
    // wire()). Uploads loading while the catalog query failed fall through to the grid.
    if (loadFailed && allAssets.length === 0) {
      return `<div class="cat-empty" role="alert">
        <p>${t("Couldn't load the catalogue. Check your connection, then retry.")}</p>
        <button type="button" class="btn cat-retry" style="margin-top:1rem">${t('Retry')}</button>
      </div>`;
    }

    if (allAssets.length === 0) {
      // A genuinely empty library still leads with the uploads section - its drop area
      // is exactly what a brand-new profile needs first.
      return uploadsSectionHtml([]) + `<p class="cat-empty" role="status">${t("No catalogue assets found. Once the catalogue syncs they'll appear here - or drop your own images in above.")}</p>`;
    }

    // Favourites are presented as a cinematic strip (mounted after render, see
    // mountFavStrip) - a placeholder goes here when the strip is enabled and non-empty.
    // Favourited items still appear in their category group below (the strip is a
    // shortcut, matching the picker's favourites-plus-groups behaviour). Hidden while
    // searching so the results grid is the whole focus.
    const showStrip = favStripOn && !query && (favItems().length > 0 || favSwatches().length > 0);

    // The user's OWN uploads lead the grid (right after the favourites strip): pulled out
    // of the category groups into one "Your uploads" section they manage in one place.
    // Catalog assets keep their category bucketing below.
    const userItems = sortAssets(visible.filter(a => a.source === 'user'), catSort);
    const catalogItems = visible.filter(a => a.source !== 'user');

    // Bucket the catalog assets by (override-aware) category, in LIB_GROUPS order.
    const buckets = new Map<string, AssetRef[]>();
    for (const a of catalogItems) {
      const k = libCategory(a, overrides);
      (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(a);
    }

    const parts: string[] = [];
    // Always present while browsing (the drop area is its point, even at 0 uploads);
    // during a search it only appears when it holds matching tiles, so the results
    // grid stays the whole focus.
    const showUploads = userItems.length > 0 || !query;
    if (showUploads) parts.push(uploadsSectionHtml(userItems));
    for (const g of LIB_GROUPS) {
      const items = buckets.get(g.key) && sortAssets(buckets.get(g.key)!, catSort);
      if (!items?.length) continue;
      // A category of themable icons gets the same colour swatches as the download/details
      // views - pick one and the whole grid recolours (see the .cat-dl-theme handler in wire).
      // A raster/bitmap category (photos, campaign, headshots) instead gets a photo-treatment
      // strip - the bitmap sibling - that washes the whole grid in place. Mutually exclusive.
      const themableGroup = iconThemes.length > 0 && items.some(isThemable);
      const treatableGroup = !themableGroup && photoTreatments.length > 0 && items.some(a => a.type === 'raster');
      const colourRow = themableGroup
        ? `<div class="cat-dl-section cat-group-colours"><span class="cat-dl-label">${t('Colours')}</span>${iconSwatchRow(catIconTheme)}</div>`
        : treatableGroup
          ? `<div class="cat-dl-section cat-group-colours"><span class="cat-dl-label">${t('Colour')}</span>${treatmentSwatchRow(catPhotoTreatment)}</div>`
          : '';
      parts.push(groupSection(g.key, g.label, items.length, colourRow + `<div class="cat-grid">${items.map(assetTile).join('')}</div>`));
    }
    // Hidden assets never match a search (they're not in `visible`); keep them under a
    // dedicated group only in the normal (non-search) view.
    if (showHidden && !query && hiddenItems.length) {
      parts.push(sectionHtml('hidden', 'Hidden', hiddenItems.length, sortAssets(hiddenItems, catSort).map(assetTile).join('')));
    }

    // No asset matched the active filters → a clear empty line instead of a bare toolbar.
    // Guarded on the search AND the type filter, so choosing a filter (e.g. Motion) that
    // matches nothing explains the empty grid rather than showing a bare "0 assets".
    // Keyed off the matched-asset count, not parts.length: the always-there uploads
    // section (drop area) doesn't count as a match.
    if (!visible.length && (query || typeFilter !== 'all')) {
      const typeLabel = typeFilter === 'all' ? '' : t((TYPE_FILTERS.find(f => f.key === typeFilter)?.label ?? '')).toLowerCase();
      const msg = query && typeLabel
        ? t('No {type} assets match “{query}”.', { type: typeLabel, query })
        : query
          ? t('No assets match “{query}”.', { query })
          : t('No {type} assets in the catalogue.', { type: typeLabel });
      // A "clear search" button when a query is active (mirrors projects.ts) - routed to
      // the shell bar's clearSearchBar() via the body's delegated [data-search-clear] handler in wire().
      const clearBtn = query ? ` <button type="button" class="projects-linkbtn" data-search-clear>${t('Clear search')}</button>` : '';
      parts.push(`<p class="cat-empty" role="status">${msg}${clearBtn}</p>`);
    }

    // Label the Collapse/Expand-all toggle for the state it will actually be in: with folds
    // now defaulting to closed, "Expand all" is the honest first-load label. Mirror the set
    // of sections the body will render (asset groups here + Swatches/Fonts from bodyHtml).
    const renderedKeys = [
      ...(showUploads ? ['your-uploads'] : []),
      ...LIB_GROUPS.filter(g => buckets.get(g.key)?.length).map(g => g.key),
      ...(showHidden && hiddenItems.length ? ['hidden'] : []),
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
    const shownFilters = TYPE_FILTERS.filter(f => f.key === 'all' || allAssets.some(a => matchesTypeRule(a, f.key as TypeFilter)));
    const filterSeg = `
      <div class="cat-typefilter" role="group" aria-label="${escape(t('Filter by file type'))}">
        ${shownFilters.map(f => `<button type="button" class="cat-typefilter-opt${typeFilter === f.key ? ' is-on' : ''}" data-typefilter="${f.key}"${f.sfx ? ` data-sfx="${f.sfx}"` : ''} data-voice="${escape(t(f.label))}" aria-pressed="${typeFilter === f.key}" aria-label="${escape(t(f.label))}" title="${escape(t(f.label))}">${f.icon}<span class="cat-btn-label">${t(f.label)}</span></button>`).join('')}
      </div>`;
    const collapseLabel = anyExpanded ? t('Collapse all') : t('Expand all');
    const showHiddenLabel = showHidden ? t('Hide hidden') : t('Show hidden ({n})', { n: hiddenItems.length });
    // Reserve the counter's width for the widest string it can ever show, so switching filters
    // (which only ever shrink the number) never re-widths the centred toolbar pill and shifts the
    // filter buttons. Floor the digit count at 4 - a few thousand assets - so the reservation
    // doesn't track the current total and a low filtered number can't narrow it; size the suffix
    // for the mode (" assets" normally, " assets found" while searching, where the trailing
    // buttons drop but the type pills still centre off this width). +1ch of slack keeps min-width
    // clear of the text so the span is a true fixed width, not sitting on the content boundary.
    const countCh = Math.max(String(visibleAssets().length).length, 4) + (query ? 14 : 8);
    const toolbar = `
      <div class="cat-toolbar">
        ${filterSeg}
        <span class="cat-count" style="min-width:${countCh}ch">${query
          ? (visible.length === 1 ? t('1 asset found') : t('{n} assets found', { n: visible.length }))
          : (visible.length === 1 ? t('1 asset') : t('{n} assets', { n: visible.length }))}</span>
        ${query ? '' : `<button type="button" class="cat-showhidden cat-collapse-all" aria-label="${escape(collapseLabel)}" title="${escape(collapseLabel)}">${anyExpanded ? CAT_ICONS.collapse : CAT_ICONS.expand}<span class="cat-btn-label">${collapseLabel}</span></button>`}
        ${hiddenItems.length && !query ? `<button type="button" class="cat-showhidden${showHidden ? ' is-on' : ''}" aria-pressed="${showHidden}" aria-label="${escape(showHiddenLabel)}" title="${escape(showHiddenLabel)}">${showHidden ? CAT_ICONS.eyeOff : CAT_ICONS.eye}<span class="cat-btn-label">${showHiddenLabel}</span></button>` : ''}
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
  function swatchStripArt(c: PaletteEntry): string {
    const trans = isTransparent(c.hex);
    const fill = trans ? 'hsl(var(--muted-foreground) / .25)' : c.hex;
    return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="6" y="7" width="53" height="53" rx="14" fill="#00000033"/><rect x="5" y="5" width="53" height="53" rx="14" fill="${escape(fill)}"/></svg>`;
  }

  // The detail line under a favourite swatch: hex, RGB, ink (measured CMYK/spot when
  // locked, generic RGB→CMYK otherwise) and OKLCH - the "what do I put in the deck /
  // the CSS / the print job" readout, in one glance.
  function swatchStripBlurb(c: PaletteEntry): string {
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

  // Open on a favourite-swatch tile → reveal the Swatches reference panel below.
  function revealSwatches(): void {
    const sec = viewEl.querySelector<HTMLElement>('.cat-group[data-group="swatches"]');
    if (!sec) return;
    if (sec.classList.contains('is-collapsed')) sec.querySelector<HTMLElement>('[data-cat-toggle]')?.click();
    sec.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  function mountFavStrip(): void {
    featuredHandle?.destroy();
    featuredHandle = null;
    const mount = viewEl.querySelector<HTMLElement>('.cat-fav-strip');
    if (!mount) return;
    const items = favItems();
    const swatchEntries: FeaturedEntry[] = favSwatches().map(c => ({
      id: swatchFavKey(c.label),
      name: c.label,
      icon: swatchStripArt(c),
      href: '#/c',
      featured: { blurb: swatchStripBlurb(c) },
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
      icon: a.type === 'audio' ? audioCardArt(a)
        : (a.type === 'video' || a.type === 'lottie') ? CAT_ICONS.motion
        : (a.type === 'text' || a.type === 'data') ? CAT_ICONS.text
        : undefined,
      formats: a.format ? [a.format] : undefined,
      href: `#/c?asset=${encodeURIComponent(a.id)}`,   // → this view + the details modal
      featured: {},                                     // no tool variants: strip just shows the preview
    }));
    featuredHandle = mountFeaturedRow(mount, [...entries, ...swatchEntries], host, {
      viewMode: favView,
      label: t('Favourites'),
      ariaLabel: t('Favourite assets'),
      // Open the asset's details modal in place. The tiles' hrefs point at this same view
      // (#/c?asset=…), so a route navigation would be swallowed by the router's same-route
      // dedupe (→ "Open does nothing"); opening the modal directly also preserves the grid's
      // scroll/expansion state and lets the same favourite be reopened repeatedly.
      // A swatch tile has no details modal - it reveals the Swatches panel instead.
      onActivate: (id) => {
        if (id.startsWith('swatch:')) { revealSwatches(); return; }
        const ref = assetById.get(id); if (ref) openDetails(ref, catIconTheme, catPhotoTreatment);
      },
    });
  }

  // Reflect a favourites-MEMBERSHIP change (add/remove) in the strip without a full
  // re-render. The featured-row handle has no incremental entry API, so re-mount just the
  // strip (cheap next to rebuilding the whole grid) - creating or dropping its placeholder
  // as the favourites set crosses empty↔non-empty, exactly like the .cat-favstrip-toggle
  // handler. No-op while the strip is off or a search is active (it isn't shown then).
  function refreshFavStrip(): void {
    if (!favStripOn || query) return;
    const assets = viewEl.querySelector<HTMLElement>('.cat-assets');
    if (!assets) return;
    let mount = viewEl.querySelector<HTMLElement>('.cat-fav-strip');
    if (favItems().length || favSwatches().length) {
      if (!mount) {
        mount = document.createElement('div'); mount.className = 'cat-fav-strip';
        assets.insertBefore(mount, assets.firstChild);
      }
      mountFavStrip();
      void warmFavAudioArt();
    } else {
      featuredHandle?.destroy(); featuredHandle = null; mount?.remove();
    }
  }

  // Flip every grid tile sharing this base id to the given favourite state, in place,
  // matching what assetTile() would render. Favourited assets keep their category-bucket
  // tile (the strip is a shortcut, not a bucket move), so this + refreshFavStrip() fully
  // cover a fav toggle.
  function reflectFavInGrid(base: string, on: boolean): void {
    for (const tile of viewEl.querySelectorAll<HTMLElement>('.cat-tile')) {
      const id = tile.dataset.id ?? '';
      if (assetBaseId(id) !== base) continue;
      tile.classList.toggle('is-fav', on);
    }
  }

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
  ];

  function swatchesSectionHtml(): string {
    const { brand, spectrum, ramps } = groupPalette(palette);
    const total = brand.length + spectrum.length + ramps.reduce((n, [, cols]) => n + cols.length, 0);
    const grid = (list: typeof brand) => `<div class="plat-swatch-grid">${list.map(c => swatch(c, { fav: favSet.has(swatchFavKey(c.label)) })).join('')}</div>`;
    const rampBlocks = ramps.map(([fam, cols]) =>
      `<h3 class="cat-panel-subhead">${escape(fam)}</h3>${grid(cols)}`).join('');
    const downloads = `<div class="cat-font-downloads cat-swatch-downloads">${SWATCH_DOWNLOADS.map(d =>
      `<button type="button" class="cat-download" data-swatch-dl="${d.fmt}" data-sfx="whoosh">${DOWNLOAD_ICON}<span>${escape(t(d.label))}</span></button>`).join('')}</div>`;
    const body = `
      ${downloads}
      <p class="cat-panel-desc">${t('The brand palette. Click any chip to copy its hex. A <span class="plat-chip-flag is-static">CMYK</span> or <span class="plat-chip-flag is-static">SPOT</span> flag marks a locked ink value used directly in CMYK PDF exports.')}</p>
      <h3 class="cat-panel-subhead">${t('Brand')}</h3>${grid(brand)}
      ${spectrum.length ? `<h3 class="cat-panel-subhead">${t('Spectrum')}</h3>${grid(spectrum)}` : ''}
      ${rampBlocks}`;
    return groupSection('swatches', 'Swatches', total, body, 'cat-group--ref');
  }

  function fontsSectionHtml(): string {
    if (!catFonts.length) return ''; // a brand with no declared/added fonts shows no section
    const cards = catFonts.map(f => `
      <article class="plat-font cat-font">
        <header class="plat-font-head">
          <span class="plat-font-name" style="font-family:${f.stack}">${escape(f.family)}</span>
          <span class="plat-font-role">${escape(f.role)}</span>
        </header>
        <div class="plat-font-specimen" style="font-family:${f.stack}">
          <div class="plat-font-aa">Aa</div>
          <p class="plat-font-pangram">The quick brown fox jumps over the lazy dog 0123456789</p>
          <div class="plat-font-weights">
            ${WEIGHT_RAMP.map(w => `<span style="font-weight:${w}">${w}</span>`).join('')}
          </div>
        </div>
        <dl class="plat-kv">
          <div><dt>${t('Type')}</dt><dd>${escape(f.typeLine)}</dd></div>
        </dl>
        ${f.downloads.length ? `<div class="cat-font-downloads">
          ${f.downloads.map(d => `<a class="cat-download" href="${d.href}" download>${DOWNLOAD_ICON}<span>${escape(d.label)}</span></a>`).join('')}
        </div>` : ''}
      </article>`).join('');
    // Show the licence line only when a bundled (downloadable) face is present.
    const anyBundled = catFonts.some(f => f.downloads.length);
    const body = `
      <p class="cat-panel-desc">${t('The fonts your brand carries - available to every tool canvas and the app UI. Add more from the brand editor.')}</p>
      <div class="plat-font-grid cat-font-grid">${cards}</div>
      ${anyBundled ? `<p class="cat-panel-foot">${tRaw('Bundled faces licensed under the {link}.', { link: `<a href="${FONT_LICENSE.href}" target="_blank" rel="noopener">${escape(FONT_LICENSE.label)}</a>` })}</p>` : ''}`;
    return groupSection('fonts', 'Fonts', catFonts.length, body);
  }

  // The scrollable content. Swatches + Fonts are reference material, not searchable
  // assets - drop them while a search is active so the results grid stands alone.
  const bodyHtml = (): string =>
    `${assetsSectionHtml()}${(query || typeFilter !== 'all') ? '' : swatchesSectionHtml() + fontsSectionHtml()}`;

  // Floating bulk-action bar for a multi-selection of uploads - markup + sync live in
  // lib/bulk-bar.ts (shared with projects and the gallery); this view supplies its
  // action set. Rendered once per render(); shown/populated by syncBulkBar().
  // Favourite/Hide apply to ANY selection; Duplicate/Download/Delete only light up
  // when the whole selection is the user's own uploads (catalog assets are a
  // permanent contract - favourite and hide are the only honest bulk verbs there).
  const bulkBarCfg: BulkBarConfig = {
    prefix: 'cat-bulkbar',
    rootSelector: '.catalog',
    count: () => selected.size,
    actions: [
      { id: 'fav', icon: STAR_ICON, label: () => (allSelectedFav() ? t('Unfavourite') : t('Favourite')) },
      { id: 'add-to-project', icon: icon('folder'), label: () => t('Add to project'), title: () => t('Reference the selection into a project folder - no copies, the assets stay in the Catalog') },
      { id: 'hide', icon: icon('eye'), label: () => (allSelectedHidden() ? t('Unhide') : t('Hide')) },
      { id: 'replace', icon: REPLACE_ICON, label: () => t('Replace'), title: () => t('Swap in a new file, keeping the same image - every saved session, tool and project that uses it updates to the new one'), hidden: () => !singleSelectedUploadRef() },
      { id: 'rename', icon: PENCIL_ICON, label: () => t('Rename'), title: () => t('Change this upload’s name'), hidden: () => !singleSelectedUploadRef() },
      { id: 'edit-tags', icon: TAG_ICON, label: () => t('Edit tags'), title: () => t('Set one comma-separated tag list on every selected upload'), hidden: () => !allSelectedUploads() },
      { id: 'duplicate', icon: COPY_ICON, label: () => t('Duplicate'), title: () => t('Make a copy of each selected image - the copies are selected, ready to move or edit'), hidden: () => !allSelectedUploads() },
      { id: 'download', icon: DOWNLOAD_ICON, label: () => t('Download'), title: () => t('Download the selection as one zip - Content Credentials checked and preserved'), hidden: () => !allSelectedUploads() },
      { id: 'delete', icon: TRASH_ICON, label: () => t('Delete'), extraClass: 'cat-bulk-danger', hidden: () => !allSelectedUploads() },
    ],
  };
  const bulkBarHtml = (): string => buildBulkBar(bulkBarCfg);

  function render(): void {
    pruneSelection();
    viewEl.innerHTML = `
      <div class="catalog${catLayout === 'list' ? ' cat-layout-list' : ''}${catDensity === 'compact' ? ' cat-density-compact' : ''}">
        ${catalogTopbarHtml()}
        <h1 class="visually-hidden">${t('Catalogue')}</h1>
        <div class="catalog-body">${bodyHtml()}</div>
        ${bulkBarHtml()}
      </div>`;
    wire();
    mountFavStrip();
    syncBulkBar();
    reapplyTreatment();
    mountLottieThumbs();
    mountAudioThumbGrid();
    mountTextThumbGrid();
    mountMotionThumbs();
    mountPdfThumbGrid();
    mountDropzone();
    if (firstPaint) { armViewEnter(viewEl, '.cat-assets, .cat-group--ref'); firstPaint = false; }
  }

  // Search re-render: rebuild ONLY the body so the fixed footer - and the search input's
  // focus + caret - survive between keystrokes. The body's delegated click handler is
  // bound to the persistent .catalog-body element, so it survives too.
  // (Re)mount the on-screen-gated lottie autoplayer over the current grid. Called after every
  // body (re)render; destroys the prior observer first so re-renders don't stack players.
  function mountLottieThumbs(): void {
    lottieThumbs?.destroy();
    const body = viewEl.querySelector<HTMLElement>('.catalog-body');
    lottieThumbs = body ? autoplayLottieThumbs(body, { isCurrent: () => mounted }) : null;
  }

  // (Re)mount the waveform upgrader over the current grid - the audio sibling of
  // mountLottieThumbs, called from the same places. Only tiles the user scrolls to are
  // decoded: SUSE ships 52 audio assets, and analysing all of them because a grid painted
  // would be minutes of decoding nobody asked for.
  function mountAudioThumbGrid(): void {
    audioThumbs?.destroy();
    const body = viewEl.querySelector<HTMLElement>('.catalog-body');
    audioThumbs = body
      ? mountAudioThumbs(body, host, (id) => assetById.get(id), () => mounted)
      : null;
  }

  // The text sibling: upgrade ¶ stubs to brand-inked, signal-focused excerpts
  // (lib/text-thumbs.ts). Same lifecycle as the waveform upgrader, called from
  // the same places; models cache module-side so re-renders repaint instantly.
  // The playback gate every video thumbnail in the grid goes through (lib/preview-media.ts):
  // hover/focus on a mouse, the most-centered tile on touch, nothing at all under reduced
  // motion. Same lifecycle as the upgraders above - a re-render replaced the elements the
  // previous observer was holding.
  function mountMotionThumbs(): void {
    motionThumbs?.destroy();
    const body = viewEl.querySelector<HTMLElement>('.catalog-body');
    motionThumbs = body ? armMotionPreviews(body, { isCurrent: () => mounted }) : null;
  }

  function mountTextThumbGrid(): void {
    textThumbs?.destroy();
    const body = viewEl.querySelector<HTMLElement>('.catalog-body');
    textThumbs = body
      ? mountTextThumbs(body, host, (id) => assetById.get(id), () => mounted)
      : null;
  }

  // The document sibling (plans/140 S6): upgrade a stored PDF's ▦ stub to a
  // first-page vector preview (lib/pdf-thumbs.ts). Same lifecycle again; the
  // PDF interpreter chunk loads only when a PDF tile scrolls on screen.
  function mountPdfThumbGrid(): void {
    pdfThumbs?.destroy();
    const body = viewEl.querySelector<HTMLElement>('.catalog-body');
    pdfThumbs = body
      ? mountPdfThumbs(body, (id) => assetById.get(id), () => mounted)
      : null;
  }

  // The mounted upload dropzone's teardown, if any (lib/upload-dropzone.ts).
  let dropzoneDispose: (() => void) | null = null;
  // (Re)mount the shared upload dropzone into the uploads section's placeholder. Called
  // after every body (re)render - the innerHTML rebuild orphans the previous instance, so
  // tear it down first (a mid-ingest re-mount is safe: the component's single-flight
  // ingest guard is module-level, and an in-flight ingest still delivers its onAdded).
  // Files ingest through the SAME storeUserUpload path as the asset picker (downscale/
  // sanitise/credential-preserve/animated-sniff); onAdded reloads so the new tiles land
  // in "Your uploads".
  function mountDropzone(): void {
    dropzoneDispose?.();
    dropzoneDispose = null;
    const mount = viewEl.querySelector<HTMLElement>('[data-dropzone-mount]');
    if (!mount) return;   // no uploads section this paint (a total sync failure)
    dropzoneDispose = mountUploadDropzone(mount, host as unknown as PickerHost, {
      onAdded: async () => { if (!mounted) return; await reload(); if (mounted) rerender(); },
    });
    // The roomier "this IS the section" layout when there are no uploads yet.
    mount.querySelector('.updz')?.classList.toggle('updz--empty', mount.hasAttribute('data-empty'));
  }

  function renderBody(): void {
    const body = viewEl.querySelector<HTMLElement>('.catalog-body');
    if (!body) { render(); return; }
    pruneSelection();
    body.innerHTML = bodyHtml();
    mountFavStrip();
    syncBulkBar();
    reapplyTreatment();
    mountLottieThumbs();
    mountAudioThumbGrid();
    mountTextThumbGrid();
    mountMotionThumbs();
    mountPdfThumbGrid();
    mountDropzone();
    fillStorageChip();
  }

  // Device-storage chip in the uploads bar (plans/132 WP-K item 2) - the same
  // navigator.storage.estimate() read the /profile meter uses, one quiet line.
  // Async fill after paint; absent API (or a refusal) just leaves it hidden.
  function fillStorageChip(): void {
    const chip = viewEl.querySelector<HTMLElement>('[data-storage-chip]');
    if (!chip || !navigator.storage?.estimate) return;
    void navigator.storage.estimate().then(({ usage = 0, quota = 0 }) => {
      if (!mounted || !quota) return;
      chip.textContent = tRaw('{used} of {total} device storage used', { used: fmtBytes(usage), total: fmtBytes(quota) });
      chip.hidden = false;
    }).catch(() => { /* leave hidden */ });
  }

  // Re-render from state, preserving the document scroll position so an in-page action
  // (star / hide / recategorise) doesn't jump the page to the top.
  function rerender(): void {
    if (!mounted) return;
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
  }

  // ── asset details modal ─────────────────────────────────────────────────────────
  // Opened by clicking a tile OR by a share deep link (/#/c?asset=<id>). Holds the big
  // preview, metadata, and every per-asset action, so a shared link resolves to a real
  // destination (this modal over the catalog), not a bare download.
  // Dispose hook for the audio preview's level meter (attachAudioMeter). openDetails
  // always closeDetails()-es first - including ←/→ paging - so this can't leak.
  /** The details modal's meter handle - its dispose, plus accessors for the AnalyserNode
   *  and context the MilkDrop preview must SHARE (one MediaElementSource per element). */
  let detailsMeterDispose: import('../lib/audio-meter.ts').MeterHandle | null = null;
  /** The themed transport driving the preview's <audio> - disposed with the modal. */
  let detailsTransport: import('../lib/audio-transport.ts').AudioTransport | null = null;
  /** Releases the details modal's live visualiser (its WebGL2 context) + key handler. */
  let vizTeardown: (() => void) | null = null;
  let vizCycleStop: (() => void) | null = null;
  function closeDetails(): void {
    detailsModal?.close(); // cleanup (meter/lottie/wav dispose + nulling the refs) runs in its onClose
  }

  /** Keep the address bar as shareable as the Share button: the open asset
   *  rides `?asset=` (the share link's exact shape) so copy/pasting the URL
   *  bar reopens the same view. replaceState, deliberately: paging must not
   *  stack history entries, and the hash router only reacts to hashchange,
   *  which replaceState never fires. Other catalog params are preserved. */
  function syncAssetUrl(id: string | null): void {
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
  async function checkCredentials(ref: AssetRef): Promise<void> {
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
          if (fresh) assetById.set(ref.id, fresh);
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
  async function maybeHealTtsClip(ref: AssetRef): Promise<void> {
    try {
      const { shouldHealTts, healTtsProvenance } = await import('../lib/tts-provenance.ts');
      const bytes = new Uint8Array(await (await fetch(ref.url)).arrayBuffer());
      if (!shouldHealTts(ref, bytes)) return;
      if (!(await healTtsProvenance(host, ref, bytes))) return;
      const fresh = await host.assets.get(ref.id);
      if (fresh) assetById.set(ref.id, fresh);
    } catch { /* best-effort - checkCredentials heals on click too */ }
  }

  // The canonical shareable link that reopens this modal from the catalog view.
  const assetLink = (ref: AssetRef): string =>
    `${location.origin}${location.pathname}#/c?asset=${encodeURIComponent(ref.id)}`;

  // The previous/next asset for the details modal's lightbox paging - in on-screen grid
  // order, skipping tiles inside a collapsed group so paging matches what's visible.
  function navRefs(ref: AssetRef): { prev: AssetRef | null; next: AssetRef | null } {
    const ids = [...viewEl.querySelectorAll<HTMLElement>('[data-open]')]
      .filter(el => !el.closest('.cat-group.is-collapsed'))
      .map(el => el.dataset.open!)
      .filter(Boolean);
    const i = ids.indexOf(ref.id);
    const at = (k: number): AssetRef | null => {
      const id = k >= 0 && k < ids.length ? ids[k] : undefined;
      return id ? assetById.get(id) ?? null : null;
    };
    return { prev: i > 0 ? at(i - 1) : null, next: i >= 0 ? at(i + 1) : null };
  }

  function openDetails(ref: AssetRef, initialTheme?: string | null, initialTreatment?: string | null): void {
    // Fire-and-forget: heal a pre-embed TTS clip while its details are open
    // (meta.tts is the cheap pre-filter - everything else never fetches).
    if (ref.source === 'user' && ref.type === 'audio' && ref.meta?.tts) void maybeHealTtsClip(ref);
    const nav = navRefs(ref);
    const base = assetBaseId(ref.id);
    const isUser = ref.source === 'user';
    const fav = favSet.has(base);
    const hidden = hiddenSet.has(base);
    const name = String(ref.meta?.name ?? ref.id);
    const tags = (ref.meta?.tags as string[] | undefined) ?? [];
    const aiKind = assetAiKind(ref);
    // Offer the credential checker for every asset whose container the reader can
    // inspect (not just AI-flagged ones), plus any AI-flagged asset so its claim can
    // always be checked. The "Made with Lolly" lockup is revealed lazily below.
    const showVerify = isVerifiableAsset(ref) || !!aiKind;
    // Themable icons get the same colour swatches as the download dialog, right here in the
    // details view - pick a pairing and the preview recolours live; Download + Copy-link then
    // carry the choice. dBaseSvg caches the raw SVG so re-colouring doesn't re-fetch.
    const themable = isThemable(ref) && iconThemes.length > 0;
    // Raster photos get the bitmap sibling: a colour-treatment strip (greyscale/duotone) that
    // washes the preview live and bakes into the download - mirroring the category grid.
    const treatable = ref.type === 'raster' && !ref.meta?._placeholder && photoTreatments.length > 0;
    // Every still/audio/video has a real Download-as pipeline. Original remains the
    // one-click default; conversion controls only appear after opening the dialog.
    const configurable = isVector(ref) || isThemable(ref) || (ref.type === 'raster' && !ref.meta?.animated)
      || ref.type === 'audio' || ref.type === 'video';
    // Honour a theme from a shared link (initialTheme) if it's valid, else the first pairing.
    let dTheme: string | null = themable
      ? ((initialTheme && iconThemes.some(t => t.id === initialTheme) ? initialTheme : iconThemes[0]?.id) ?? null)
      : null;
    // Photo treatment: honour a valid initial (shared link / category selection), else Original.
    let dTreatment: string | null = treatable && initialTreatment && photoTreatments.some(t => t.id === initialTreatment)
      ? initialTreatment
      : null;
    let dBaseSvg: string | null = null;
    // A text asset's decoded content, cached once for both the reading preview and the
    // "Analyse text" action so neither re-fetches (plans/125).
    let dTextContent: string | null = null;
    // The last humanized (cleaned) text, for the Copy-cleaned button (plans/125).
    let dCleanedText: string | null = null;
    // What the MAIN reading preview currently shows: null = the asset's own
    // bytes; set to the working copy once edits exist, so the render-mode fill
    // and the unsaved pill both track the same fact.
    let dPreviewText: string | null = null;
    // The working copy's BASELINE (the analysed slice of the original) - the
    // unsaved pill and the save actions key off `dCleanedText !== dWorkBase`,
    // never off mere analysis having run.
    let dWorkBase: string | null = null;
    // The last analysis of the working copy - the preview painter reads its
    // marks; recomputed by renderTextPanel after every accepted edit.
    let dAnalysis: TextSignalPanel | null = null;
    // The reword panel's working state (plans/127). The mechanical change list
    // survives re-renders; suggestions/spans are recomputed from the CURRENT
    // cleaned text after every accepted edit (indices shift); model alternatives
    // are cleared whenever the text changes; dModelTouched flips once any model
    // candidate is accepted, and the save path then stamps aiGenerated.
    let dHumanizeResult: HumanizeResult | null = null;
    let dSuggestions: RewordSuggestion[] = [];
    let dRewordSpans: RewordSpan[] = [];
    const dRewordAlts = new Map<number, RewordCandidate[]>();
    let dModelTouched = false;
    let dRewordStatus: RewordStatus = 'unstaged';
    let dRewordBytes = 0;

    // ── The floating edit card - one decision at a time, made AT the text ────
    // Clicking an underlined swap or sentence in the preview opens one small
    // card beside it: what changes, and the buttons to decide. Esc or an
    // outside click closes it; accepting an edit re-derives everything.
    let dCard: HTMLElement | null = null;
    const closeEditCard = (): void => { dCard?.remove(); dCard = null; };
    const openEditCard = (anchor: HTMLElement, html: string): HTMLElement => {
      closeEditCard();
      const holder = dlg.querySelector<HTMLElement>('.cat-details-preview') ?? dlg;
      const card = document.createElement('div');
      card.className = 'cat-edit-card';
      card.innerHTML = html;
      holder.appendChild(card);
      const hr = holder.getBoundingClientRect();
      const ar = anchor.getBoundingClientRect();
      card.style.left = `${Math.round(Math.max(8, Math.min(ar.left - hr.left, hr.width - 356)))}px`;
      card.style.top = `${Math.round(Math.max(8, Math.min(ar.bottom - hr.top + 6, hr.height - 48)))}px`;
      dCard = card;
      return card;
    };
    /** One wording swap: before → after, apply or keep. */
    const sugCardHtml = (s: RewordSuggestion, i: number): string => {
      const work = dCleanedText ?? '';
      const shown = s.kind === 'delete' && s.replacement.length === 1
        ? work.slice(s.index, s.index + s.length - 1)
        : work.slice(s.index, s.index + s.length);
      const after = s.kind === 'delete'
        ? `<em>${t('remove')}</em>`
        : `<span class="cat-reword-after">${escape(s.replacement)}</span>`;
      return `<p class="cat-card-line"><s class="cat-reword-before">${escape(shown.trim())}</s> → ${after}</p>
        <p class="cat-tsig-note">${escape(s.label)} · ${t('a word-for-word edit, no model involved')}</p>
        <div class="cat-card-actions">
          <button type="button" class="btn cat-reword-apply" data-act="reword-suggest" data-idx="${i}">${t('Apply')}</button>
          <button type="button" class="btn-link" data-act="edit-card-close">${t('Keep as is')}</button>
        </div>`;
    };
    /** One flagged sentence: the model offer, its progress, its alternatives. */
    const rwCardHtml = (i: number): string => {
      const s = dRewordSpans[i];
      if (!s) return '';
      const sentence = (dCleanedText ?? '').slice(s.index, s.index + s.length);
      const alts = dRewordAlts.get(i);
      const altBlock = alts === undefined ? '' : (alts.length
        ? `<ul class="cat-reword-alts">${alts.map((a, j) =>
          `<li><span class="cat-reword-alt">${escape(a.text)}</span> <button type="button" class="btn cat-reword-use" data-act="reword-use" data-idx="${i}" data-alt="${j}">${t('Use this')}</button></li>`).join('')}</ul>`
        : `<p class="cat-tsig-note">${t('No better wording survived the checks for this sentence. The original stays.')}</p>`);
      const consent = alts === undefined && dRewordStatus === 'need-download'
        ? `<p class="cat-tsig-note">${escape(tRaw('First use downloads the rewriter once (~{mb} MB); it works offline after that.', { mb: Math.round(dRewordBytes / (1024 * 1024)) }))}</p>`
        : '';
      return `<blockquote class="cat-reword-quote">${escape(sentence)}</blockquote>
        ${alts === undefined ? `<p class="cat-tsig-note">${t('A small local model can propose a shorter, plainer version. Only versions that keep every fact are offered; accepting one flags the saved copy as AI-assisted.')}</p>` : ''}
        ${consent}
        <div class="cat-card-progress" data-card-progress hidden>
          <span class="job-bar"><span class="job-bar-fill" data-card-fill></span></span>
          <span class="cat-card-progress-label" data-card-label aria-live="polite"></span>
        </div>
        ${altBlock}
        <div class="cat-card-actions">
          <button type="button" class="btn cat-reword-go" data-act="reword-span" data-idx="${i}">${alts === undefined ? t('Suggest rewrites') : t('Try again')}</button>
          <button type="button" class="btn-link" data-act="edit-card-close">${t('Close')}</button>
        </div>`;
    };

    /** Rebuild the sidebar narration AND the preview from the current working
     *  copy: the signals summary, the fix-characters report, how many inline
     *  edits are marked, and the save actions once the copy differs. The
     *  suggestion/reword DECISIONS happen in the preview itself (the floating
     *  edit card) - this is the one place everything re-derives after each. */
    const renderTextPanel = (): void => {
      const box = dlg.querySelector<HTMLElement>('[data-tsig]');
      if (!box || dCleanedText == null) return;
      closeEditCard();
      const panel = analyzeVerifyText(dCleanedText, 'digital');
      dAnalysis = panel;
      dSuggestions = suggestRewrites(dCleanedText);
      dRewordSpans = rewordableSpans(dCleanedText, analyzeTextSignals(dCleanedText, { source: 'digital' }).findings);
      const edited = dWorkBase != null && dCleanedText !== dWorkBase;
      box.innerHTML = catTextWorkHtml(panel, dHumanizeResult, isUser, {
        suggestions: dSuggestions,
        spans: dRewordSpans,
        alts: dRewordAlts,
        modelTouched: dModelTouched,
        status: dRewordStatus,
        modelBytes: dRewordBytes,
        cleaned: dCleanedText,
      }, edited, dCleanedText.length > 8192);
      box.hidden = false;
      // The preview becomes the working copy: marks + inline edit affordances
      // in place, zoom tools live. The markdown-rendered cache is invalidated
      // so a render-mode toggle re-fills from the edited text.
      dPreviewText = dCleanedText;
      const md = dlg.querySelector<HTMLElement>('[data-md-rendered]');
      if (md) { delete md.dataset.filled; md.replaceChildren(); }
      paintWorkPreview();
      const pill = dlg.querySelector<HTMLElement>('[data-unsaved]');
      if (pill) pill.hidden = !edited;
    };
    let dTextZoom = 1;    // font scale for the text reading surface (both modes)
    // A text asset (.txt/.md): the bytes are the text. Offers Copy text + Analyse text.
    const isTextAsset = ref.type === 'text';
    // A Lottie plays in the details view as a live SVG player (mounted below), not a still - with a
    // play/pause overlay. Both library (json on meta.animationUrl) and user (url IS the json) lotties.
    const lottieJson = ref.type === 'lottie'
      ? (ref.source === 'user' ? ref.url : (typeof ref.meta?.animationUrl === 'string' ? ref.meta.animationUrl : ''))
      : '';
    const isMotionLottie = !!lottieJson;
    // Zoomable when the preview is a real still image OR a Lottie (both inspect crisply under zoom - 
    // a Lottie renders as SVG). A video reads better auto-playing at fit-size, so it opts out; audio
    // is a player, not an image, so it opts out too; a placeholder/dataless-lottie stub has nothing
    // to zoom. attachZoom handles the <svg> player.
    const zoomable = !ref.meta?._placeholder
      && ref.type !== 'audio'
      && ref.type !== 'text' && ref.type !== 'data'
      && ref.type !== 'palette'   // a scrollable swatch card, not a zoom stage
      && !(ref.type === 'lottie' && !isMotionLottie);
    // Crop only makes sense on a static raster/vector - never a live motion preview or a video.
    // model (a 3-D mesh) and lut (a colour grade) tile from a still poster, but the
    // poster is a preview - cropping it would crop the picture, not the asset - so no crop.
    const croppable = zoomable && !isMotionLottie && ref.type !== 'video' && ref.type !== 'model' && ref.type !== 'lut';
    // On-device AI edits for a raster, brought over from the asset picker: Upscale
    // (host.upscale, v1.101) and Remove background (host.matte, v1.103) - same gates the
    // picker uses. Both route through their dialogs, which PRESERVE the source's
    // provenance: an ingested AI image (Gemini, ChatGPT, …) keeps its Content Credential
    // and Gen-AI flag through the edit - recorded as a cut-out/upscale ingredient, never
    // laundered away - which is the whole reason to offer these on a credentialed asset.
    const canUpscale = zoomable && ref.type === 'raster' && host.upscale?.isAvailable() === true;
    // Retouch (plan 124 WP-E): brush-mask content-aware fill. Pure engine math,
    // no model and no capability gate - honest on any device that decodes the
    // image. Static rasters only, like matte.
    const canRetouch = zoomable && ref.type === 'raster' && !ref.meta?.animated && !ref.meta?._placeholder;
    // Grade + Open in Darkroom (2026-08-20): still bitmaps only - a LUT applied
    // here would flatten an animated raster to one frame. Grade is the quick
    // inline look (the video Grade tab's still sibling, views/grade-inline.ts);
    // Darkroom is the deep editor, opened with this image preloaded.
    const canGrade = zoomable && ref.type === 'raster' && !ref.meta?.animated && !ref.meta?._placeholder;
    // No model gate any more (2026-08-20): the matte dialog now offers a colour
    // key alongside the AI model, and the key needs no capability at all - so
    // "Remove background" works on every device, model staged or not.
    const canMatte = zoomable && ref.type === 'raster' && !ref.meta?.animated;
    // Read text OUT of an image (host.ocr, plans/125). Gated on a STAGED model, so it
    // is invisible until one is vendored - honest progressive enhancement.
    const ocrAvail = host.ocr?.isAvailable() === true && (host.ocr?.models().length ?? 0) > 0;
    const canOcr = ref.type === 'raster' && !ref.meta?._placeholder && ocrAvail;
    // PDFs read their text layer (+ per-page OCR of scanned pages when the model
    // is present) and vectors read their own <text> elements - both digital-first,
    // so neither needs the OCR gate to OFFER the read. Any media, best effort.
    const canReadDoc = ref.format === 'pdf' && !ref.meta?._placeholder;
    const canReadVector = ref.type === 'vector' && !ref.meta?._placeholder;
    // "Extract audio" (WP-C): decode a video's sound track on-device and save it as
    // an audio user asset. Video only - it is nonsensical anywhere else - and only
    // where the browser can decode audio at all. A catalog-side extraction is its own
    // derived asset (no 'renders' tag), with the source video carried as an ingredient.
    const canExtractAudio = ref.type === 'video' && !ref.meta?._placeholder
      && typeof (window.AudioContext ?? (window as { webkitAudioContext?: unknown }).webkitAudioContext) !== 'undefined';
    // Streaming on-device VIDEO processing (WP-G): background-remove to a transparent
    // animated WebP/APNG, crop, or upscale - each opens the shared video-job dialog and
    // runs as a WP-F background job. Video only, and only where WebCodecs can decode
    // (mediabunny needs VideoDecoder); crop/upscale also need the video encoder.
    // Matte offers TWO methods in the dialog - the on-device model (if a model is staged)
    // and the deterministic COLOUR KEY (decode only, no model) - so the affordance appears
    // for any decodable video; the dialog offers whichever methods are actually available.
    const videoDecodable = ref.type === 'video' && !ref.meta?._placeholder
      && typeof (window as { VideoDecoder?: unknown }).VideoDecoder !== 'undefined';
    const videoEncodable = typeof (window as { VideoEncoder?: unknown }).VideoEncoder !== 'undefined';
    const canVideoMatte = videoDecodable;
    const canVideoCrop = videoDecodable && videoEncodable;
    const canVideoUpscale = videoDecodable && videoEncodable && host.upscale?.isAvailable() === true;
    // Grade + Trim (plans/130) are the two video edits that need the frame VISIBLE to be
    // answerable, so they are inline modes over this preview rather than dialog forms -
    // the crop/retouch pattern. Both re-encode, so both need the encoder as well as the
    // decoder; the model-free maths (a LUT, grain, a vignette, a time window) needs
    // nothing else, which is why there is no third capability in these gates.
    const canVideoGrade = videoDecodable && videoEncodable;
    const canVideoTrim = videoDecodable && videoEncodable;
    // "Trim margins" (plan 97 section 7.3): the retro-trim of an upload that arrived padded,
    // offering the same before/after card every ingest surface shows. Uploads only - 
    // a catalog asset is an immutable, checksum-validated contract. A still raster or
    // a vector only: an animated raster would come back as a single-frame PNG, which
    // is a different asset, not a trimmed one.
    const trimmable = isUser && !ref.meta?._placeholder && !ref.meta?.animated
      && (ref.type === 'raster' || ref.type === 'vector');
    // "Edit script" (plans/181 section 5.4): a clip Lolly SYNTHESIZED can go back
    // to the words that made it - Script audio prefills the recipe and Save
    // rewrites these very bytes, so every document using the clip hears the fix.
    // The gate is the same cheap meta.tts pre-filter the heal above uses; the
    // studio re-reads the block through ttsRecipeFromMeta and leaves a blank
    // sheet if it does not hold up, so a recording or an upload can never land
    // in an editor that would claim Lolly made it.
    const ttsBlock = (ref.meta as { tts?: { text?: unknown; voice?: unknown } } | undefined)?.tts;
    const canEditScript = isUser && ref.type === 'audio'
      && typeof ttsBlock?.text === 'string' && !!ttsBlock.text.trim()
      && typeof ttsBlock?.voice === 'string' && !!ttsBlock.voice.trim();
    const wasOpen = !!detailsDialog; // paging (←/→) replaces an open modal - cue only a FRESH open
    closeDetails();
    const content = `
      <button type="button" class="cat-details-close" data-act="close" aria-label="${escape(t('Close'))}">×</button>
      <div class="cat-details-preview${zoomable ? ' is-zoomable' : ''}">
        <span class="cat-unsaved-pill" data-unsaved hidden>${t('Edits not saved')}</span>
        ${nav.prev ? `<button type="button" class="cat-details-nav cat-details-prev" data-nav="prev" aria-label="${escape(t('Previous asset'))}">${CHEVRON_LEFT}</button>` : ''}
        ${nav.next ? `<button type="button" class="cat-details-nav cat-details-next" data-nav="next" aria-label="${escape(t('Next asset'))}">${CHEVRON_RIGHT}</button>` : ''}
        ${zoomable
          ? `<div class="cat-zoom-stage">${thumbHtml(ref, false, true)}</div>
             <div class="cat-stage-bar">
               ${isMotionLottie ? `<button type="button" class="cat-motion-toggle is-playing" data-act="motion-toggle" aria-label="${escape(t('Pause'))}" title="${escape(t('Pause'))}">${PAUSE_ICON}</button>` : ''}
               <div class="cat-zoom-hud"></div>
             </div>`
          : thumbHtml(ref, false, true)}
      </div>
      <div class="cat-details-body">
        <!-- Toolbar FIRST: the meta/tech/credential sections below are variable
             length, so the actions live at a fixed spot at the top of the column
             instead of drifting down with the content (Andy, 2026-08-20). -->
        ${(() => {
          // Grouped toolbar (plans/132 WP-J): four rows - pinned verbs, the EDIT
          // family, manage, destructive last - instead of ~16 flat buttons. The
          // edit row collapses behind an "Edit…" expander under 860px (the
          // toggle-edit act below); every button and gate is unchanged.
          const pinned = [
            // A 3-D model opens in the 3D tool; a LUT opens in the Darkroom - the
            // primary "edit" verb for these types (they have no in-place crop/grade).
            ref.type === 'model' ? `<button type="button" class="btn cat-act-open-3d" data-act="open-3d">${icon('box', { size: 14 })}<span>${t('Open in 3D')}</span></button>` : '',
            ref.type === 'lut' ? `<button type="button" class="btn cat-act-open-lut" data-act="open-lut">${icon('camera', { size: 14 })}<span>${t('Open in Darkroom')}</span></button>` : '',
            `<button type="button" class="btn cat-act-fav${fav ? ' is-fav' : ''}" data-act="fav" data-sfx="twinkle" aria-pressed="${fav}">${STAR_ICON}<span>${fav ? t('Favourited') : t('Favourite')}</span></button>`,
            `<button type="button" class="btn cat-act-download" data-act="download">${DOWNLOAD_ICON}<span>${configurable ? t('Download…') : t('Download')}</span></button>`,
            isTextAsset ? `<button type="button" class="btn cat-act-dl-as" data-act="dl-as" aria-haspopup="menu" aria-expanded="false">${DOWNLOAD_ICON}<span>${t('Download as')}</span></button>` : '',
            `<button type="button" class="btn cat-act-send" data-act="send">${icon('upload', { size: 14 })}<span>${t('Send to…')}</span></button>`,
            `<button type="button" class="btn cat-act-share" data-act="share">${SHARE_ICON}<span>${t('Copy link')}</span></button>`,
          ];
          const edit = [
            croppable ? `<button type="button" class="btn cat-act-crop" data-act="crop">${CROP_ICON}<span>${t('Crop…')}</span></button>` : '',
            canRetouch ? `<button type="button" class="btn cat-act-retouch" data-act="retouch">${icon('stamp', { size: 14 })}<span>${t('Retouch…')}</span></button>` : '',
            canGrade ? `<button type="button" class="btn cat-act-grade" data-act="grade">${icon('palette', { size: 14 })}<span>${t('Grade…')}</span></button>` : '',
            canGrade ? `<button type="button" class="btn cat-act-darkroom" data-act="darkroom">${icon('camera', { size: 14 })}<span>${t('Open in Darkroom')}</span></button>` : '',
            canUpscale ? `<button type="button" class="btn cat-act-upscale" data-act="upscale">${icon('aiSpark', { size: 14 })}<span>${t('Upscale…')}</span></button>` : '',
            canMatte ? `<button type="button" class="btn cat-act-matte" data-act="matte">${icon('scissors', { size: 14 })}<span>${t('Remove background…')}</span></button>` : '',
            trimmable ? `<button type="button" class="btn cat-act-trim" data-act="trim">${icon('fitContain', { size: 14 })}<span>${t('Trim margins')}</span></button>` : '',
            canOcr || canReadDoc || canReadVector ? `<button type="button" class="btn cat-act-read-text" data-act="read-text">${icon('aiSpark', { size: 14 })}<span>${t('Read text')}</span></button>` : '',
            canExtractAudio ? `<button type="button" class="btn cat-act-extract-audio" data-act="extract-audio">${icon('music', { size: 14 })}<span>${t('Extract audio…')}</span></button>` : '',
            canEditScript ? `<button type="button" class="btn cat-act-edit-script" data-act="edit-script">${icon('mic', { size: 14 })}<span>${t('Edit script')}</span></button>` : '',
            canVideoMatte ? `<button type="button" class="btn cat-act-vid-matte" data-act="vid-matte">${icon('scissors', { size: 14 })}<span>${t('Remove background…')}</span></button>` : '',
            canVideoCrop ? `<button type="button" class="btn cat-act-vid-crop" data-act="vid-crop">${CROP_ICON}<span>${t('Crop…')}</span></button>` : '',
            canVideoUpscale ? `<button type="button" class="btn cat-act-vid-upscale" data-act="vid-upscale">${icon('aiSpark', { size: 14 })}<span>${t('Upscale…')}</span></button>` : '',
            canVideoGrade ? `<button type="button" class="btn cat-act-vid-grade" data-act="vid-grade">${icon('palette', { size: 14 })}<span>${t('Grade…')}</span></button>` : '',
            canVideoTrim ? `<button type="button" class="btn cat-act-vid-trim" data-act="vid-trim">${icon('filmStrip', { size: 14 })}<span>${t('Trim…')}</span></button>` : '',
            isTextAsset ? `<button type="button" class="btn cat-act-analyse-text" data-act="analyse-text">${icon('aiSpark', { size: 14 })}<span>${t('Analyse text')}</span></button>
            <button type="button" class="btn cat-act-humanize" data-act="humanize">${icon('wrench', { size: 14 })}<span>${t('Fix characters')}</span></button>
            <button type="button" class="btn cat-act-copy-text" data-act="copy-text">${icon('duplicate', { size: 14 })}<span>${t('Copy text')}</span></button>` : '',
          ];
          const manage = [
            `<button type="button" class="btn" data-act="add-to-project">${icon('folder', { size: 14 })}<span>${t('Add to project…')}</span></button>`,
            `<button type="button" class="btn" data-act="recategorise">${TAG_ICON}<span>${t('Recategorise…')}</span></button>`,
            isUser ? `<button type="button" class="btn" data-act="rename">${PENCIL_ICON}<span>${t('Rename')}</span></button>
               <button type="button" class="btn" data-act="replace">${REPLACE_ICON}<span>${t('Replace…')}</span></button>` : '',
          ];
          const danger = [
            isUser
              ? `<button type="button" class="btn cat-act-danger" data-act="delete">${TRASH_ICON}<span>${t('Delete')}</span></button>`
              : (hidden
                  ? `<button type="button" class="btn" data-act="unhide">${EYE_ICON}<span>${t('Unhide')}</span></button>`
                  : `<button type="button" class="btn cat-act-danger" data-act="hide">${EYE_OFF_ICON}<span>${t('Hide')}</span></button>`),
          ];
          const row = (btns: string[], cls = ''): string => {
            const inner = btns.filter(Boolean).join('');
            return inner ? `<span class="cat-act-row${cls ? ` ${cls}` : ''}">${inner}</span>` : '';
          };
          const editRow = row(edit, 'cat-act-row--edit');
          const editToggle = editRow
            ? `<button type="button" class="btn cat-act-more" data-act="toggle-edit" aria-expanded="false">${PENCIL_ICON}<span>${t('Edit…')}</span></button>`
            : '';
          return `<div class="cat-details-actions">
            ${row(pinned)}${editToggle}${editRow}${row(manage)}${row(danger, 'cat-act-row--danger')}
          </div>`;
        })()}
        <div class="cat-passport" data-passport></div>
        <h2 class="cat-details-name">${escape(name)}${aiSignalsChip(ref)}</h2>
        ${ref.type === 'audio' ? `<div class="cat-details-art" data-audio-art aria-hidden="true">${audioCardArt(ref)}</div>` : ''}
        <dl class="cat-details-meta">
          <div><dt>${t('Source')}</dt><dd>${isUser ? t('Your upload') : t('SUSE catalog')}</dd></div>
          <div><dt>${t('Category')}</dt><dd>${escape(t(categoryLabel(libCategory(ref, overrides))))}</dd></div>
          <div><dt>${t('Format')}</dt><dd>${escape(String(ref.format ?? ref.type).toUpperCase())}</dd></div>
          ${(() => {
            // Licence + credit for a catalog asset that carries them (e.g. the SUSE7
            // LUT, CC BY 4.0, © SUSE / Peter Chamalian). The SPDX id prettifies
            // in place (cc-by-4.0 → CC BY 4.0); the credit is the required attribution.
            const lic = (ref.meta as { license?: string } | undefined)?.license;
            const cred = (ref.meta as { attribution?: string } | undefined)?.attribution;
            return (lic ? `<div><dt>${t('Licence')}</dt><dd>${escape(String(lic).replace(/-/g, ' ').toUpperCase())}</dd></div>` : '')
              + (cred ? `<div><dt>${t('Credit')}</dt><dd>${escape(String(cred))}</dd></div>` : '');
          })()}
          <div class="cat-details-origins-row"><dt>${t('Origins')}</dt><dd class="cat-details-ai" data-origins></dd></div>
          ${(() => {
            // Added/Modified (plans/132 WP-A): uploads always have a date (the id
            // embeds mint time); a catalog asset shows the date its file was first
            // committed to its brand pack, which the index carries as `added`.
            const added = assetAddedAt(ref);
            const modified = assetModifiedAt(ref);
            const fmtDate = (ts: number): string => new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
            const addedText = added ? fmtDate(added) : catalogAddedText(ref);
            return (addedText ? `<div><dt>${t('Added')}</dt><dd>${escape(addedText)}</dd></div>` : '')
              + (modified && added && modified - added > 60_000 ? `<div><dt>${t('Modified')}</dt><dd>${escape(fmtDate(modified))}</dd></div>` : '');
          })()}
          ${(() => {
            // Which projects reference this asset (plans/132 WP-D) - read straight
            // off the profile's folder records, no extra fetch.
            const profFolders = ((profile as unknown as { folders?: Array<{ name: string; items?: Array<{ ref?: string }> }> })?.folders ?? []);
            const inFolders = profFolders.filter(f => (f.items ?? []).some(it => it.ref === ref.id || String(it.ref ?? '').split('?')[0] === ref.id));
            if (!inFolders.length) return '';
            const names = inFolders.slice(0, 2).map(f => escape(f.name)).join(', ');
            const extra = inFolders.length > 2 ? ` +${inFolders.length - 2}` : '';
            return `<div><dt>${t('Projects')}</dt><dd>${names}${extra}</dd></div>`;
          })()}
          <div><dt>${t('ID')}</dt><dd><code>${escape(ref.id)}</code></dd></div>
          ${tags.length || isUser ? `<div><dt>${t('Tags')}</dt><dd class="cat-details-tags">${tags.map(tag => `<button type="button" class="cat-tag" data-tag="${escape(String(tag))}" title="${escape(t('Show everything with this tag'))}">${escape(String(tag))}</button>`).join('')}${isUser ? `<button type="button" class="cat-tag cat-tag--edit" data-act="edit-tags">${tags.length ? t('Edit…') : t('Add tags…')}</button>` : ''}</dd></div>` : ''}
        </dl>
        <div class="cat-details-tech" data-tech hidden></div>
        <div class="cat-details-tech" data-usage hidden></div>
        ${isTextAsset || canOcr || canReadDoc || canReadVector ? `<div class="cat-details-tsig" data-tsig hidden></div>` : ''}
        ${showVerify ? `<div class="cat-details-cred">
          <div class="cat-cred-lolly" hidden>${lollyBadge('lg')}<span class="cat-cred-lolly-sub">${t('This file’s Content Credential records a Lolly export, intact.')}</span></div>
          <div class="cat-cred-panels" hidden></div>
          <button type="button" class="btn cat-act-verify" data-act="verify">${SHIELD_ICON}<span>${t('Check Content Credentials')}</span></button>
        </div>` : ''}
        ${themable ? `<div class="cat-dl-section"><span class="cat-dl-label">${t('Colours')}</span>${iconSwatchRow(dTheme)}</div>` : ''}
        ${treatable ? `<div class="cat-dl-section"><span class="cat-dl-label">${t('Colour')}</span>${treatmentSwatchRow(dTreatment)}</div>` : ''}
      </div>`;
    // Exits inline trim mode, or null when no card is up. Assigned by enterInlineTrim
    // below; declared here so the modal's onClose can answer an open card (its teardown
    // revokes the two preview object URLs) when the dialog goes away under it.
    let inlineTrim: (() => void) | null = null;
    // The toolbar's "Download as" format menu (text assets) - a body-popover
    // mounted INSIDE this dialog so it paints above the ::backdrop.
    let dlAsPopover: import('../components/body-popover.ts').BodyPopoverHandle | null = null;
    const modal = mountModal(content, {
      className: 'cat-details',
      initialFocus: (el) => el.querySelector<HTMLElement>('.cat-details-close'),
      onClose: () => {
        detailsMeterDispose?.();
        detailsMeterDispose = null;
        detailsTransport?.destroy();
        detailsTransport = null;
        vizTeardown?.();
        vizTeardown = null;
        // Destroy any Lottie player mounted in the preview - lottie-web ticks every mounted player
        // from one global rAF and won't stop on removal alone, so an un-reaped modal player leaks a loop.
        destroyLottiePlayers(modal.el);
        // Free a zzfxm→WAV preview blob (only the one we minted; user-upload URLs are managed).
        const wav = modal.el.querySelector<HTMLAudioElement>('[data-audio-preview]')?.dataset.wavBlob;
        if (wav) URL.revokeObjectURL(wav);
        cropModeActive = false;   // clear the attachZoom pause if the modal closed mid-crop (backdrop/paging)
        inlineTrim?.();           // …and answer an open trim card, so its preview URLs are revoked
        inlineRetouch?.exit();    // …and stand a brush session down (aborts any in-flight fill)
        inlineVideoEdit?.exit();  // …and the video Grade/Trim mode (its own <video> would keep decoding)
        inlineGrade?.exit();      // …and the still grade mode (an enqueued job keeps running - by design)
        dlAsPopover?.close(false); // …and the Download-as menu (it lives inside this dialog's subtree)
        syncAssetUrl(null);       // the bar goes back to the plain catalog URL
        detailsDialog = null;
        detailsModal = null;
      },
    });
    const dlg = modal.el;
    detailsDialog = dlg;
    detailsModal = modal;
    // The address bar mirrors the Share button (`#/c?asset=<id>`) while an
    // asset is open, so copy/pasting the URL shares this exact view. Paging
    // re-syncs it per asset (Andy, 2026-08-19).
    syncAssetUrl(ref.id);
    if (!wasOpen) playSfx('whisper'); // airy elevation as the asset details rise in (silent on ←/→ paging)

    // The Origins row (plans/126 WP-B): the user may know more provenance than
    // the file does. State + (for their own assets) a declare control - the
    // declaration writes aiGenerated, which the export path already carries as
    // a C2PA ingredient, so it follows the asset wherever it is used. DOM-built
    // (reflectAiChipInPlace discipline, no raw-HTML sink); re-run after every
    // origins change.
    const renderOrigins = (): void => {
      const dd = dlg.querySelector<HTMLElement>('[data-origins]');
      if (!dd) return;
      dd.replaceChildren();
      const kind = assetAiKind(ref);
      const declaredByUser = !!(ref.meta as Record<string, unknown> | undefined)?.aiOriginsDeclared;
      const state = document.createElement('span');
      state.className = 'cat-origins-state';
      if (kind) {
        state.appendChild(genAiPillEl());
        state.append(` ${kind === 'full' ? t('AI-generated') : t('AI-assisted')}`);
        if (!declaredByUser) state.append(` · ${isUser ? t('read from the file') : t('recorded by the catalog')}`);
      } else {
        state.textContent = t('Not recorded');
      }
      dd.appendChild(state);
      if (isUser) {
        const ctl = document.createElement('span');
        ctl.className = 'cat-origins-ctl';
        const mk = (label: string, act: string, active: boolean): HTMLButtonElement => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'btn cat-origin-btn';
          b.dataset.act = act;
          b.setAttribute('aria-pressed', String(active));
          b.textContent = label;
          return b;
        };
        ctl.append(
          mk(t('AI-generated'), 'origin-full', kind === 'full' && declaredByUser),
          mk(t('AI-assisted'), 'origin-partial', kind === 'partial' && declaredByUser),
        );
        if (declaredByUser) ctl.append(mk(t('Remove declaration'), 'origin-clear', false));
        dd.appendChild(ctl);
        const note = document.createElement('span');
        note.className = 'cat-origins-note';
        note.textContent = t('Declaring origins travels with the asset wherever it is used - so collaborators can talk about the work, not guess about the file.');
        dd.appendChild(note);
      }
    };
    renderOrigins();

    // ── The provenance passport (plans/136 W2a): one glanceable card - the
    // flat lamp strip over an INLINE credential check of the asset's own
    // bytes, plus the licensing chips. The check is lazy + stale-guarded like
    // the tech panel, and cached per id+version so paging back is free.
    const renderPassport = (cred: 'checking' | { found: boolean; state: string; trusted: boolean } | null): void => {
      const box = dlg.querySelector<HTMLElement>('[data-passport]');
      if (!box) return;
      const kind = assetAiKind(ref);
      const sig = ref.meta?.aiSignals as (AiSignalsNote & { at?: string }) | undefined;
      const sigFresh = sig && sig.v === LEXICON_VERSION ? sig : undefined;
      const maker = ref.meta?.makerLikely as { vendor?: string; hint?: string } | undefined;
      const lamps: TrustLamp[] = [
        cred === 'checking'
          ? { id: 'provenance', label: t('Provenance'), state: 'unlit', word: t('checking…') }
          : cred?.found && cred.state === 'invalid'
            ? { id: 'provenance', label: t('Provenance'), state: 'warn', word: t('credential problem'), detail: t('Open Check credentials for the full report.') }
            : cred?.found && cred.trusted
              ? { id: 'provenance', label: t('Provenance'), state: 'fact', word: t('verified') }
              : cred?.found
                ? { id: 'provenance', label: t('Provenance'), state: 'fact', word: t('credential intact') }
                : { id: 'provenance', label: t('Provenance'), state: 'unlit', word: t('none carried'), detail: t('An unlit lamp means that check has nothing to read here - it is not a verdict.') },
        cred === 'checking' || !cred?.found
          ? { id: 'integrity', label: t('Integrity'), state: 'unlit', word: t('nothing to check against') }
          : cred.state === 'valid'
            ? { id: 'integrity', label: t('Integrity'), state: 'fact', word: t('bytes match') }
            : { id: 'integrity', label: t('Integrity'), state: 'warn', word: t('bytes changed') },
        kind
          ? { id: 'origin', label: t('Origin'), state: 'fact', word: kind === 'full' ? t('AI-generated') : t('AI-assisted') }
          : maker?.vendor
            ? { id: 'origin', label: t('Origin'), state: 'hint', word: t('likely AI-made'), detail: tRaw('This file is packaged the way {vendor} AI products package downloads ({hint}). A signal, not proof.', { vendor: maker.vendor, hint: maker.hint ?? '' }) }
            : { id: 'origin', label: t('Origin'), state: 'unlit', word: t('not declared') },
        sigFresh
          ? (sigFresh.band === 'notable' || sigFresh.band === 'strong'
            ? { id: 'signals', label: t('Content signals'), state: 'hint', word: t('signals found'), ...(sigFresh.at ? { detail: tRaw('Analysed {date}.', { date: new Date(sigFresh.at).toLocaleDateString() }) } : {}) }
            : { id: 'signals', label: t('Content signals'), state: 'fact', word: t('none found'), ...(sigFresh.at ? { detail: tRaw('Analysed {date}.', { date: new Date(sigFresh.at).toLocaleDateString() }) } : {}) })
          : { id: 'signals', label: t('Content signals'), state: 'unlit', word: t('not analysed') },
      ];
      const chips: string[] = [];
      const license = (ref.meta as { license?: string } | undefined)?.license;
      if (license) chips.push(`<span class="chip">${escape(String(license))}</span>`);
      if ((ref.meta as { brandLock?: boolean } | undefined)?.brandLock) chips.push(`<span class="chip">${escape(t('Brand-locked'))}</span>`);
      box.innerHTML = lampStripHtml(lamps, { flat: true }) + (chips.length ? `<div class="cat-passport-chips">${chips.join(' ')}</div>` : '');
      box.hidden = false;
    };
    renderPassport('checking');
    void (async () => {
      const cacheKey = `${ref.id}|${ref.version ?? 'x'}`;
      let cred = PASSPORT_CRED_CACHE.get(cacheKey) ?? null;
      if (cred === null && !PASSPORT_CRED_CACHE.has(cacheKey)) {
        try {
          const bytes = new Uint8Array(await (await fetch(ref.url)).arrayBuffer());
          const r = await verifyC2pa(bytes);
          cred = { found: !!r.found, state: String(r.state), trusted: !!(r as { trusted?: boolean }).trusted };
        } catch { cred = null; }
        PASSPORT_CRED_CACHE.set(cacheKey, cred);
      }
      if (detailsDialog !== dlg) return; // paged away while hashing
      renderPassport(cred);
    })();

    // Technical metadata (resolution, DPI, EXIF, audio/video props, page count, viewBox…):
    // extract off-thread and fill the initially-hidden panel. Cancel/stale-safe - ←/→ paging
    // re-runs openDetails per asset, so a slow result must not overwrite a newer asset's panel.
    void extractAssetMetadata(ref).then(techFields => {
      if (detailsDialog !== dlg) return;          // modal closed or paged to another asset
      if (!techFields.length) return;             // nothing readable - leave the panel hidden
      const box = dlg.querySelector<HTMLElement>('[data-tech]');
      if (!box) return;
      box.innerHTML = `<div class="cat-tech-head">${t('Details')}</div>`
        + `<dl class="cat-details-meta">${techFields
            .map(f => `<div><dt>${escape(f.label)}</dt><dd>${escape(f.value)}</dd></div>`)
            .join('')}</dl>`;
      box.hidden = false;
    }).catch(() => { /* never blocks the modal */ });

    // "Used in" (plans/132 WP-G): which saved sessions reference this asset -
    // async off the lazy per-mount session index, same stale-guard as the tech
    // panel. Makes Replace's "everything that uses it updates" claim inspectable.
    void usedInSessions(ref).then(uses => {
      if (detailsDialog !== dlg || !uses.length) return;
      const box = dlg.querySelector<HTMLElement>('[data-usage]');
      if (!box) return;
      const shown = uses.slice(0, 5);
      const extra = uses.length - shown.length;
      box.innerHTML = `<div class="cat-tech-head">${t('Used in')}</div>`
        + `<dl class="cat-details-meta">${shown
            .map(u => `<div><dt>${escape(t('Session'))}</dt><dd>${escape(u.label)}</dd></div>`)
            .join('')}${extra > 0 ? `<div><dt></dt><dd>${escape(tRaw('and {n} more', { n: extra }))}</dd></div>` : ''}</dl>`;
      box.hidden = false;
    }).catch(() => { /* best-effort - the panel just stays hidden */ });

    // "Made with Lolly" is only honest when the stored file genuinely carries an intact
    // Lolly credential, so reveal the lockup lazily off the authoritative verifier rather
    // than asserting it. Cheap gate first: fetch once, skip anything with no embedded
    // credential (most catalog art, and re-encoded user uploads whose store no longer
    // binds) before the heavier verify. Video/audio are skipped (a whole-file fetch just
    // for a badge isn't worth it - the checker button still covers them). Guarded on the
    // modal still being THIS dialog, since ←/→ paging swaps it out.
    if (showVerify && ref.type !== 'video' && ref.type !== 'audio' && Number(ref.meta?.bytes ?? 0) < 12_000_000) {
      void (async () => {
        try {
          const bytes = new Uint8Array(await (await fetch(ref.url)).arrayBuffer());
          if (!extractC2paStore(bytes)) return;
          const report = await verifyC2pa(bytes);
          if (detailsDialog !== dlg) return;
          if (report.madeWithLolly) {
            const lockup = dlg.querySelector<HTMLElement>('.cat-cred-lolly');
            if (lockup) lockup.hidden = false;
          }
          // Surface the same "Made from" + "Change history" panels the Verify checker
          // shows, inline - reusing its renderers so they never drift. Only when the
          // credential parsed (report.found + a claim); each renderer returns '' when it
          // has nothing, so a bare credential just shows an empty panel set (skipped).
          if (report.found && report.claim) {
            const { stepsHtml, inputsDigestHtml } = await import('./valid.ts');
            if (detailsDialog !== dlg) return;
            const env = report.environment as { inputs?: Record<string, string> } | null | undefined;
            const panels = inputsDigestHtml(env?.inputs) + stepsHtml(report);
            const box = dlg.querySelector<HTMLElement>('.cat-cred-panels');
            if (box && panels) { box.innerHTML = panels; box.hidden = false; }
          }
        } catch { /* leave the lockup + panels hidden - the checker button is still there */ }
      })();
    }

    // A shared themed link opens on that colour - recolour the preview to match on open
    // (the swatch is already marked active above). Best-effort; leaves the base otherwise.
    if (themable && initialTheme && dTheme) {
      void (async () => {
        try {
          if (!dBaseSvg) dBaseSvg = await (await fetch(ref.url)).text();
          const th = iconThemes.find(x => x.id === dTheme);
          const img = dlg.querySelector<HTMLImageElement>('.cat-thumb');
          if (img && th) img.src = svgTextToDataUrl(restyleIconTheme(dBaseSvg, th) || dBaseSvg);
        } catch { /* leave the base preview */ }
      })();
    }
    // A raster photo opens on its carried treatment (category selection / shared link) - a
    // cheap live CSS filter over the injected defs, exactly like the grid + picker previews.
    if (treatable && dTreatment) {
      ensureTreatmentDefs();
      const img = dlg.querySelector<HTMLImageElement>('.cat-thumb');
      if (img) img.style.filter = `url(#${TREATMENT_FILTER_PREFIX}${dTreatment})`;
    }
    // A text asset: fill the reading preview from the asset url after mount (the markup
    // was built sync, with a "Loading…" stub). `textContent` escapes, so the file's own
    // bytes can never inject markup. The decoded text is cached for "Analyse text".
    // Swap the text reading surface between raw monospace and rendered markdown.
    // The rendered fill happens once, lazily, and through DOMPurify.sanitize -
    // the one raw-HTML sink this feature adds (counted in primitive-guards R10).
    const setTextRenderMode = (on: boolean): void => {
      const pre = dlg.querySelector<HTMLElement>('.cat-text-preview');
      const box = dlg.querySelector<HTMLElement>('[data-md-rendered]');
      const btn = dlg.querySelector<HTMLElement>('[data-act="text-render"]');
      if (!pre || !box) return;
      // The fill source tracks what the preview is showing: the working copy
      // once edits exist (dPreviewText), else the asset's own bytes.
      const fillSrc = dPreviewText ?? dTextContent;
      if (on && fillSrc != null && !box.dataset.filled) {
        const capped = fillSrc.length > 262144 ? fillSrc.slice(0, 262144) : fillSrc;
        box.innerHTML = DOMPurify.sanitize(mdToHtml(capped));
        box.dataset.filled = '1';
      }
      pre.hidden = on;
      box.hidden = !on;
      btn?.classList.toggle('is-active', on);
      btn?.setAttribute('aria-pressed', String(on));
    };
    // ── The working-copy painter (plans/125/127 UX pass) ─────────────────────
    // Everything the analysis surfaced becomes VISIBLE and decidable in the
    // reading preview: heat marks as before; invisible/format characters as
    // small named chips (the byte-level tells are otherwise literally
    // unseeable); wording swaps and model-rewordable sentences as clickable
    // underlines that open the floating edit card. DOM-built (no markup sink);
    // byte-accurate against the raw text, so the rendered-markdown view drops
    // back to monospace first. The preview shows the first 8 KB - Apply all in
    // the sidebar still covers the whole text.
    // The shared invisible-character renderer (lib/invisible-chars.ts) - the
    // same chips verify's extract shows, so the two surfaces can never drift.
    const appendVisible = (parent: Node, text: string): void => appendVisibleText(parent, text, 'cat-invis');
    const paintWorkPreview = (): void => {
      setTextRenderMode(false);
      const pre = dlg.querySelector<HTMLElement>('.cat-text-preview');
      if (!pre || dCleanedText == null || !dAnalysis) return;
      const text = dCleanedText;
      const shown = text.length > 8192 ? text.slice(0, 8192) : text;
      const grade = (b: number): string => b >= 4 ? t('a strong tell') : b === 3 ? t('a moderate signal') : t('a weak hint, safe to ignore');
      // Flat segmentation: every range boundary (marks, swaps, sentences) cuts,
      // so a piece belongs to at most one CLICKABLE range and one mark.
      const clampPos = (v: number): number => Math.max(0, Math.min(shown.length, v));
      const cuts = new Set<number>([0, shown.length]);
      const marks = dAnalysis.marks.filter((m) => m.index < shown.length);
      for (const m of marks) { cuts.add(clampPos(m.index)); cuts.add(clampPos(m.index + m.length)); }
      for (const s of dSuggestions) if (s.index < shown.length) { cuts.add(clampPos(s.index)); cuts.add(clampPos(s.index + s.length)); }
      const rwVisible = dRewordStatus !== 'unstaged';
      if (rwVisible) for (const s of dRewordSpans) if (s.index < shown.length) { cuts.add(clampPos(s.index)); cuts.add(clampPos(s.index + s.length)); }
      const points = [...cuts].sort((x, y) => x - y);
      const rangeAt = (pos: number, ranges: readonly { index: number; length: number }[]): number => {
        for (let k = 0; k < ranges.length; k++) { const r = ranges[k]!; if (pos >= r.index && pos < r.index + r.length) return k; }
        return -1;
      };
      const frag = document.createDocumentFragment();
      for (let p = 0; p + 1 < points.length; p++) {
        const a = points[p]!;
        const b = points[p + 1]!;
        if (b <= a) continue;
        const piece = shown.slice(a, b);
        const sug = rangeAt(a, dSuggestions);
        const rw = rwVisible ? rangeAt(a, dRewordSpans) : -1;
        const mk = marks.find((m) => a >= m.index && a < m.index + m.length);
        let el: HTMLElement | null = null;
        if (sug >= 0) {
          const s = dSuggestions[sug]!;
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'cat-sug';
          btn.dataset.sug = String(sug);
          btn.title = s.kind === 'delete'
            ? tRaw('{label}: tap to review removing this', { label: s.label })
            : tRaw('{label}: tap to review "{to}"', { label: s.label, to: s.replacement });
          el = btn;
        } else if (rw >= 0) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'cat-rw';
          btn.dataset.rw = String(rw);
          btn.title = t('The on-device model can suggest a plainer version of this sentence');
          el = btn;
        } else if (mk?.tier) {
          const markEl = document.createElement('mark');
          const bkt = heatBucket(mk.heat ?? 0);
          markEl.className = `cat-hl cat-hl--${mk.tier} cat-hl--t${bkt}`;
          markEl.title = grade(bkt);
          el = markEl;
        }
        if (el) {
          if ((sug >= 0 || rw >= 0) && mk?.tier) el.classList.add('cat-hl', `cat-hl--t${heatBucket(mk.heat ?? 0)}`);
          appendVisible(el, piece);
          frag.appendChild(el);
        } else {
          appendVisible(frag, piece);
        }
      }
      if (shown.length < text.length) frag.appendChild(document.createTextNode(`\n\n${t('…preview truncated.')}`));
      pre.replaceChildren(frag);
    };
    if (isTextAsset) {
      void (async () => {
        const pre = dlg.querySelector<HTMLElement>('.cat-text-preview[data-text-src]');
        try {
          const text = await (await fetch(ref.url)).text();
          dTextContent = text;
          if (pre) {
            const shown = text.length > 8192 ? text.slice(0, 8192) : text;
            // Chips from the FIRST paint: hidden characters must not wait for
            // an Analyse click to become visible.
            pre.replaceChildren();
            appendVisible(pre, shown);
            if (text.length > shown.length) pre.appendChild(document.createTextNode(`\n\n${t('…preview truncated.')}`));
          }
          // Markdown-shaped text gets the render toggle; a real .md defaults to
          // the rendered view (the raw bytes stay one tap away).
          const mdCapable = ref.format === 'md' || ref.format === 'markdown' || looksLikeMarkdown(text);
          const renderBtn = dlg.querySelector<HTMLElement>('[data-act="text-render"]');
          if (mdCapable && renderBtn) renderBtn.hidden = false;
          if (ref.format === 'md' || ref.format === 'markdown') setTextRenderMode(true);
        } catch {
          if (pre) pre.textContent = t('This text could not be read.');
        }
      })();
    }

    // Inline crop mode: the Crop action overlays the shared crop box on THIS open preview
    // rather than spawning the standalone crop dialog. Same source prep (prepCropSource),
    // same crop-box interaction (wireCropBox) and same signed downloadCrop - Cancel/Escape or
    // a completed download returns to the detail view (this same modal, same asset), never
    // reopening or reloading it. `inlineCrop` holds the exit fn while cropping (null otherwise),
    // which the keydown/close handlers read to know a crop is in progress.
    let inlineCrop: (() => void) | null = null;
    // Inline Retouch (plan 124 WP-E): the preview becomes the brush stage with
    // a toolbar on top - the crop pattern exactly. The handle's busy() gates
    // Escape so a committing save can never be torn down mid-write.
    let inlineRetouch: import('./retouch-inline.ts').RetouchInlineHandle | null = null;
    let retouchEntering = false;
    async function enterInlineRetouch(): Promise<void> {
      if (inlineRetouch || retouchEntering || inlineCrop) return;
      const preview = dlg.querySelector<HTMLElement>('.cat-details-preview');
      if (!preview) return;
      retouchEntering = true;
      const { mountInlineRetouch } = await import('./retouch-inline.ts');
      retouchEntering = false;
      if (detailsDialog !== dlg || inlineRetouch) return; // paged/closed during the import
      cropModeActive = true; // pause attachZoom's wheel/drag while the brush owns the stage
      preview.classList.add('is-retouching');
      dlg.classList.add('is-retouching');
      inlineRetouch = mountInlineRetouch(
        host as unknown as import('./retouch-inline.ts').RetouchHost,
        { source: ref, sourceName: name },
        {
          stage: preview,
          onDone: (made) => {
            inlineRetouch = null;
            cropModeActive = false;
            preview.classList.remove('is-retouching');
            dlg.classList.remove('is-retouching');
            // A save lands like matte's did: refresh the grid and open the copy.
            if (made) void (async () => { await reload(); rerender(); openDetails(made); })();
          },
        },
      );
    }
    // Inline video edit (plans/130): Grade and Trim are two tabs of ONE mode over
    // this preview - the look and the in/out points are both decisions about what is
    // on screen, so they are made at the frame. Applying enqueues a background job and
    // leaves; the global toast owns progress, exactly like the vid-* dialog path.
    // Inline STILL grade (2026-08-20): the video Grade tab's bitmap sibling. Same
    // takeover shape as the video mode; Apply enqueues a background job and exits,
    // so the toast (riding above this modal now) owns progress and cancel.
    let inlineGrade: import('./grade-inline.ts').GradeInlineHandle | null = null;
    let gradeEntering = false;
    async function enterInlineGrade(): Promise<void> {
      if (inlineGrade || gradeEntering || inlineCrop || inlineRetouch || inlineVideoEdit) return;
      const preview = dlg.querySelector<HTMLElement>('.cat-details-preview');
      if (!preview) return;
      gradeEntering = true;
      let modeCleared = false;
      try {
        // prepCropSource bakes the selected photo treatment into the source, so a
        // treated preview grades (and saves) what the user is actually looking at.
        const src = await prepCropSource(ref, dTreatment);
        if (detailsDialog !== dlg || inlineGrade) return;
        if (!src) return;
        const { mountInlineGrade } = await import('./grade-inline.ts');
        if (detailsDialog !== dlg || inlineGrade) return;
        cropModeActive = true;   // pause attachZoom's wheel/drag while the mode owns the stage
        preview.classList.add('is-grading');
        dlg.classList.add('is-grading');
        const handle = await mountInlineGrade({
          stage: preview,
          rasterSrc: src.rasterSrc,
          name,
          formats: [['png', 'PNG'], ['jpg', 'JPG'], ['webp', 'WebP']],
          log: (level, msg, data) => host.log?.(level, msg, { id: ref.id, ...data }),
          deliver: async (blob, format, g) => {
            // Sign + save exactly like the crop mode's "Save to catalog": the same
            // signed bytes a download would carry, with the honest colour step. The
            // video grade's provenance builder is op-level, so the credited-LUT
            // attribution (SUSE7 is CC BY) rides the same c2pa.color_adjustments
            // action parameters here as it does on a graded clip.
            const { videoProvenanceFor } = await import('../lib/video-jobs.ts');
            const prov = videoProvenanceFor('grade', { lutLabel: g.lutLabel || undefined, lutCredit: g.lutCredit });
            const detail: Record<string, string> = {
              ...(g.lutLabel ? { look: g.lutLabel } : {}),
              intensity: String(Math.round(g.intensity * 100)),
              ...(g.grain > 0 ? { grain: String(Math.round(g.grain * 100)), grainSize: String(g.grainSize) } : {}),
              ...(g.vignette > 0 ? { vignette: String(Math.round(g.vignette * 100)) } : {}),
            };
            const signed = await signDerived(ref, blob, format, { edits: prov.actions as C2paActionInput[], detail });
            const base = String(ref.meta?.name ?? ref.id.split('/').pop() ?? 'image').replace(/\.[a-z0-9]+$/i, '');
            const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
            const id = `user/grade/${Date.now()}-${slug || 'grade'}`;
            const aiKind = assetAiKind(ref);
            const assets = host.assets as unknown as {
              _uploadUserAsset(r: { id: string; type: AssetRef['type']; format: string; blob: Blob; version: string; meta: Record<string, unknown> }): Promise<void>;
            };
            await assets._uploadUserAsset({
              id,
              type: 'raster',
              format,
              blob: signed,
              version: '1.0.0',
              meta: {
                name: tRaw('{name} - graded', { name: base }),
                bytes: signed.size,
                ...(aiKind ? { aiGenerated: aiKind } : {}),
              },
            });
            announce(tRaw('Graded copy saved to your uploads as "{name}".', { name: tRaw('{name} - graded', { name: base }) }));
            // A landing job refreshes the grid; it never opens a modal over the
            // user, who may be well past this edit by then (the vid-* precedent).
            if (mounted) void reload().then(rerender);
          },
          onDone: () => {
            if (modeCleared) return;
            modeCleared = true;
            inlineGrade = null;
            cropModeActive = false;
            preview.classList.remove('is-grading');
            dlg.classList.remove('is-grading');
          },
        });
        if (detailsDialog !== dlg) { handle.exit(); return; }
        inlineGrade = handle;
      } finally {
        gradeEntering = false;
        // A mount that threw must not leave the takeover classes - and attachZoom's
        // pause - standing over a stage with no mode on it (the video mode's rule).
        if (!inlineGrade && !modeCleared) {
          preview.classList.remove('is-grading');
          dlg.classList.remove('is-grading');
          if (detailsDialog === dlg) cropModeActive = false;
        }
      }
    }

    let inlineVideoEdit: import('./video-edit-inline.ts').VideoEditInlineHandle | null = null;
    let videoEditEntering = false;
    async function enterInlineVideoEdit(tab: import('./video-edit-inline.ts').VideoEditTab): Promise<void> {
      if (inlineVideoEdit || videoEditEntering || inlineCrop || inlineRetouch || inlineGrade) return;
      const preview = dlg.querySelector<HTMLElement>('.cat-details-preview');
      const thumb = preview?.querySelector<HTMLVideoElement>('video.cat-thumb');
      if (!preview || !thumb) return;
      // The flag spans BOTH awaits (the import and the mount), because the handle
      // that `if (inlineVideoEdit)` tests isn't assigned until after them.
      videoEditEntering = true;
      let modeCleared = false;
      try {
        const { mountInlineVideoEdit } = await import('./video-edit-inline.ts');
        if (detailsDialog !== dlg || inlineVideoEdit) return;   // paged/closed during the import
        cropModeActive = true;   // pause attachZoom's wheel/drag while the mode owns the stage
        preview.classList.add('is-video-editing');
        dlg.classList.add('is-video-editing');
        const handle = await mountInlineVideoEdit(host as unknown as VideoJobHost, {
          stage: preview,
          video: thumb,
          ref,
          name,
          initialTab: tab,
          onDone: (made) => {
            // Two callers land here: the mode ending (null), and - later - a job
            // enqueued from it completing (the made ref). Idempotent for that reason.
            if (!modeCleared) {
              modeCleared = true;
              inlineVideoEdit = null;
              cropModeActive = false;
              preview.classList.remove('is-video-editing');
              dlg.classList.remove('is-video-editing');
            }
            // A landing job refreshes the grid; it never opens a modal over the
            // user, who is minutes past this edit by then (the vid-* precedent).
            if (made && mounted) void reload().then(rerender);
          },
        });
        if (detailsDialog !== dlg) { handle.exit(); return; }   // paged/closed during the mount
        inlineVideoEdit = handle;
      } finally {
        videoEditEntering = false;
        // A mount that threw must not leave the takeover classes - and attachZoom's
        // pause - standing over a stage with no mode on it. Only this dialog's own
        // pause is cleared: a newer modal may have opened a mode of its own.
        if (!inlineVideoEdit && !modeCleared) {
          preview.classList.remove('is-video-editing');
          dlg.classList.remove('is-video-editing');
          if (detailsDialog === dlg) cropModeActive = false;
        }
      }
    }
    // Synchronous in-flight guard: `inlineCrop` isn't assigned until AFTER the async
    // prepCropSource below, so a fast double-click could pass an `if (inlineCrop)`
    // check twice and build two overlays. This flag is set/cleared around the only
    // await; everything after it is synchronous through `inlineCrop = exit`.
    let cropEntering = false;
    async function enterInlineCrop(): Promise<void> {
      if (inlineCrop || cropEntering) return;   // already cropping, or mid-entry
      const modifier = isThemable(ref) ? dTheme : dTreatment;
      cropEntering = true;
      const src = await prepCropSource(ref, modifier);
      cropEntering = false;
      if (detailsDialog !== dlg) return;   // modal paged/closed during the fetch - abandon
      if (!src) { closeDetails(); await directDownload(ref); return; }   // not fetchable/SVG → just save it
      const preview = dlg.querySelector<HTMLElement>('.cat-details-preview');
      if (!preview) return;
      const { vector, svgText, origSvg, theme, treatment, rasterSrc, aspect } = src;
      const fmts: [string, string][] = vector ? [['svg', 'SVG'], ['png', 'PNG']] : [['png', 'PNG'], ['jpg', 'JPG'], ['webp', 'WebP']];

      cropModeActive = true;   // pause attachZoom's wheel/drag while the crop box owns the stage
      preview.classList.add('is-cropping');
      dlg.classList.add('is-cropping');

      // Same crop-box markup the dialog builds; textContent-free, so no untrusted interpolation.
      const handles = ['n', 'e', 's', 'w'].map(h => `<span class="cat-crop-e" data-h="${h}"></span>`).join('')
        + ['nw', 'ne', 'sw', 'se'].map(h => `<span class="cat-crop-h" data-h="${h}"></span>`).join('');
      // The mode's controls live in a toolbar ON TOP of the preview (the
      // retouch treatment, Andy 2026-08-19) - the whole decision happens at
      // the image, nothing lands down the scrolling body.
      const work = document.createElement('div');
      work.className = 'cat-crop-work cat-crop-inline';
      work.innerHTML = `
        <div class="cat-mode-bar">
          <div class="cat-dl-fmt cat-crop-fmt" role="radiogroup" aria-label="${escape(t('Format'))}">${fmts.map(([v, l], i) =>
            `<label class="field-toggle"><input type="radio" class="field-radio" name="cat-crop-fmt" value="${escape(v)}"${i === 0 ? ' checked' : ''}> ${escape(l)}</label>`).join('')}</div>
          <span class="cat-mode-bar-actions">
            <button type="button" class="btn cat-crop-cancel">${escape(t('Cancel'))}</button>
            <button type="button" class="btn cat-crop-save">${escape(t('Save to catalog'))}</button>
            <button type="button" class="btn cat-crop-go modal-primary">${escape(t('Download crop'))}</button>
          </span>
        </div>
        ${vector ? '' : `<div class="cat-vid-panel cat-crop-tf">
          <label class="cat-vid-slider">
            <span class="cat-vid-slider-label">${escape(t('Rotate'))}</span>
            <input type="range" data-tf="rotate" min="-45" max="45" step="0.1" value="0">
            <output data-tf-out="rotate">0°</output>
          </label>
          <button type="button" class="btn btn--sm cat-tf-quarter" title="${escape(t('Rotate 90 degrees'))}" aria-label="${escape(t('Rotate 90 degrees'))}">90°↷</button>
          <label class="cat-vid-slider">
            <span class="cat-vid-slider-label">${escape(t('Skew X'))}</span>
            <input type="range" data-tf="skewX" min="-30" max="30" step="0.1" value="0">
            <output data-tf-out="skewX">0°</output>
          </label>
          <label class="cat-vid-slider">
            <span class="cat-vid-slider-label">${escape(t('Skew Y'))}</span>
            <input type="range" data-tf="skewY" min="-30" max="30" step="0.1" value="0">
            <output data-tf-out="skewY">0°</output>
          </label>
          <button type="button" class="btn btn--sm cat-tf-flip" data-flip="h" aria-pressed="false" title="${escape(t('Flip horizontally'))}">⇋</button>
          <button type="button" class="btn btn--sm cat-tf-flip" data-flip="v" aria-pressed="false" title="${escape(t('Flip vertically'))}">⇵</button>
          <button type="button" class="btn btn--sm cat-tf-reset" hidden>${escape(t('Reset'))}</button>
        </div>`}
        <div class="cat-crop-body">
          <div class="cat-crop-viewport">
            <div class="cat-crop-stage">
              <img class="cat-crop-img" alt="" src="${escape(vector ? svgTextToDataUrl(svgText!) : rasterSrc)}">
              <div class="cat-crop-box">${handles}</div>
            </div>
          </div>
          <div class="cat-zoom-hud"></div>
        </div>`;
      preview.appendChild(work);

      const viewport = work.querySelector<HTMLElement>('.cat-crop-viewport')!;
      const stage = work.querySelector<HTMLElement>('.cat-crop-stage')!;
      const imgEl = work.querySelector<HTMLImageElement>('.cat-crop-img')!;
      const boxEl = work.querySelector<HTMLElement>('.cat-crop-box')!;
      const hudEl = work.querySelector<HTMLElement>('.cat-zoom-hud');
      const crop = wireCropBox({ viewport, stage, imgEl, boxEl, hudEl, vector, aspect });
      const fmt = (): string => work.querySelector<HTMLInputElement>('input[name="cat-crop-fmt"]:checked')?.value ?? (vector ? 'svg' : 'png');

      // Straighten transforms (2026-08-20, Andy - phone photos need aligning
      // before filtering): rotate (fine ±45° + 90° steps), skew X/Y, flips.
      // Preview = a CSS transform on the image UNDER the axis-aligned crop
      // frame (the standard straighten UX; the viewport clips the overhang);
      // export applies the identical matrix in downloadCrop's raster path.
      const tf = { rotate: 0, quarter: 0, skewX: 0, skewY: 0, flipH: false, flipV: false };
      const tfActive = (): boolean => !!(tf.rotate || tf.quarter || tf.skewX || tf.skewY || tf.flipH || tf.flipV);
      const applyTf = (): void => {
        const deg = tf.quarter * 90 + tf.rotate;
        imgEl.style.transform = tfActive()
          ? `rotate(${deg}deg) skewX(${tf.skewX}deg) skewY(${tf.skewY}deg) scale(${tf.flipH ? -1 : 1}, ${tf.flipV ? -1 : 1})`
          : '';
        for (const key of ['rotate', 'skewX', 'skewY'] as const) {
          const out = work.querySelector<HTMLElement>(`[data-tf-out="${key}"]`);
          if (out) out.textContent = `${key === 'rotate' ? tf.quarter * 90 + tf.rotate : tf[key]}°`;
        }
        const reset = work.querySelector<HTMLElement>('.cat-tf-reset');
        if (reset) reset.hidden = !tfActive();
      };
      for (const slider of work.querySelectorAll<HTMLInputElement>('[data-tf]')) {
        slider.addEventListener('input', () => {
          tf[slider.dataset.tf as 'rotate' | 'skewX' | 'skewY'] = parseFloat(slider.value) || 0;
          applyTf();
        });
      }
      work.querySelector<HTMLButtonElement>('.cat-tf-quarter')?.addEventListener('click', () => {
        tf.quarter = (tf.quarter + 1) % 4;
        applyTf();
      });
      for (const flip of work.querySelectorAll<HTMLButtonElement>('.cat-tf-flip')) {
        flip.addEventListener('click', () => {
          if (flip.dataset.flip === 'h') tf.flipH = !tf.flipH; else tf.flipV = !tf.flipV;
          flip.setAttribute('aria-pressed', String(flip.dataset.flip === 'h' ? tf.flipH : tf.flipV));
          applyTf();
        });
      }
      work.querySelector<HTMLButtonElement>('.cat-tf-reset')?.addEventListener('click', () => {
        tf.rotate = 0; tf.quarter = 0; tf.skewX = 0; tf.skewY = 0; tf.flipH = false; tf.flipV = false;
        for (const slider of work.querySelectorAll<HTMLInputElement>('[data-tf]')) slider.value = '0';
        for (const flip of work.querySelectorAll<HTMLButtonElement>('.cat-tf-flip')) flip.setAttribute('aria-pressed', 'false');
        applyTf();
      });

      const exit = (): void => {
        if (inlineCrop !== exit) return;   // idempotent
        inlineCrop = null;
        cropModeActive = false;
        work.remove();
        preview.classList.remove('is-cropping');
        dlg.classList.remove('is-cropping');
      };
      inlineCrop = exit;

      work.addEventListener('click', async (e) => {
        const tgt = e.target as HTMLElement;
        if (tgt.closest('.cat-crop-cancel')) { exit(); return; }
        if (tgt.closest('.cat-crop-save')) {
          // Save the crop AS a catalog asset (same signed bytes as the
          // download - the credential chain incl. the genAI backfill is
          // identical), then open the new copy.
          const saveBtn = work.querySelector<HTMLButtonElement>('.cat-crop-save');
          if (saveBtn?.disabled) return;
          if (saveBtn) saveBtn.disabled = true;
          const made: { ref: AssetRef | null } = { ref: null };
          const save: CropDeliver = async (blob, format, o) => {
            const signed = await signDerived(ref, blob, format, o);
            const base = String(ref.meta?.name ?? ref.id.split('/').pop() ?? 'image').replace(/\.[a-z0-9]+$/i, '');
            const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
            const id = `user/crop/${Date.now()}-${slug || 'crop'}`;
            const aiKind = assetAiKind(ref);
            const assets = host.assets as unknown as {
              _uploadUserAsset(r: { id: string; type: AssetRef['type']; format: string; blob: Blob; version: string; meta: Record<string, unknown> }): Promise<void>;
            };
            await assets._uploadUserAsset({
              id,
              type: format === 'svg' ? 'vector' : 'raster',
              format,
              blob: signed,
              version: '1.0.0',
              meta: {
                name: tRaw('{name} - crop', { name: base }),
                bytes: signed.size,
                // The source's authored AI flag rides onto the copy's meta so
                // the AI chip survives alongside the credential's record.
                ...(aiKind ? { aiGenerated: aiKind } : {}),
              },
            });
            made.ref = await host.assets.get(id);
          };
          try { await downloadCrop(ref, vector, svgText, imgEl, crop.getFrac(), fmt(), { theme, treatment, origSvg, transform: tfActive() ? tf : undefined }, save); }
          catch (err) { host.log?.('error', 'Catalog crop save failed', { id: ref.id, error: String(err) }); }
          exit();
          if (made.ref) {
            announce(tRaw('Crop saved to your uploads as "{name}".', { name: String(made.ref.meta?.name ?? made.ref.id) }));
            await reload(); rerender(); openDetails(made.ref);
          }
          return;
        }
        if (tgt.closest('.cat-crop-go')) {
          try { await downloadCrop(ref, vector, svgText, imgEl, crop.getFrac(), fmt(), { theme, treatment, origSvg, transform: tfActive() ? tf : undefined }); }
          catch (err) { host.log?.('error', 'Catalog crop failed', { id: ref.id, error: String(err) }); }
          exit();   // back to the detail view after a successful (or failed) download
        }
      });
    }

    /**
     * Inline trim mode: "Trim margins" measures the STORED bytes and, when a trim
     * would buy something, shows the shared before/after card in the body under the
     * actions - the same card the dropzone and the asset picker show at upload time,
     * offered here after the fact. It stays in THIS modal, like crop.
     *
     * "Trim" rewrites the bytes in place (commitTrim) and reopens the details on the
     * fresh asset; "Keep original margins", the card's ✕ and Escape all leave the
     * upload untouched (nothing is being ingested here, so backing out and keeping
     * the margins land in the same place). An upload that is already tight gets a
     * note instead, and the action stays where it is. `inlineTrim` (declared beside
     * the modal) holds the exit fn while a card is up, so onClose can answer one the
     * dialog outlived.
     */
    let trimEntering = false;   // the same double-click guard enterInlineCrop documents
    async function enterInlineTrim(): Promise<void> {
      if (inlineTrim || trimEntering) return;   // already trimming, or mid-entry
      const actions = dlg.querySelector<HTMLElement>('.cat-details-actions');
      if (!actions) return;
      trimEntering = true;
      const [trim, measured] = await Promise.all([
        import('../lib/design-system/trim-offer.ts').catch(() => null),
        measureTrim(ref).catch((err) => {
          host.log?.('error', 'Catalog trim measure failed', { id: ref.id, error: String(err) });
          return null;
        }),
      ]);
      trimEntering = false;
      if (detailsDialog !== dlg) return;   // modal paged/closed during the read - abandon
      if (!trim || !measured) return;      // unreadable: say nothing rather than something wrong
      const { record, proposal } = measured;
      if (!proposal) { showTrimNote(actions, t('Already tight to its content')); return; }

      const mount = document.createElement('div');
      mount.className = 'trimo-host';
      actions.after(mount);
      dlg.classList.add('is-trimming');   // the action row steps aside, exactly as crop's does
      // Escape backs out of the TRIM, not the whole modal. The card stops the event
      // propagating (so the dlg keydown handler below never sees it), but a native
      // <dialog>'s close watcher fires off the keydown itself unless it was cancelled
      // - so cancel it here in the capture phase, before the card's own listener
      // answers. Same rule inline crop follows.
      //
      // The card's own listener is bound to the card, so it only ever sees an
      // Escape pressed INSIDE it. Focus is free to leave (the close ✕ and the
      // prev/next controls stay reachable), and there this preventDefault would
      // otherwise be the whole story: the modal can't close, the card can't hear
      // it, and the keyboard has no way out. So answer for the card when the
      // press came from outside it.
      const keys = new AbortController();
      dlg.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        if (!mount.contains(e.target as Node | null)) exit(true);
      }, { capture: true, signal: keys.signal });

      // Assigned by the mount call below; a decision can only arrive from a click or
      // an Escape, so the null check is the "already exited" latch, not a race.
      let teardown: (() => void) | null = null;
      // `restoreFocus` only when the USER answered: the card held focus, and its
      // buttons are about to be removed. Left false for the onClose path, where
      // focusing into a dialog that is on its way out would fight the modal.
      const exit = (restoreFocus = false): void => {
        if (!teardown) return;
        teardown();                      // revokes the two preview object URLs
        teardown = null;
        keys.abort();
        mount.remove();
        dlg.classList.remove('is-trimming');
        inlineTrim = null;
        if (restoreFocus) dlg.querySelector<HTMLElement>('.cat-act-trim')?.focus();
      };
      teardown = trim.mountTrimOffer(mount, proposal, {
        t,
        onResolve: (file, trimmed) => {
          exit(true);
          if (trimmed) void applyTrim(record, file);
        },
        // Nothing is being ingested here - the asset already exists - so backing
        // out and "keep the original margins" land in the same place: the card
        // closes and the stored bytes are untouched.
        onCancel: () => exit(true),
      });
      inlineTrim = exit;
    }

    /** Write the trimmed bytes, then show the asset as it now is. */
    async function applyTrim(record: UserAssetRecordLike, file: File): Promise<void> {
      try {
        await commitTrim(record, file);
      } catch (err) {
        host.log?.('error', 'Catalog trim failed', { id: ref.id, error: String(err) });
        // Quota errors carry a user-ready message; everything else gets a plain one.
        announce((err as { code?: unknown }).code ? (err as Error).message : t('Couldn’t trim that image.'), { assertive: true });
        return;
      }
      if (!mounted) return;
      await reload();                    // the record changed under _listUserAssets
      if (!mounted) return;
      rerender();
      announce(t('Margins trimmed.'));
      // The pre-trim record (blob included) is still in `record` - offer the way
      // back. Undo re-uploads the original bytes at the same id (its checksum
      // describes those bytes again, so it rides along untouched).
      showUndoToast({
        message: tRaw('Trimmed "{name}".', { name: String(record.meta?.name ?? ref.id) }),
        undo: async () => {
          try { await host.assets._uploadUserAsset({ ...record, version: String(Date.now()) }); }
          catch (err) { host.log?.('error', 'Trim undo failed', { id: ref.id, error: String(err) }); return; }
          if (!mounted) return;
          await reload();
          if (!mounted) return;
          rerender();
          announce(t('Restored the untrimmed image.'));
          const back = assetById.get(ref.id);
          if (back && detailsDialog === dlg) openDetails(back, dTheme, dTreatment);
        },
      });
      // Reopen on the fresh ref (new version ⇒ new object URL) so the preview shows
      // the trimmed bytes rather than the ones the modal opened with.
      const fresh = assetById.get(ref.id);
      if (fresh && detailsDialog === dlg) openDetails(fresh, dTheme, dTreatment);
    }

    /** The quiet answer when there is nothing to trim. Replaces any earlier note so
     *  repeat clicks can't stack them, and leaves the action in place. */
    function showTrimNote(actions: HTMLElement, message: string): void {
      const existing = dlg.querySelector<HTMLElement>('.cat-trim-note');
      const note = existing ?? document.createElement('p');
      note.className = 'cat-trim-note';
      note.textContent = message;
      if (!existing) actions.after(note);
      announce(message);
    }

    // Escape closes the edit CARD, not the modal, while a card is open - the
    // same native-<dialog> close-watcher cancel the crop/trim cards use.
    dlg.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !dCard) return;
      e.preventDefault();
      e.stopPropagation();
      closeEditCard();
    }, { capture: true });
    dlg.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      // The floating edit card: any click outside it closes it first, and a
      // click on an underlined swap/sentence in the preview opens its card.
      if (dCard && !dCard.contains(target)) closeEditCard();
      const sugAnchor = target.closest<HTMLElement>('[data-sug]');
      if (sugAnchor) {
        const i = Number(sugAnchor.dataset.sug);
        const s = dSuggestions[i];
        if (s) openEditCard(sugAnchor, sugCardHtml(s, i));
        return;
      }
      const rwAnchor = target.closest<HTMLElement>('[data-rw]');
      if (rwAnchor) { openEditCard(rwAnchor, rwCardHtml(Number(rwAnchor.dataset.rw))); return; }
      // Prev/next lightbox paging - reopen the modal on the neighbouring asset, carrying the
      // current colour choice so paging keeps the look.
      const navBtn = target.closest<HTMLElement>('[data-nav]');
      if (navBtn) { const r = navBtn.dataset.nav === 'prev' ? nav.prev : nav.next; if (r) openDetails(r, dTheme, dTreatment); return; }
      // Play/pause the Lottie preview. The player mounts a tick after open, so this is a no-op
      // until then (the marker still shows its resting poster, and the button reflects "playing").
      const motionBtn = target.closest<HTMLElement>('[data-act="motion-toggle"]');
      if (motionBtn) {
        const motionEl = dlg.querySelector<HTMLElement>('.cat-thumb-motion');
        const player = motionEl ? lottiePlayerFor(motionEl) : null;
        if (player) {
          player.togglePause();
          const playing = !player.isPaused;
          motionBtn.classList.toggle('is-playing', playing);
          motionBtn.innerHTML = playing ? PAUSE_ICON : PLAY_ICON;
          motionBtn.setAttribute('aria-label', playing ? t('Pause') : t('Play'));
          motionBtn.title = playing ? t('Pause') : t('Play');
        }
        return;
      }
      // Colour treatment swatch (raster photos): wash the preview in place via the live CSS
      // filter, keep the modal open. Checked before the icon branch - treat buttons also carry
      // .cat-dl-theme, but this .cat-dl-treat branch owns them.
      const treatSw = target.closest<HTMLElement>('.cat-dl-treat');
      if (treatSw && treatable) {
        dTreatment = treatSw.dataset.treatment || null;
        dlg.querySelectorAll<HTMLElement>('.cat-dl-treat').forEach(b => {
          const on = b === treatSw; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on));
        });
        ensureTreatmentDefs();
        const img = dlg.querySelector<HTMLImageElement>('.cat-thumb');
        if (img) img.style.filter = dTreatment ? `url(#${TREATMENT_FILTER_PREFIX}${dTreatment})` : '';
        return;
      }
      // Colour swatch (themable icons): recolour the preview in place, keep the modal open.
      const sw = target.closest<HTMLElement>('.cat-dl-theme');
      if (sw && themable) {
        dTheme = sw.dataset.theme ?? dTheme;
        dlg.querySelectorAll<HTMLElement>('.cat-dl-theme').forEach(b => {
          const on = b === sw; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on));
        });
        try {
          if (!dBaseSvg) dBaseSvg = await (await fetch(ref.url)).text();
          const th = iconThemes.find(x => x.id === dTheme);
          const img = dlg.querySelector<HTMLImageElement>('.cat-thumb');
          if (img && th) img.src = svgTextToDataUrl(restyleIconTheme(dBaseSvg, th) || dBaseSvg);
        } catch { /* recolour is best-effort - leaves the base preview */ }
        return;
      }
      // A tag chip filters the grid: close the modal and hand `tag:x` to the
      // shared search bar (its onQuery path re-renders, same as typing it).
      const tagBtn = target.closest<HTMLElement>('[data-tag]');
      if (tagBtn?.dataset.tag) {
        closeDetails();
        setSearchBarQuery(`tag:${tagBtn.dataset.tag}`);
        return;
      }
      const act = target.closest<HTMLElement>('[data-act]')?.dataset.act;
      if (!act) return;
      if (act === 'close') { closeDetails(); return; }
      if (act === 'fav') {
        if (favSet.has(base)) favSet.delete(base); else favSet.add(base);
        if (profile) await saveFavouriteAssets(host, profile, favSet);
        const on = favSet.has(base);
        const btn = dlg.querySelector<HTMLElement>('.cat-act-fav');
        btn?.classList.toggle('is-fav', on); btn?.setAttribute('aria-pressed', String(on));
        const lbl = btn?.querySelector('span'); if (lbl) lbl.textContent = on ? t('Favourited') : t('Favourite');
        // Reflect in the grid + favourites strip behind the modal, in place (no full
        // re-render - favouriting never moves a tile between buckets).
        if (mounted) { reflectFavInGrid(base, on); refreshFavStrip(); }
        announce(on ? tRaw('Added {name} to favourites', { name }) : tRaw('Removed {name} from favourites', { name }));
        return;
      }
      if (act === 'share') {
        const btn = target.closest<HTMLElement>('.cat-act-share');
        // Share the styled variant when a colour is picked, so the recipient reopens the same
        // look (the modifier rides in the asset id - buildThemedAssetId / buildTreatedAssetId).
        const link = themable && dTheme
          ? `${location.origin}${location.pathname}#/c?asset=${encodeURIComponent(buildThemedAssetId(base, dTheme))}`
          : treatable && dTreatment
            ? `${location.origin}${location.pathname}#/c?asset=${encodeURIComponent(buildTreatedAssetId(base, dTreatment))}`
            : assetLink(ref);
        try { await navigator.clipboard.writeText(link); } catch { /* clipboard blocked */ }
        const s = btn?.querySelector('span');
        if (s) s.textContent = t('Copied!'); btn?.classList.add('is-copied');
        // Restore to the fixed label (never the current text) so a rapid re-click can't
        // capture 'Copied!' and leave the button stuck.
        setTimeout(() => { if (s) s.textContent = t('Copy link'); btn?.classList.remove('is-copied'); }, 1200);
        return;
      }
      // Text-asset actions (plans/125): both stay IN this modal (like share/crop), so they
      // are handled before the closeDetails() below. The bytes ARE the text - no OCR.
      if (act === 'text-zoom-in' || act === 'text-zoom-out') {
        dTextZoom = Math.max(0.55, Math.min(2.4, dTextZoom * (act === 'text-zoom-in' ? 1.2 : 1 / 1.2)));
        dlg.querySelector<HTMLElement>('.cat-thumb-text')?.style.setProperty('--cat-text-zoom', dTextZoom.toFixed(3));
        return;
      }
      if (act === 'text-render') {
        const box = dlg.querySelector<HTMLElement>('[data-md-rendered]');
        setTextRenderMode(!(box && !box.hidden));
        return;
      }
      if (act === 'dl-text') {
        // Formatted downloads for a text asset: raw bytes, or the shared markdown
        // block model emitted as standalone HTML / RTF / DOCX / ODT
        // (lib/text-doc-export.ts - lazy, the converters are download-only weight).
        const btn = target.closest<HTMLButtonElement>('[data-act="dl-text"]');
        const fmt = btn?.dataset.fmt;
        if (!btn || !fmt || btn.disabled) return;
        btn.disabled = true;
        try {
          const text = dTextContent ?? await (await fetch(ref.url)).text();
          dTextContent = text;
          const rawName = typeof ref.meta?.name === 'string' && ref.meta.name ? ref.meta.name : (ref.id.split('/').pop() ?? 'text');
          const base = rawName.replace(/\.[a-z0-9]+$/i, '') || 'text';
          if (fmt === 'raw') {
            const ext = ref.format && /^[a-z0-9]{1,10}$/i.test(ref.format) ? ref.format : 'txt';
            const mime = ext === 'md' || ext === 'markdown' ? 'text/markdown' : 'text/plain';
            await host.export.download(new Blob([text], { type: mime }), `${base}.${ext}`);
          } else {
            const mod = await import('../lib/text-doc-export.ts');
            // The HTML page PREFERENCES the active brand's faces (no embedding):
            // readers with the fonts get the brand look, everyone else falls to
            // the system stack the emitter always appends.
            const rootStyle = getComputedStyle(document.documentElement);
            const fontStack = rootStyle.getPropertyValue('--font-brand').trim();
            const monoStack = rootStyle.getPropertyValue('--font-mono').trim();
            if (fmt === 'html') await host.export.download(new Blob([mod.mdToStandaloneHtml(text, base, { fontStack, monoStack })], { type: 'text/html' }), `${base}.html`);
            else if (fmt === 'rtf') await host.export.download(new Blob([mod.mdToRtf(text)], { type: 'application/rtf' }), `${base}.rtf`);
            else if (fmt === 'docx') await host.export.download(await mod.mdToDocxBlob(text, base), `${base}.docx`);
            else if (fmt === 'odt') await host.export.download(await mod.mdToOdtBlob(text, base), `${base}.odt`);
          }
        } catch {
          announce(t('That download could not be built.'));
        } finally {
          btn.disabled = false;
        }
        return;
      }
      if (act === 'copy-text') {
        const btn = target.closest<HTMLElement>('.cat-act-copy-text');
        try {
          const text = dTextContent ?? await (await fetch(ref.url)).text();
          dTextContent = text;
          await navigator.clipboard.writeText(text);
          const s = btn?.querySelector('span');
          if (s) s.textContent = t('Copied!'); btn?.classList.add('is-copied');
          setTimeout(() => { if (s) s.textContent = t('Copy text'); btn?.classList.remove('is-copied'); }, 1200);
        } catch { announce(t('That text could not be copied.')); }
        return;
      }
      if (act === 'analyse-text') {
        const box = dlg.querySelector<HTMLElement>('[data-tsig]');
        try {
          const text = dTextContent ?? await (await fetch(ref.url)).text();
          dTextContent = text;
          // Cap the working slice at ~256 KB: artifacts + heuristics need no
          // more, and a large file must not become a large string here.
          const capped = text.length > 262144 ? text.slice(0, 262144) : text;
          // Analysis arms the whole flow: the working copy starts as the
          // original, and every suggestion/rewrite affordance renders INLINE in
          // the preview from here on. Re-analysing never resets pending edits.
          if (dCleanedText == null) { dCleanedText = capped; dWorkBase = capped; }
          try {
            const rwm = await import('../lib/reworder.ts');
            dRewordStatus = await rwm.rewordStatus();
            dRewordBytes = rwm.rewordModelBytes();
          } catch { dRewordStatus = 'unstaged'; }
          renderTextPanel();
          // A user upload keeps the verdict on its meta so the confidence
          // travels with the asset (and the AI? chip can render without
          // re-analysing) - but only the UNEDITED document's verdict may land.
          if (dAnalysis && dCleanedText === dWorkBase) await persistAiSignals(ref, dAnalysis, 'digital');
        } catch {
          if (box) { box.textContent = t('This text could not be analysed.'); box.hidden = false; }
        }
        target.closest<HTMLElement>('.cat-act-analyse-text')?.setAttribute('aria-expanded', 'true');
        return;
      }
      if (act === 'read-text' && (ref.format === 'pdf' || ref.type === 'vector')) {
        // PDF: text layer + per-page OCR of scanned pages (views/doc-read.ts -
        // the same extractor verify uses). Vector: its own <text> elements,
        // falling back to rasterise-and-OCR when the words are paths. Either
        // way the result ends in the risk-assessment panel and honest notes.
        const box = dlg.querySelector<HTMLElement>('[data-tsig]');
        const btn = target.closest<HTMLButtonElement>('.cat-act-read-text');
        if (btn?.disabled) return;
        const span = btn?.querySelector('span');
        const orig = span?.textContent ?? t('Read text');
        if (btn) btn.disabled = true;
        if (span) span.textContent = t('Reading…');
        const alive = (): boolean => detailsDialog === dlg;
        try {
          const dr = await import('./doc-read.ts');
          let text: string | null = null;
          let source: 'digital' | 'ocr' = 'digital';
          let noteLines: string[] = [];
          if (ref.format === 'pdf') {
            const blob = await (await fetch(ref.url)).blob();
            const result = await dr.extractDocumentText(blob, ocrAvail ? (host.ocr ?? null) : null, (done, total) => {
              if (span) span.textContent = tRaw('Reading page {i} of {n}…', { i: done, n: total });
            });
            text = result.text;
            source = result.source;
            const n = result.notes;
            if (n.pagesRead < n.pageCount) noteLines.push(tRaw('The first {n} of {total} pages were read.', { n: n.pagesRead, total: n.pageCount }));
            if (n.ocrPages > 0) noteLines.push(tRaw('{n} scanned pages were read with on-device text recognition, so hidden-character checks could not run on those pages.', { n: n.ocrPages }));
            if (n.scannedUnread > 0) {
              noteLines.push(n.ocrUnavailable
                ? tRaw('{n} pages are pictures of text and the text-recognition model is not installed, so they were not read.', { n: n.scannedUnread })
                : tRaw('{n} scanned pages were left unread to keep this quick.', { n: n.scannedUnread }));
            }
            if (text == null && n.ocrUnavailable) noteLines = [t('The pages of this document are pictures of text, and the text-recognition model that could read them is not installed.')];
          } else {
            const src = await (await fetch(ref.url)).text();
            text = dr.extractSvgText(src) || null;
            if (text) {
              noteLines.push(t('Read from the vector\u2019s own text elements - a digital extraction, no pixels involved.'));
            } else if (ocrAvail && host.ocr) {
              const frame = await dr.svgToOcrFrame(src, ref.width, ref.height);
              const res = frame ? await host.ocr.run(frame) : null;
              text = res?.text.trim() || null;
              source = 'ocr';
              if (text) noteLines.push(t('This vector draws its words as shapes, so they were read with on-device text recognition.'));
            } else {
              noteLines.push(t('This vector draws its words as shapes, and the text-recognition model that could read them is not installed.'));
            }
          }
          if (!alive() || !box) { announce(t('The text was read. Open this asset again to see the result.')); return; }
          const notesHtml = noteLines.map((b) => `<p class="cat-tsig-note">${escape(b)}</p>`).join('');
          if (text == null) {
            box.innerHTML = notesHtml || `<p class="cat-tsig-note">${escape(t('No readable text was found.'))}</p>`;
            box.hidden = false;
            return;
          }
          const panel = analyzeVerifyText(text, source);
          box.innerHTML = `<pre class="cat-text-preview cat-text-ocr">${catHighlightHtml(text, panel.marks)}</pre>${catTextSignalsHtml(panel)}${notesHtml}`;
          box.hidden = false;
          await persistAiSignals(ref, panel, source);
        } catch (err) {
          host.log('warn', 'catalog: doc/vector read failed', { error: String((err as Error)?.message ?? err) });
          if (alive() && box) { box.textContent = t('The text could not be read.'); box.hidden = false; }
          else announce(t('The text could not be read.'));
        } finally {
          if (btn?.isConnected) { btn.disabled = false; if (span) span.textContent = orig; }
        }
        return;
      }
      if (act === 'read-text') {
        // Image → OCR → clipboard + a Tier-2 text-signals read (source:'ocr', so no
        // byte-level artifacts - the panel says so).
        //
        // The READ is a WP-F background job (lib/ocr-job.ts): wasm inference over a
        // whole photo, plus a first-run model download, is exactly what the serial
        // heavy queue exists for, and the toast owns its progress and its cancel. The
        // pixels are still decoded HERE, while this asset is on screen; everything
        // after that outlives the modal.
        //
        // So every write below is guarded on THIS modal still being the open one:
        // the old `finally` restored a button that could already be detached (or,
        // after ←/→ paging, could belong to a different asset's modal). When the
        // surface is gone the durable half still runs - persistAiSignals writes the
        // verdict onto the asset's meta - and the announcement says where to find it.
        const box = dlg.querySelector<HTMLElement>('[data-tsig]');
        const btn = target.closest<HTMLButtonElement>('.cat-act-read-text');
        if (btn?.disabled) return; // an OCR run is already in flight - never start a second
        const span = btn?.querySelector('span');
        const orig = span?.textContent ?? t('Read text');
        // Disabled for the whole run (like the retry button's guard): a double-click
        // must not spin up two concurrent OCR passes over the same image.
        if (btn) btn.disabled = true;
        if (span) span.textContent = t('Reading…');
        /** Is the modal that started this read still the open one? */
        const alive = (): boolean => detailsDialog === dlg;
        const restore = (): void => {
          if (!alive()) return;
          if (btn) btn.disabled = false;
          if (span) span.textContent = orig;
        };
        const readFailed = (): void => {
          if (alive() && box) { box.textContent = t('The text could not be read.'); box.hidden = false; }
          else announce(t('The text could not be read.'));
        };
        let frame: { width: number; height: number; data: Uint8ClampedArray };
        try {
          frame = await rasterToOcrFrame(ref.url);
        } catch {
          readFailed();
          restore();
          return;
        }
        const { startOcrJob } = await import('../lib/ocr-job.ts');
        startOcrJob(host, { frame }, {
          onComplete: (result) => {
            void (async (): Promise<void> => {
              const text = result.text.trim();
              if (!text) {
                if (alive() && box) { box.textContent = t('No readable text was found.'); box.hidden = false; }
                else announce(t('No readable text was found.'));
                return;
              }
              const panel = analyzeVerifyText(text, 'ocr');
              if (alive()) {
                if (box) { box.innerHTML = `<pre class="cat-text-preview cat-text-ocr">${catHighlightHtml(text, panel.marks)}</pre>${catTextSignalsHtml(panel)}`; box.hidden = false; }
                // Announce what actually happened: the clipboard write can be refused
                // (permissions, unfocused document), and "copied" would then be a lie.
                let copied = true;
                try { await navigator.clipboard.writeText(text); } catch { copied = false; }
                announce(copied ? t('Text copied') : t('Text read. Copying to the clipboard was blocked.'));
              } else {
                // Nothing to paint into, and a clipboard write nobody asked for
                // any more would be a surprise - say where the result went instead.
                announce(t('The text was read. Open this asset again to see the result.'));
              }
              // Same persistence as Analyse text, marked 'ocr': the verdict came off
              // pixels, so only style signals ran - the note says which read it was.
              // This is the DURABLE half, so it runs whether or not the modal is open.
              await persistAiSignals(ref, panel, 'ocr');
            })();
          },
          onError: () => readFailed(),
          onSettled: restore,   // includes a cancel from the toast
        });
        return;
      }
      if (act === 'humanize') {
        // Fix characters: the deterministic on-device clean-up (no model) of
        // byte-level artifacts - leaked delimiters, invisible characters,
        // homoglyphs. Applies to the CURRENT working copy, so it composes with
        // edits already accepted; the report lists exactly what changed.
        const box = dlg.querySelector<HTMLElement>('[data-tsig]');
        try {
          const text = dTextContent ?? await (await fetch(ref.url)).text();
          dTextContent = text;
          const capped = text.length > 262144 ? text.slice(0, 262144) : text;
          if (dWorkBase == null) dWorkBase = capped;
          const result = humanizeText(dCleanedText ?? capped);
          dCleanedText = result.text;
          dHumanizeResult = result;
          dRewordAlts.clear();
          // The model tier's standing decides whether its affordances render and
          // whether the consent line names a download. Lazy import: the facade
          // (and everything behind it) stays off this view's chunk until the
          // panel is actually opened.
          try {
            const rw = await import('../lib/reworder.ts');
            dRewordStatus = await rw.rewordStatus();
            dRewordBytes = rw.rewordModelBytes();
          } catch { dRewordStatus = 'unstaged'; }
          // The panel analyses the FIXED text so only the style tells the
          // clean-up cannot fix remain highlighted (the byte-level ones are gone).
          renderTextPanel();
        } catch {
          if (box) { box.textContent = t('The characters in this text could not be fixed.'); box.hidden = false; }
        }
        return;
      }
      if (act === 'edit-card-close') { closeEditCard(); return; }
      if (act === 'reword-suggest' || act === 'reword-suggest-all') {
        // Tier 1: deterministic edits - the copy stays human-authored, no stamp.
        if (dCleanedText == null) return;
        if (act === 'reword-suggest') {
          const s = dSuggestions[Number(target.closest<HTMLElement>('[data-idx]')?.dataset.idx)];
          if (s) dCleanedText = applySuggestion(dCleanedText, s);
        } else {
          // Back to front so earlier indices stay valid (non-overlapping, sorted).
          for (let i = dSuggestions.length - 1; i >= 0; i--) dCleanedText = applySuggestion(dCleanedText, dSuggestions[i]!);
        }
        dRewordAlts.clear();
        renderTextPanel();
        return;
      }
      if (act === 'reword-span') {
        // Tier 2: sample raw candidates off-thread, then the ENGINE gate decides
        // what may be offered (rewordCandidates: normalise → clean → gate → rank).
        // Runs from the floating edit card: the button gives way to the shared
        // candy-stripe bar (the long-job language, inline - the user stays here).
        const btn = target.closest<HTMLButtonElement>('.cat-reword-go');
        const i = Number(btn?.dataset.idx);
        const span = dRewordSpans[i];
        if (dCleanedText == null || !btn || !span || btn.disabled) return;
        btn.disabled = true;
        btn.hidden = true;
        const prog = dCard?.querySelector<HTMLElement>('[data-card-progress]');
        const fill = dCard?.querySelector<HTMLElement>('[data-card-fill]');
        const label = dCard?.querySelector<HTMLElement>('[data-card-label]');
        if (prog) prog.hidden = false;
        try {
          const { rewordSentence } = await import('../lib/reworder.ts');
          const sentence = dCleanedText.slice(span.index, span.index + span.length);
          const req = rewordSentence(sentence, {
            onProgress: (p) => {
              if (fill) fill.style.width = `${Math.round(p.fraction * 100)}%`;
              if (label) {
                label.textContent = p.phase === 'download'
                  ? tRaw('Downloading the rewriter… {pct}%', { pct: Math.round(p.fraction * 100) })
                  : tRaw('Writing… {pct}%', { pct: Math.round(p.fraction * 100) });
              }
            },
          });
          const raws = await req.done;
          dRewordAlts.set(i, rewordCandidates(sentence, raws));
          dRewordStatus = 'ready';
          // Text unchanged, so no re-derive: refresh the card in place with the
          // alternatives (or the honest nothing-survived line).
          const anchor = dlg.querySelector<HTMLElement>(`[data-rw="${i}"]`);
          if (anchor) openEditCard(anchor, rwCardHtml(i));
          else { closeEditCard(); renderTextPanel(); }
        } catch {
          if (prog) prog.hidden = true;
          btn.disabled = false;
          btn.hidden = false;
          if (label) label.textContent = '';
          announce(t('The rewriter could not run.'));
        }
        return;
      }
      if (act === 'reword-use') {
        // Accepting a MODEL candidate: from here on the copy is AI-assisted and
        // the save stamps it (the humanize provenance rule).
        const el = target.closest<HTMLElement>('[data-act="reword-use"]');
        const span = dRewordSpans[Number(el?.dataset.idx)];
        const alt = dRewordAlts.get(Number(el?.dataset.idx))?.[Number(el?.dataset.alt)];
        if (dCleanedText != null && span && alt) {
          dCleanedText = dCleanedText.slice(0, span.index) + alt.text + dCleanedText.slice(span.index + span.length);
          dModelTouched = true;
          dRewordAlts.clear();
          renderTextPanel();
        }
        return;
      }
      if (act === 'copy-clean') {
        const btn = target.closest<HTMLElement>('.cat-act-copy-clean');
        if (dCleanedText != null) {
          try {
            await navigator.clipboard.writeText(dCleanedText);
            const s = btn?.querySelector('span');
            if (s) s.textContent = t('Copied!'); btn?.classList.add('is-copied');
            setTimeout(() => { if (s) s.textContent = t('Copy cleaned text'); btn?.classList.remove('is-copied'); }, 1200);
          } catch { announce(t('That text could not be copied.')); }
        }
        return;
      }
      if (act === 'save-clean') {
        // Save the cleaned text as a NEW user text asset through the ordinary
        // ingest path, which re-runs the AI-signal analysis on the cleaned bytes -
        // so the saved copy carries its own (usually calmer) aiSignals note. Works
        // on library text too: the new asset is the user's own copy. Deterministic
        // clean-up, so no genAI stamp (the humanize provenance rule).
        const btn = target.closest<HTMLButtonElement>('.cat-act-save-clean');
        if (dCleanedText != null && btn && !btn.disabled) {
          btn.disabled = true;
          try {
            const rawName = typeof ref.meta?.name === 'string' && ref.meta.name ? ref.meta.name : (ref.id.split('/').pop() ?? 'text');
            const base = rawName.replace(/\.[a-z0-9]+$/i, '');
            const ext = ref.format && /^[a-z0-9]{1,10}$/i.test(ref.format) ? ref.format : 'txt';
            const mime = ext === 'md' || ext === 'markdown' ? 'text/markdown' : 'text/plain';
            const suffix = dModelTouched ? 'reworded' : 'cleaned';
            const saved = await storeUserUpload(host as unknown as PickerHost, new File([dCleanedText], `${base}-${suffix}.${ext}`, { type: mime }));
            if (dModelTouched) {
              // A model wrote some of these sentences (plans/127): stamp the AI
              // origins the way the declare action does - aiGenerated:'partial'
              // rides the download/export path as a C2PA ingredient, and the
              // meta records the flag plus where the copy came from. The
              // deterministic-only save keeps today's no-stamp behaviour (the
              // humanize provenance rule).
              await host.assets._updateUserAssetMeta(
                saved.id,
                { ...(saved.meta ?? {}), aiOriginsDeclared: true, rewordedFrom: ref.id },
                { aiGenerated: 'partial' },
              );
              announce(t('Reworded text saved to your uploads and flagged as AI-assisted.'));
            } else {
              announce(t('Cleaned text saved to your uploads.'));
            }
            // The working copy is now a real asset - the pill's claim is over.
            const pill = dlg.querySelector<HTMLElement>('[data-unsaved]');
            if (pill) pill.hidden = true;
            if (mounted) { await reload(); if (mounted) rerender(); }
          } catch {
            announce(t('The cleaned text could not be saved.'));
            btn.disabled = false;
          }
        }
        return;
      }
      if (act === 'origin-full' || act === 'origin-partial' || act === 'origin-clear') {
        // The Origins control: the user asserting what they know about how this
        // asset was made (or withdrawing that assertion - never a claim that it
        // is NOT AI; absence stays honest silence). Same safe read-then-merge as
        // declare-ai-origins; null clears the record-level flag, and an asset
        // whose C2PA credential itself declares AI re-derives on the next list -
        // the signed file outranks a mistaken clearing.
        if (!isUser) return;
        const kind = act === 'origin-full' ? 'full' as const : act === 'origin-partial' ? 'partial' as const : null;
        try {
          const recs = await host.assets._exportUserAssets();
          const rec = recs.find((r) => r.id === ref.id);
          if (!rec) return;
          const meta: Record<string, unknown> = { ...(rec.meta ?? {}) };
          if (kind) meta.aiOriginsDeclared = true; else delete meta.aiOriginsDeclared;
          await host.assets._updateUserAssetMeta(ref.id, meta, { aiGenerated: kind });
          const local: Record<string, unknown> = { ...meta };
          if (kind) local.aiGenerated = kind; else delete local.aiGenerated;
          ref.meta = local as typeof ref.meta;
          renderOrigins();
          reflectGenAiInPlace(ref);
          announce(kind ? t('Origins declared. It travels with the asset.') : t('Origins declaration removed.'));
        } catch { announce(t('Could not update origins.')); }
        return;
      }
      if (act === 'declare-ai-origins') {
        // No model ran, so nothing is auto-stamped. This is the user CHOOSING to flag AI
        // origins honestly. Maps to aiGenerated:'partial', which the download/export path
        // already carries as a C2PA ingredient, so it follows the asset where used. A safe
        // read-then-merge via _updateUserAssetMeta keeps every other field intact - a
        // meta-level annotation, so no quota metering and no pin-preserve run.
        const btn = target.closest<HTMLElement>('.cat-act-declare-ai');
        try {
          const recs = await host.assets._exportUserAssets();
          const rec = recs.find((r) => r.id === ref.id);
          if (rec) {
            await host.assets._updateUserAssetMeta(ref.id, { ...rec.meta, aiOriginsDeclared: true }, { aiGenerated: 'partial' });
            // The toolbar button keeps its icon (label lives in a <span>); the
            // text-panel note button is bare text.
            if (btn) {
              const label = btn.querySelector('span');
              if (label) label.textContent = t('AI origins flagged');
              else btn.textContent = t('AI origins flagged');
              btn.setAttribute('disabled', '');
            }
            announce(t('Flagged as having AI origins. It travels with the asset.'));
          }
        } catch { announce(t('Could not flag AI origins.')); }
        return;
      }
      if (act === 'add-to-project') { await addToProject([ref.id]); return; }
      // Mobile toolbar: the EDIT row folds behind this expander under 860px.
      if (act === 'toggle-edit') {
        const actions = dlg.querySelector<HTMLElement>('.cat-details-actions');
        const btn = target.closest<HTMLElement>('.cat-act-more');
        const open = actions?.classList.toggle('is-edit-open') ?? false;
        btn?.setAttribute('aria-expanded', String(open));
        return;
      }
      // "Download as" (text assets): a format menu anchored to its toolbar button,
      // mounted inside THIS dialog. The items carry data-act="dl-text", so their
      // clicks bubble to this same dispatcher - the menu is pure presentation.
      if (act === 'dl-as') {
        const anchor = dlg.querySelector<HTMLElement>('.cat-act-dl-as');
        if (!anchor) return;
        if (dlAsPopover?.isOpen()) { dlAsPopover.close(); return; }
        if (!dlAsPopover) {
          const { mountBodyPopover } = await import('../components/body-popover.ts');
          const fmts: [string, string][] = [
            ['raw', String(ref.format || 'txt').toUpperCase()],
            ['html', 'HTML'], ['rtf', 'RTF'], ['docx', 'DOCX'], ['odt', 'ODT'],
          ];
          dlAsPopover = mountBodyPopover(anchor, (el, popover) => {
            el.innerHTML = fmts.map(([v, l]) =>
              `<button type="button" class="cat-dl-as-item" data-act="dl-text" data-fmt="${escape(v)}">${escape(l)}</button>`).join('');
            // Let the item click bubble to this dispatcher first, then fold the menu.
            el.addEventListener('click', (ev) => {
              if ((ev.target as HTMLElement | null)?.closest('[data-act="dl-text"]')) setTimeout(() => popover.close(false), 0);
            });
            return el.querySelector<HTMLElement>('button');
          }, { className: 'cat-dl-as-menu', ariaLabel: tRaw('Download as'), container: dlg });
        }
        dlAsPopover.open();
        return;
      }
      // Crop stays IN this detail modal - an inline mode over the current preview, not a
      // separate dialog - so it must be handled before the closeDetails() below.
      if (act === 'crop') { await enterInlineCrop(); return; }
      // Trim is the same shape: the offer card mounts in this body, under the actions.
      if (act === 'trim') { await enterInlineTrim(); return; }
      // Retouch too: the brush stage takes over THIS preview (plan 124 WP-E).
      if (act === 'retouch') {
        try { await enterInlineRetouch(); }
        catch (err) { host.log('error', 'Retouch failed', { id: ref.id, error: String(err) }); }
        return;
      }
      // Still grade: the look is chosen AT the image (the video Grade rule), and
      // Apply enqueues a background job so the toast owns progress over this modal.
      if (act === 'grade') {
        try { await enterInlineGrade(); }
        catch (err) { host.log('error', 'Grade failed', { id: ref.id, error: String(err) }); }
        return;
      }
      // Crop, Grade and Trim are three tabs of one inline video mode (plans/130) - the
      // stage becomes a paused frame with a crop box on it and a scrub bar under it, so
      // none of them leaves this detail context. Crop moved here from the video-job
      // dialog: framing a picture over four number fields was never the way to ask.
      if (act === 'vid-grade' || act === 'vid-trim' || act === 'vid-crop') {
        try { await enterInlineVideoEdit(act === 'vid-trim' ? 'trim' : act === 'vid-crop' ? 'crop' : 'grade'); }
        catch (err) { host.log('error', 'Video edit failed', { id: ref.id, error: String(err) }); }
        return;
      }
      // The remaining actions leave this asset's detail context, so close first.
      closeDetails();
      // A 3-D model opens in the 3D tool; a LUT opens in the Darkroom, preselected.
      // Each maps the asset id's tail to the tool's own preset key (lolly/3d/duck →
      // model=duck; lolly/luts/suse7-slog3-heavy → lutPreset=suse7-slog3-heavy).
      if (act === 'open-3d') {
        window.location.hash = `#/tool/3d?model=${encodeURIComponent(ref.id.split('/').pop() ?? '')}`;
        return;
      }
      if (act === 'open-lut') {
        window.location.hash = `#/tool/darkroom?lutSource=preset&lutPreset=${encodeURIComponent(ref.id.split('/').pop() ?? '')}&lutIntensity=100`;
        return;
      }
      // A generated clip re-opens on its own script. The asset id is the whole
      // deep link: the studio reads the recipe off the record, so nothing about
      // the clip has to survive a URL.
      if (act === 'edit-script') {
        window.location.hash = `#/script?asset=${encodeURIComponent(ref.id)}`;
        return;
      }
      if (act === 'download') {
        await openAssetDownloadDialog(ref, dTheme, dTreatment);
      }
      else if (act === 'send') { await openSendDialog(ref); }
      else if (act === 'darkroom') {
        // Refined edits happen in the Darkroom tool, seeded with THIS image. The
        // asset input takes the library id straight off the URL; every other input
        // stays at its (all-off) default except the house look at a light touch -
        // the SUSE7 LUT at 25% (Andy, 2026-08-20).
        window.location.hash = `#/tool/darkroom?image=${encodeURIComponent(ref.id)}&lutSource=preset&lutPreset=suse7-slog3-heavy&lutIntensity=25`;
      }
      else if (act === 'upscale') {
        // Enlarge THIS asset on-device. The dialog validates, consents and decodes, then
        // starts a WP-F background JOB and closes - so nothing here waits on the model,
        // and the toast owns progress and cancellation. The saved copy carries the
        // source's Content Credential forward as an ingredient (with the Gen-AI flag
        // intact), so an AI image keeps its provenance. onComplete refreshes a still-open
        // catalog and says which asset landed; no modal opens itself over the user.
        try {
          const { openUpscaleDialog } = await import('./upscale-dialog.ts');
          await openUpscaleDialog(host as unknown as UpscaleHost, {
            source: ref, sourceName: name,
            onComplete: (made) => {
              if (!mounted) return;
              void reload().then(() => {
                if (!mounted) return;
                rerender();
                announce(tRaw('{name} is ready in your uploads.', { name: (made.meta?.name as string | undefined) ?? name }));
              });
            },
          });
        } catch (err) {
          host.log('error', 'Upscale failed', { id: ref.id, error: String(err) });
        }
        openDetails(ref); // the run is in the background - restore the asset the user was inspecting
      }
      else if (act === 'matte') {
        // Cut THIS asset out on-device. Same shape as Upscale above and the video ops
        // below: the dialog validates, consents and decodes, then starts a WP-F
        // background JOB and closes, so nothing here waits on the model and the toast
        // owns progress and cancellation. The cutout carries the source's Content
        // Credential forward as an ingredient (with the Gen-AI flag intact), so an AI
        // image keeps its provenance. onComplete refreshes a still-open catalog and
        // says which asset landed; no modal opens itself over the user.
        try {
          const { openMatteDialog } = await import('./matte-dialog.ts');
          await openMatteDialog(host as unknown as MatteHost, {
            source: ref, sourceName: name,
            onComplete: (made) => {
              if (!mounted) return;
              void reload().then(() => {
                if (!mounted) return;
                rerender();
                announce(tRaw('{name} is ready in your uploads.', { name: (made.meta?.name as string | undefined) ?? name }));
              });
            },
          });
        } catch (err) {
          host.log('error', 'Background removal failed', { id: ref.id, error: String(err) });
        }
        openDetails(ref); // the run is in the background - restore the asset the user was inspecting
      }
      else if (act === 'extract-audio') {
        // Decode THIS video's sound track on-device and save it as an audio user asset
        // (its own derived asset - no 'renders' tag). Same shape as Upscale and Matte
        // above: the dialog picks a format, starts a WP-F background JOB and closes, so
        // nothing here waits on a whole-file decode and the toast owns progress and
        // cancellation. The source video's own Content Credential rides forward as an
        // ingredient. onComplete refreshes a still-open catalog and says which asset
        // landed; no modal opens itself over the user.
        try {
          const { openExtractAudioDialog } = await import('../lib/extract-audio.ts');
          await openExtractAudioDialog(host as unknown as ExtractAudioHost, {
            source: ref, sourceName: name,
            ...(ref.meta?.aiGenerated === 'full' || ref.meta?.aiGenerated === 'partial' ? { aiGenerated: ref.meta.aiGenerated } : {}),
            onComplete: (made) => {
              if (!mounted) return;
              void reload().then(() => {
                if (!mounted) return;
                rerender();
                announce(tRaw('{name} is ready in your uploads.', { name: (made.meta?.name as string | undefined) ?? name }));
              });
            },
          });
        } catch (err) {
          host.log('error', 'Extract audio failed', { id: ref.id, error: String(err) });
        }
        openDetails(ref); // the run is in the background - restore the asset the user was inspecting
      }
      else if (act === 'vid-matte' || act === 'vid-upscale') {
        // Process THIS video on-device (background-remove / upscale). Both are model runs
        // with no framing decision in them, so they stay in the shared dialog: it starts a
        // WP-F background job and closes; the result lands as a plain derived user asset
        // (no 'renders' tag) with container-level C2PA, the source video carried as an
        // ingredient. onComplete refreshes a still-open catalog.
        const op = act === 'vid-matte' ? 'matte' : 'upscale';
        try {
          const { openVideoJobDialog } = await import('./video-job-dialog.ts');
          await openVideoJobDialog(host as unknown as VideoJobHost, {
            op, source: ref, sourceName: name,
            ...(ref.meta?.aiGenerated === 'full' || ref.meta?.aiGenerated === 'partial' ? { aiGeneratedSource: ref.meta.aiGenerated } : {}),
            onComplete: () => { if (mounted) { void reload().then(rerender); } },
          });
        } catch (err) {
          host.log('error', 'Video job failed', { id: ref.id, error: String(err) });
        }
        openDetails(ref); // restore the asset the user was inspecting
      }
      else if (act === 'recategorise') await recategorise(ref);
      else if (act === 'replace') await replaceUserAsset(ref);
      else if (act === 'rename') await renameUserAsset(ref);
      else if (act === 'edit-tags') { await editTags([ref]); openDetails(assetById.get(ref.id) ?? ref); }
      else if (act === 'hide') await setHidden(base, true);
      else if (act === 'unhide') await setHidden(base, false);
      else if (act === 'delete') await deleteUserAsset(ref);
      else if (act === 'verify' || act === 'verify-ai') await checkCredentials(ref);
    });
    // ← / → page through assets (lightbox style), like the on-screen prev/next buttons.
    dlg.addEventListener('keydown', (e) => {
      // In crop mode Escape backs out of the crop, not the whole modal: preventDefault
      // suppresses the native <dialog> close request (the close-watcher only fires when the
      // Escape keydown wasn't cancelled), and paging is disabled so it can't tear down the crop.
      if (inlineCrop) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); inlineCrop(); }
        return;
      }
      // Same convention for Retouch: Escape backs out of the MODE - unless a
      // save is committing, which must never be torn down mid-write.
      if (inlineRetouch) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (!inlineRetouch.busy()) inlineRetouch.exit(); }
        return;
      }
      // And for the video Grade/Trim mode - busy() covers the beat between the Apply
      // click and the job being enqueued, which must not be torn down half-made.
      if (inlineVideoEdit) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (!inlineVideoEdit.busy()) inlineVideoEdit.exit(); }
        return;
      }
      // With a trim card up, paging is off for the same reason: it would tear the card
      // down mid-question. Its Escape is handled by the card itself (and cancelled in
      // the capture listener enterInlineTrim arms), so nothing to do here.
      if (inlineTrim) return;
      if (e.key === 'ArrowLeft' && nav.prev) { e.preventDefault(); openDetails(nav.prev, dTheme, dTreatment); }
      else if (e.key === 'ArrowRight' && nav.next) { e.preventDefault(); openDetails(nav.next, dTheme, dTreatment); }
    });
    // Touch parity with ←/→: a single-finger horizontal swipe on the preview pages
    // prev/next, so phone/tablet users skip through a large set as fast as keyboard
    // users. Skipped while an inline edit mode owns the surface, and when the zoom
    // stage is zoomed IN (there a drag pans - attachZoom marks it .is-zoomed).
    // Passive: it never preventDefaults, so vertical scroll (e.g. the swatch card)
    // and pinch-zoom still work; the horizontal-dominance test keeps the two apart.
    const swipeEl = dlg.querySelector<HTMLElement>('.cat-details-preview');
    if (swipeEl && (nav.prev || nav.next)) {
      let sx = 0, sy = 0, armed = false;
      swipeEl.addEventListener('touchstart', (e) => {
        const p = e.touches[0];
        armed = e.touches.length === 1 && !!p && !inlineCrop && !inlineRetouch && !inlineVideoEdit && !inlineTrim;
        if (p) { sx = p.clientX; sy = p.clientY; }
      }, { passive: true });
      swipeEl.addEventListener('touchend', (e) => {
        const p = e.changedTouches[0];
        if (!armed || e.changedTouches.length !== 1 || !p) return;
        armed = false;
        if (dlg.querySelector('.cat-zoom-stage.is-zoomed')) return;   // zoomed ⇒ the drag panned
        const dx = p.clientX - sx;
        const dy = p.clientY - sy;
        if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;   // not a clean horizontal swipe
        const r = dx < 0 ? nav.next : nav.prev;   // swipe left → next, right → prev
        if (r) openDetails(r, dTheme, dTreatment);
      }, { passive: true });
    }
    if (zoomable) attachZoom(dlg);
    // Mount the looping Lottie player over the poster (autoplays). Guarded so a mount that resolves
    // after the modal was paged/closed doesn't attach to a stale node; closeDetails reaps it.
    if (isMotionLottie) {
      const motionEl = dlg.querySelector<HTMLElement>('.cat-thumb-motion');
      if (motionEl) void mountLottieMarker(motionEl, { isCurrent: () => detailsDialog === dlg });
    }
    // Audio preview: render a zzfxm song to a WAV blob (codec-independent - plays in any
    // browser), and surface a clear note if an encoded file's format is unsupported.
    const audioEl = dlg.querySelector<HTMLAudioElement>('[data-audio-preview]');
    if (audioEl) {
      const note = audioEl.parentElement?.querySelector<HTMLElement>('.cat-audio-note');
      audioEl.addEventListener('error', () => {
        if (note && !audioEl.dataset.wavBlob) { note.textContent = t('This audio format isn’t supported by your browser.'); note.hidden = false; }
      });
      // zzfxm songs and tracker modules both render to a WAV blob (codec-independent);
      // the only difference is which renderer decodes the source.
      const zzUrl = audioEl.dataset.zzfxmUrl;
      const modUrl = audioEl.dataset.modUrl;
      const render = zzUrl ? songUrlToWavBlobUrl(zzUrl) : modUrl ? modUrlToWavBlobUrl(modUrl) : null;
      if (render) {
        void render
          .then((wav) => { if (detailsDialog === dlg) { audioEl.dataset.wavBlob = wav; audioEl.src = wav; } else URL.revokeObjectURL(wav); })
          .catch(() => { if (note) { note.textContent = t('Couldn’t render this track.'); note.hidden = false; } });
      }
      // The big preview meter: attaches its analyser on first play (a gesture, so the
      // shared AudioContext may run) and is disposed with the modal (closeDetails).
      const meterEl = dlg.querySelector<HTMLCanvasElement>('[data-audio-meter]');
      if (meterEl) detailsMeterDispose = attachAudioMeter(meterEl, audioEl);
      detailsTransport = wireAudioTransport(dlg, audioEl, {
        play: t('Play'), pause: t('Pause'), seek: t('Seek'),
        mute: t('Mute'), unmute: t('Unmute'), volume: t('Volume'),
      });
      wireAudioViz(dlg, ref, detailsMeterDispose);
      // The resting art was built synchronously from whatever peaks were already in
      // memory - which on a cold open is none, so the stage showed the glyph instead of
      // this track's waveform. Measure it now (one asset, deliberately opened) and swap
      // the art in when it lands.
      // Measure this track so the panel art is its real waveform: audioCardArt reads
      // peaks already in memory, which on a cold open is none.
      void derivePeaks(host, ref, ref.id).then((r) => {
        const art = dlg.querySelector<HTMLElement>('[data-audio-art]');
        if (r && art && detailsDialog === dlg) art.innerHTML = audioCardArt(ref);
      }).catch(() => {});
    }
  }

  /**
   * The audio surface's escalation ladder: bars analyser → visualiser → immersive, with
   * "use as cover" as the commit at any rung.
   *
   * Deliberately NOT a swatch picker. The thing a user wants to say is "keep what I am
   * looking at", so the chooser IS the viewer - you audition the track, flip through
   * looks while it plays, and pin the one you like. That also means there is nothing
   * extra to learn: it is the Neurospicy player's interaction, in the place where you
   * are already listening to the file.
   *
   * MilkDrop needs its audio INJECTED (per-frame time-domain windows), so the wave
   * payload is decoded once, lazily, only when someone actually opens the visualiser - 
   * a details modal is a deliberate act, unlike a grid of tiles.
   */
  /**
   * The audio stage: an ANALYSER, or a live MilkDrop visualiser. Tap the picture to
   * swap between them - the Neurospicy player's interaction, in the place you are
   * already listening.
   *
   * The drawn waveform shapes are deliberately NOT offered here. They are the GRID's
   * job - the free, always-available default every tile falls back to - and carrying
   * them into this surface as extra rungs bought nothing but bugs: two rendering paths
   * sharing one box, one live and one static, each with its own sizing and teardown.
   * One live surface, one still one, and nothing in between.
   *
   * "Use as cover" SNAPSHOTS THE CURRENT FRAME. Not a re-render, not a deterministic
   * bake from the preset id - the pixels on screen at the moment of the click. That is
   * what the user is looking at and pointing at, and any re-render is a different frame
   * of a feedback simulation, i.e. a different picture. The preset and colour ride along
   * so the cover can still be re-made later, but the image is what was seen.
   */
  function wireAudioViz(dlg: HTMLElement, ref: AssetRef, meterHandle: import('../lib/audio-meter.ts').MeterHandle | null): void {
    const stage = dlg.querySelector<HTMLElement>('[data-audio-stage]');
    const toggle = dlg.querySelector<HTMLButtonElement>('[data-viz-toggle]');
    const vizEl = dlg.querySelector<HTMLElement>('[data-audio-viz]');
    const bar = dlg.querySelector<HTMLElement>('[data-audio-vizbar]');
    const nameEl = dlg.querySelector<HTMLElement>('[data-viz-name]');
    if (!stage || !toggle || !vizEl || !bar) return;

    let presets: Array<{ id: string; label: string; luma?: number }> = [];
    let at = 0;
    let open = false;
    // The full handle, not just `destroy`: applyPreset needs setPreset/setRawPreset and
    // the live palette to wrap an artist preset with.
    let handle: VizHandle | null = null;
    let canvas: HTMLCanvasElement | null = null;
    // Which brand colour the visualiser is wearing. Shuffled independently of the preset,
    // so form and colour are two dials rather than one.
    let colourAt = coverMap.get(assetBaseId(ref.id))?.colour ?? 0;

    /** The colour the visualiser is currently "about" - the 🎨 dial's value. */
    const heroNow = (): string | null =>
      coverPool.length ? coverPool[colourAt % coverPool.length]! : null;

    const label = (): void => {
      if (!nameEl) return;
      nameEl.textContent = presets.length ? `${presets[at]!.label}  ·  ${at + 1}/${presets.length}` : '';
    };

    /** Mount (or re-mount) the live visualiser on the current preset + colour. */
    /**
     * Put `id` on `h`: our own presets by id, artist presets by fetching the JSON and
     * wrapping it with the brand blend. Mirrors viz-overlay's applyStockPreset - same
     * fallback, so a clone without the staged pack still shows a working visualiser
     * rather than a black square.
     */
    const applyPreset = async (h: NonNullable<typeof handle>, id: string): Promise<void> => {
      if (!id.startsWith('stock:')) { h.setPreset(id); return; }
      const { loadStockPreset } = await import('../lib/viz-stock.ts');
      const { vizPresetById } = await import('../lib/viz-presets.ts');
      const preset = await loadStockPreset(id.slice(6), h.palette(), 'strong');
      // The modal can have been closed or the preset stepped past during that fetch.
      if (handle !== h) return;
      if (!preset) { h.setPreset(vizPresetById(null).id); return; }
      h.setRawPreset(id, preset);
    };

    const mountLive = async (): Promise<void> => {
      if (!presets.length) return;
      handle?.destroy(); handle = null;
      canvas = document.createElement('canvas');
      canvas.className = 'cat-viz-canvas';
      vizEl.replaceChildren(canvas);
      // Device pixels: butterchurn renders to exactly the size it is told, so a mismatch
      // between the buffer and the element puts the picture in a corner.
      const box = vizEl.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(box.width * dpr));
      canvas.height = Math.max(1, Math.round(box.height * dpr));
      const [{ mountViz }, { buildVizPalette }] = await Promise.all([
        import('../lib/butterchurn-viz.ts'),
        import('../lib/viz-palette.ts'),
      ]);
      // The SAME AnalyserNode the meter owns - an <audio> element can only ever produce
      // one MediaElementSource and can never lose it, so a second would throw and leave
      // the preview silent.
      //
      // But the meter only BUILDS its analyser on first play, so flipping to the
      // visualiser before pressing play left `analyser` null, and mountViz refuses that
      // (`!analyser && !inject`) - it returned null and the canvas was replaced by a
      // glyph. Hence the fallback: with no live signal, inject SILENCE so the preset
      // still mounts and draws its idle field. A visualiser that shows nothing until you
      // happen to press play looks broken; one that is calm until the music starts does
      // not.
      const live = meterHandle?.analyser() ?? null;
      const silence = new Uint8Array(1024).fill(128);   // 128 = zero amplitude
      // Pass the chosen colour as an EXPLICIT hero hint rather than shuffling it to the
      // front of the values. Without a hint, buildVizPalette re-derives a hero from the
      // swatches - and that is the documented navy-field trap: SUSE's pine sits a
      // thousandth under the chroma gate that keeps greys out, so it is dismissed and the
      // most-chromatic swatch (waterhole blue) wins, rendering the whole field navy. The
      // hint IS what the 🎨 dial means: "make it about this colour".
      handle = await mountViz(canvas, undefined, presets[at]!.id, undefined, buildVizPalette(coverPool, heroNow()), {
        audio: live ? { analyser: live } : { frame: () => ({ wave: silence, seed: 0 }) },
        // preserveDrawingBuffer, so "use as cover" can read the frame that is on screen.
        // Without it toBlob returns an empty buffer.
        capture: true,
      });
      if (!handle) { vizEl.innerHTML = audioThumbPlaceholder({}); label(); return; }
      // An ARTIST preset is not in our registry, so it cannot be mounted by id: mountViz
      // resolves through vizPresetById, which falls back to VIZ_PRESETS[0] for anything it
      // does not recognise. That fallback is silent and it is total - every one of the 435
      // artist presets rendered as the same brand-native preset, the label happily naming
      // a different one each time. It reads exactly like "the shuffle does nothing and it
      // is always the same dim picture", with no error to follow. Artist presets have to
      // be FETCHED and handed over as objects, the way the dock does it.
      await applyPreset(handle, presets[at]!.id);
      label();
    };

    const show = async (on: boolean): Promise<void> => {
      // Load BEFORE painting anything. Painting first is what broke the toggle: with no
      // presets yet, the label/mount path dereferenced an empty list and threw, so the
      // click handler died and the surface never flipped.
      if (on && !presets.length) await loadPresets();
      if (on && !presets.length) {
        // Say so. Returning quietly here is exactly what made the toggle, the shuffle,
        // the palette and "use as cover" all appear broken at once - one silent gate,
        // four dead controls, no way to tell which.
        const note = dlg.querySelector<HTMLElement>('.cat-audio-note');
        if (note) {
          note.textContent = t('The visualiser needs WebGL2, which this browser isn’t providing.');
          note.hidden = false;
        }
        return;
      }

      open = on;
      vizEl.hidden = !on;
      bar.hidden = !on;
      toggle.setAttribute('aria-pressed', String(on));
      toggle.textContent = on ? t('Analyser') : t('Visualiser');
      const meter = meterElOf(dlg);
      if (meter) meter.hidden = on;
      if (!on) { cycle.stop(); handle?.destroy(); handle = null; return; }
      pickOpening();
      // Start the track. The flip is a user gesture, so autoplay policy allows it, and
      // it is also what builds the meter's analyser - which the visualiser then shares.
      const audioEl = audioElOf(dlg);
      if (audioEl?.paused) {
        try {
          await audioEl.play();
          // The analyser is created inside the meter's own 'play' handler, so yield once
          // and let it land before mounting; otherwise we mount against silence and stay
          // there until the next re-mount.
          await new Promise(r => setTimeout(r, 60));
        } catch { /* blocked or unplayable - mount against silence below */ }
      }
      await mountLive();
      cycle.start();
    };

    /** The presets on offer: ours first (brand-native, eval-free), then every artist
     *  preset VERIFIED to render - the 31 measured black or blown-out are excluded, since
     *  one of those as cover art reads as a broken app. */
    const loadPresets = async (): Promise<void> => {
      const { canBakeViz } = await import('../lib/audio-cover-viz.ts');
      if (!canBakeViz()) return;
      const [{ VIZ_PRESETS }, { stockPresetIndex }] = await Promise.all([
        import('../lib/viz-presets.ts'),
        import('../lib/viz-stock.ts'),
      ]);
      // Lead with a preset that READS on a card. The GPU audit measured our own set's
      // mean luminance - bloom 56, aurora 49, vortex 34, kaleido 11, pulse 9 - so opening
      // on `pulse` (the declaration order) hands someone a near-black picture and looks
      // broken. The audiogram's default was moved for the same reason.
      const OPENERS = ['bloom', 'aurora', 'vortex', 'solar'];
      // Our own presets are all comfortably readable (the GPU audit put the dimmest,
      // `pulse`, at 9 - but it is excluded from OPENERS for exactly that reason), so they
      // carry no luma and count as openable.
      const own = VIZ_PRESETS.map(d => ({ id: d.id, label: d.name, luma: undefined as number | undefined }));
      own.sort((a, b) => {
        const ia = OPENERS.indexOf(a.id), ib = OPENERS.indexOf(b.id);
        return (ia < 0 ? OPENERS.length : ia) - (ib < 0 ? OPENERS.length : ib);
      });
      presets = own;
      const stock = (await stockPresetIndex().catch(() => []))
        .filter(p => p.ok !== false)
        .sort((a, b) => (a.tier ?? 9) - (b.tier ?? 9));
      for (const p of stock) {
        // Don't repeat the author when the converted NAME already carries it - a handful
        // of preset filenames have no " - " separator, so the whole string stayed in
        // `name` and appending the author again gave "X Trail_of_darkness · X".
        const dupe = p.author && p.name.toLowerCase().startsWith(p.author.toLowerCase());
        presets.push({
          id: `stock:${p.id}`,
          label: p.author && !dupe ? `${p.name} · ${p.author}` : p.name,
          luma: p.luma,
        });
      }
      // (The opening preset is chosen per FLIP, in pickOpening - not here. Choosing it at
      // load time meant only the first flip was ever random, because the list is loaded
      // once and every later flip reused wherever `at` had been left.)
    };

    /**
     * Where a flip-in lands: RANDOM every time, so the range actually gets seen. With 435
     * presets, opening on the same one is the difference between a pack and a picture.
     *
     * But random over ALL of them is not the same as a good first impression. A fifth of
     * the presets measure under READABLE_LUMA - sparse wireframes on black, which are
     * fine once chosen and read as "it didn't start" when handed to you unasked. So the
     * OPENING draw is restricted to the ones that read, while ‹ › and the dice still
     * traverse everything: this weights the default, it does not hide anything.
     *
     * A saved cover wins over both, because that is a deliberate choice, not a default - 
     * including a dim one, which someone is perfectly entitled to have picked.
     */
    const READABLE_LUMA = 25;
    const pickOpening = (): void => {
      if (!presets.length) return;
      const saved = vizPresetOf(coverMap.get(assetBaseId(ref.id)));
      if (saved) {
        const i = presets.findIndex(p => p.id === saved || p.id === `stock:${saved}`);
        if (i >= 0) { at = i; return; }
      }
      // Unmeasured counts as readable - absence of a measurement is not evidence of a
      // dark preset, and an index staged before luma existed must not empty this pool.
      const bright: number[] = [];
      for (let i = 0; i < presets.length; i++) {
        const l = presets[i]!.luma;
        if (l === undefined || l >= READABLE_LUMA) bright.push(i);
      }
      const pool = bright.length ? bright : presets.map((_, i) => i);
      at = pool[Math.floor(Math.random() * pool.length)]!;
    };

    const step = (delta: number): void => {
      if (!presets.length) return;
      at = (at + delta + presets.length) % presets.length;
      cycle.kick();
      void mountLive();
    };

    const cycle = createVizCycle({
      // Only while the visualiser is on screen and the track is playing: a paused preview
      // is a still field, so rotating it just churns the GPU.
      shouldRun: () => open && !audioElOf(dlg)?.paused,
      onTick: () => step(1),
    });
    vizCycleStop = () => cycle.stop();

    const flip = (): void => { void show(!open); };
    toggle.addEventListener('click', flip);
    meterElOf(dlg)?.addEventListener('click', flip);
    meterElOf(dlg)?.addEventListener('keydown', (e) => {
      const k = (e as KeyboardEvent).key;
      if (k === 'Enter' || k === ' ') { e.preventDefault(); flip(); }
    });
    vizEl.addEventListener('click', flip);

    dlg.querySelector('[data-viz-prev]')?.addEventListener('click', (e) => { e.stopPropagation(); step(-1); });
    dlg.querySelector('[data-viz-next]')?.addEventListener('click', (e) => { e.stopPropagation(); step(1); });
    dlg.querySelector('[data-viz-shuffle]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      // Random, not next: with hundreds of presets, stepping is a poor way to discover.
      if (presets.length > 1) { let n = at; while (n === at) n = Math.floor(Math.random() * presets.length); at = n; }
      cycle.kick();
      void mountLive();
    });
    dlg.querySelector('[data-viz-colour-shuffle]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      // Colour is its OWN dial: shuffling it keeps the preset you are enjoying and only
      // re-skins it, which is the whole reason the two are separate controls.
      if (coverPool.length > 1) colourAt = (colourAt + 1) % coverPool.length;
      void mountLive();
    });

    dlg.querySelector('[data-viz-cover]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      void snapCover();
    });

    /**
     * Freeze the frame currently on screen and keep it as this asset's cover.
     *
     * Reads the LIVE canvas rather than re-rendering: MilkDrop is a feedback simulation,
     * so a re-render is a different frame - the user pointed at THIS picture, and any
     * other one would be a substitution they did not ask for.
     */
    const snapCover = async (): Promise<void> => {
      if (!canvas || !presets.length) return;
      const blob = await new Promise<Blob | null>(res => canvas!.toBlob(res, 'image/webp', 0.92));
      if (!blob) return;
      // The BARE id, with no `stock:` prefix - the one canonical form. The stored cover
      // has always been bare (vizPresetOf strips it), and the grid looks its bake up with
      // that same bare id, so keying the bake by the prefixed id wrote a record nothing
      // ever read: every artist cover baked correctly and then showed as an empty tile.
      const preset = presets[at]!.id.replace(/^stock:/, '');
      const base = assetBaseId(ref.id);
      const { bakeKey, brandKeyFor, putBake, dropBakes } = await import('../lib/audio-cover-bake.ts');
      // Clear any earlier frame, then record the RECIPE, and only then write the pixels.
      // Order matters: setAudioCover clears bakes for a non-viz cover, so writing the
      // image before it would delete the frame just captured.
      await dropBakes(base).catch(() => {});
      await setAudioCover(ref.id, { shape: `viz:${preset}`, colour: colourAt });
      await putBake(bakeKey(base, preset, brandKeyFor(coverPool)), blob).catch(() => {});
      if (nameEl) nameEl.dataset.pinned = 'true';
      // Reflect it on the tile behind the modal straight away.
      if (mounted) mountAudioThumbGrid();
    };

    // Escape steps DOWN one rung rather than closing everything: immersive → inline →
    // (the modal's own handler) closed.
    const onEsc = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      if (stage.classList.contains('is-immersive')) {
        e.stopPropagation(); e.preventDefault();
        stage.classList.remove('is-immersive');
        void mountLive();
      } else if (open) {
        e.stopPropagation(); e.preventDefault();
        void show(false);
      }
    };
    dlg.addEventListener('keydown', onEsc, true);

    dlg.querySelector('[data-viz-immerse]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      stage.classList.toggle('is-immersive');
      // Re-mount at the new size: the buffer dimensions are fixed at mount, so a resized
      // surface keeps rendering at the old resolution in a corner otherwise.
      void mountLive();
    });

    // The GL context must not outlive the modal - contexts are the scarce resource here.
    vizTeardown = () => {
      dlg.removeEventListener('keydown', onEsc, true);
      cycle.stop();
      handle?.destroy(); handle = null;
    };
  }


  /**
   * An audio asset's card art - its cover if it has one, else the generated waveform.
   * Used by the GRID tiles and the favourites strip, which still want a still image;
   * the details view has its own live surface and does not use this.
   *
   * Synchronous, so it draws from peaks already in memory and falls back to the honest
   * glyph. It never starts a decode: the strip can hold every favourite at once.
   */
  function audioCardArt(ref: AssetRef): string {
    const look = resolveAudioLook(ref.id, coverPool, coverMap);
    const peaks = memoPeaks(ref.id);
    const svg = peaks
      ? audioThumbSvg(peaks, { shape: look.shape, label: String(ref.meta?.name ?? ref.id) })
      : audioThumbPlaceholder({});
    return look.ink ? `<span class="cat-strip-art" style="color:${escape(look.ink.hex)}">${svg}</span>` : svg;
  }

  /** Guards against re-entering the warm-up: mountFavStrip re-runs on every favourite
   *  toggle, and each run would otherwise re-queue the same derives. */
  let warmingFavArt = false;

  /**
   * Measure the favourited AUDIO assets so the strip can draw real waveforms.
   *
   * The strip builds its markup synchronously, so it can only draw peaks already in
   * memory - none on a cold load, which left a starred track as a card with a name and
   * nothing above it. Favourites are the one set where measuring up front is justified:
   * few by definition, and the assets the user looks at most. Bounded, sequential, and
   * it re-renders ONCE at the end rather than per asset.
   */
  async function warmFavAudioArt(): Promise<void> {
    if (warmingFavArt) return;
    const need = favItems().filter(a => a.type === 'audio' && !memoPeaks(a.id)).slice(0, 12);
    if (!need.length) return;
    warmingFavArt = true;
    try {
      let got = false;
      for (const a of need) {
        if (!mounted) return;
        if (await derivePeaks(host, a, a.id).catch(() => null)) got = true;
      }
      if (got && mounted) mountFavStrip();
    } finally {
      warmingFavArt = false;
    }
  }

  function audioElOf(dlg: HTMLElement): HTMLAudioElement | null {
    return dlg.querySelector<HTMLAudioElement>('[data-audio-preview]');
  }

  function meterElOf(dlg: HTMLElement): HTMLCanvasElement | null {
    return dlg.querySelector<HTMLCanvasElement>('[data-audio-meter]');
  }

  /** Pin (or clear) an asset's cover, then reflect it everywhere it shows. */
  async function setAudioCover(id: string, cover: AudioCover | null): Promise<void> {
    const base = assetBaseId(id);
    if (cover) coverMap.set(base, cover); else coverMap.delete(base);
    if (profile) await saveAudioCover(host, profile, id, cover);
    // Drop stale pixels ONLY when they can no longer be right: the cover was cleared, or
    // it is no longer a MilkDrop one. It must NOT drop for a viz cover - snapCover writes
    // the bake around this call, and dropping here deleted the frame the user had just
    // chosen, which is why "use as cover" appeared to do nothing.
    if (!cover || !isVizCover(cover)) {
      const { dropBakes } = await import('../lib/audio-cover-bake.ts');
      await dropBakes(base).catch(() => {});
    }
    // Re-mount the grid's waveform upgrader so the new look lands on the tile
    // immediately. It destroys and rebuilds, which is what a changed cover needs, and
    // is cheap: peaks are already cached, so nothing re-decodes.
    if (mounted) mountAudioThumbGrid();
  }

  // ── actions ──────────────────────────────────────────────────────────────────
  async function toggleFavourite(id: string): Promise<void> {
    const base = assetBaseId(id);
    const on = !favSet.has(base);
    if (on) favSet.add(base); else favSet.delete(base);
    if (profile) await saveFavouriteAssets(host, profile, favSet);
    if (!mounted) return;
    // In place: flip the affected grid tile(s) + re-mount only the favourites strip (whose
    // membership just changed) instead of rebuilding the whole grid via render().
    reflectFavInGrid(base, on);
    refreshFavStrip();
    const name = String(assetById.get(id)?.meta?.name ?? id);
    announce(on ? tRaw('Added {name} to favourites', { name }) : tRaw('Removed {name} from favourites', { name }));
  }

  async function setHidden(base: string, hide: boolean, opts: { toast?: boolean } = {}): Promise<void> {
    if (hide) hiddenSet.add(base); else hiddenSet.delete(base);
    if (profile) await saveHiddenAssets(host, profile, hiddenSet);
    if (!mounted) return;
    const hidName = String(assetById.get(base)?.meta?.name ?? base);
    announce(hide ? tRaw('{name} hidden', { name: hidName }) : tRaw('{name} unhidden', { name: hidName }));
    // Hide is already reversible, so the toast carries no deferred commit - it is
    // pure convenience: one press instead of finding the Show-hidden toggle.
    // toast:false on the undo path so undoing can't spawn a counter-toast.
    if (opts.toast !== false) {
      showUndoToast({
        message: hide ? tRaw('Hid "{name}".', { name: hidName }) : tRaw('Unhid "{name}".', { name: hidName }),
        undo: () => { void setHidden(base, !hide, { toast: false }); },
      });
    }
    // Hiding relocates a tile between buckets (category grid ↔ Hidden section), so a naive
    // class-toggle isn't faithful. Try a minimal in-place DOM move for the common case and
    // fall back to a full re-render for the structural sub-cases where splicing a section
    // in/out (or building the toolbar's "Show hidden" control) isn't clearly safe.
    if (!applyHiddenInPlace(base, hide)) rerender();
  }

  // Minimal in-place reflection of a hide/unhide; returns false to request a full render()
  // when the change would create/reorder a section (not clearly safe to splice). Only the
  // repeated-hide path (Show hidden off, its toggle already present) is handled in place - 
  // the same set of tiles just leaves the grid, exactly as a re-render would omit them.
  function applyHiddenInPlace(base: string, hide: boolean): boolean {
    if (query) return false;                       // search view buckets differently
    if (!hide) return false;                        // unhide re-inserts into an ordered category → render()
    if (showHidden) return false;                   // would need to move tiles INTO the Hidden section
    const assets = viewEl.querySelector<HTMLElement>('.cat-assets');
    if (!assets) return false;
    const tiles = [...viewEl.querySelectorAll<HTMLElement>('.cat-tile')]
      .filter(t => assetBaseId(t.dataset.id ?? '') === base);
    if (!tiles.length) return false;
    // The "Show hidden (N)" toggle (the .cat-showhidden that isn't Collapse-all) must
    // already exist; building it from scratch on the first-ever hide isn't clearly safe.
    const toggle = [...assets.querySelectorAll<HTMLElement>('.cat-showhidden')]
      .find(b => !b.classList.contains('cat-collapse-all'));
    if (!toggle) return false;
    // Drop the tiles; remove any category/uploads section they leave empty (render omits it).
    for (const tile of tiles) {
      const sec = tile.closest<HTMLElement>('.cat-group');
      tile.remove();
      if (sec && !sec.querySelector('.cat-tile')) sec.remove();
    }
    // Toolbar count + the toggle's own tally both read the (now smaller) visible/hidden sets.
    const hiddenCount = allAssets.filter(a => hiddenSet.has(assetBaseId(a.id))).length;
    // This path only runs while hidden assets are folded away (showHidden === false), so the
    // eye icon + "Show hidden (N)" is always the right pairing. Preserve the icon (setCatToggle).
    setCatToggle(toggle, CAT_ICONS.eye, t('Show hidden ({n})', { n: hiddenCount }));
    const count = assets.querySelector<HTMLElement>('.cat-count');
    if (count) { const n = visibleAssets().length; count.textContent = n === 1 ? t('1 asset') : t('{n} assets', { n }); }
    if (favSet.has(base)) refreshFavStrip();   // a hidden favourite leaves the strip
    return true;
  }

  async function recategorise(ref: AssetRef): Promise<void> {
    const base = assetBaseId(ref.id);
    const current = libCategory(ref, overrides);
    const chosen = await choiceDialog({
      title: t('Recategorise asset'),
      message: tRaw('Move “{name}” into which group? (Currently {category}.)', { name: String(ref.meta?.name ?? ref.id), category: t(categoryLabel(current)) }),
      choices: [
        ...LIB_GROUPS.map(g => ({ id: g.key, label: t(g.label), primary: g.key === current })),
        { id: '__auto__', label: t('Auto (from tags)') },
      ],
    });
    if (!chosen || !mounted) return;
    if (profile) await saveAssetCategory(host, profile, base, chosen === '__auto__' ? null : chosen);
    setOverrides(loadAssetCategories(profile));
    // '__auto__' clears the override, so the resulting group is the tag-derived one.
    const newCat = chosen === '__auto__' ? libCategory(ref, overrides) : chosen;
    announce(tRaw('Moved {name} to {category}', { name: String(ref.meta?.name ?? ref.id), category: t(categoryLabel(newCat)) }));
    rerender();
  }

  /**
   * Soft-delete uploads behind an undo toast (plans/132 WP-E): the tiles leave
   * the view NOW, the bytes leave the device only when the toast settles. No
   * confirm dialog any more - the toast IS the safety net, and it costs nothing
   * on the (overwhelmingly common) intentional path.
   */
  function softDeleteUploads(refs: readonly AssetRef[]): void {
    if (!refs.length) return;
    for (const r of refs) {
      pendingDeletes.add(r.id);
      allAssets = allAssets.filter(a => a.id !== r.id);
      assetById.delete(r.id);
      selected.delete(r.id);
    }
    rerender();
    const firstName = String(refs[0]!.meta?.name ?? refs[0]!.id.split('/').pop());
    showUndoToast({
      message: refs.length === 1
        ? tRaw('Deleted "{name}".', { name: firstName })
        : tRaw('Deleted {n} uploads.', { n: refs.length }),
      undo: async () => {
        for (const r of refs) pendingDeletes.delete(r.id);
        if (!mounted) return;
        await reload();
        if (mounted) rerender();
        announce(refs.length === 1 ? tRaw('Restored "{name}".', { name: firstName }) : tRaw('Restored {n} uploads.', { n: refs.length }));
      },
      commit: async () => {
        for (const r of refs) {
          const base = assetBaseId(r.id);
          // The bridge announces the delete ('lolly:user-asset-deleted', wired in
          // main.ts), which also drops an audio upload from the Neurospicy player.
          await host.assets._deleteUserAsset(r.id).catch(() => {});
          pendingDeletes.delete(r.id);
          // Prune any dangling per-user overlay entries for the gone asset (one
          // write each, only when actually present).
          if (profile && favSet.delete(base)) await saveFavouriteAssets(host, profile, favSet);
          if (profile && hiddenSet.delete(base)) await saveHiddenAssets(host, profile, hiddenSet);
          if (profile && overrides[base]) { await saveAssetCategory(host, profile, base, null); setOverrides(loadAssetCategories(profile)); }
        }
      },
    });
  }

  async function deleteUserAsset(ref: AssetRef): Promise<void> {
    softDeleteUploads([ref]);
  }

  async function renameUserAsset(ref: AssetRef): Promise<void> {
    const current = String(ref.meta?.name ?? '');
    const name = await promptDialog({
      title: t('Rename image'),
      message: t('Give this upload a new name.'),
      value: current,
      placeholder: t('Image name'),
      confirmLabel: t('Rename'),
    });
    if (name == null || !mounted) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === current) return;
    await host.assets._renameUserAsset(ref.id, trimmed).catch(() => {});
    // allAssets holds the same AssetRef objects assetById maps to, so one write updates both.
    const rec = assetById.get(ref.id);
    if (rec) rec.meta = { ...rec.meta, name: trimmed };
    rerender();
  }

  /** Edit the free-form tags on one or many uploads (plans/132 WP-C item 2).
   *  One comma-separated field - the same read-then-merge meta write the
   *  declare-AI-origins action uses; an empty field clears the tags. Tags feed
   *  the search haystack, so the memoised index is dropped after a write. */
  async function editTags(refs: AssetRef[]): Promise<void> {
    const uploads = refs.filter(r => r.source === 'user');
    const first = uploads[0];
    if (!first) return;
    const current = uploads.length === 1 ? (((first.meta?.tags as string[] | undefined) ?? []).join(', ')) : '';
    const raw = await promptDialog({
      title: uploads.length === 1 ? t('Edit tags') : tRaw('Edit tags on {n} uploads', { n: uploads.length }),
      message: uploads.length === 1
        ? t('Comma-separated tags. They show in the details, feed search, and click-to-filter.')
        : t('Comma-separated tags to set on every selected upload, replacing what each has now.'),
      value: current,
      placeholder: t('e.g. logo, dark, print'),
      confirmLabel: t('Save'),
    });
    if (raw == null || !mounted) return;
    const tags = [...new Set(raw.split(',').map(x => x.trim()).filter(Boolean))];
    for (const ref of uploads) {
      const rec = assetById.get(ref.id);
      if (!rec) continue;
      const meta: Record<string, unknown> = { ...rec.meta };
      if (tags.length) meta.tags = tags; else delete meta.tags;
      await host.assets._updateUserAssetMeta(ref.id, meta).catch(() => {});
      rec.meta = meta;
    }
    searchHaystack = null;
    rerender();
  }

  /** Open a single-file OS picker and resolve the chosen File (null if cancelled). */
  function pickOneFile(accept: string): Promise<File | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.style.cssText = 'position:fixed;left:-9999px;';
      const done = (f: File | null): void => { input.remove(); resolve(f); };
      // 'cancel' (where supported) resolves null; 'change' resolves the file. Clean up either way.
      input.addEventListener('change', () => done(input.files?.[0] ?? null), { once: true });
      input.addEventListener('cancel', () => done(null), { once: true });
      document.body.appendChild(input);
      input.click();
    });
  }

  /**
   * Replace the FILE behind one upload, keeping its id - so every saved session, tool and
   * project that references it redrives with the new image (see picker.replaceUserUpload). The
   * confirm states the global reach and the honest limit (already-exported/shared copies keep
   * the old image), and warns when the new file's aspect ratio would reflow existing layouts.
   */
  async function replaceUserAsset(ref: AssetRef): Promise<void> {
    // Offer only compatible files: still images get the image-only accept; other kinds (audio,
    // video, lottie) fall back to the full accept, with the ingest-time kind guard as backstop.
    const isImageRef = ref.type === 'raster' || ref.type === 'vector';
    const file = await pickOneFile(isImageRef ? REPLACE_IMAGE_ACCEPT : UPLOAD_ACCEPT);
    if (!file || !mounted) return;

    // A materially different aspect ratio reflows layouts sized to the old shape. Best-effort.
    let reflow = false;
    try {
      const nd = await trimmedDimensions(file);
      const ow = Number(ref.width ?? 0), oh = Number(ref.height ?? 0);
      if (nd.width && nd.height && ow > 0 && oh > 0) {
        reflow = Math.abs((nd.width / nd.height) - (ow / oh)) / (ow / oh) > 0.05;
      }
    } catch { /* dimensions are a nicety, not a gate */ }
    if (!mounted) return;

    // Name the blast radius (plans/132 WP-G): the confirm now says HOW MANY
    // saved sessions actually reference this image, not just that some might.
    const uses = await usedInSessions(ref).catch(() => [] as Array<{ slot: string; label: string }>);
    if (!mounted) return;
    const message = [
      reflow ? t('The new image is a different shape, so layouts sized to the old one may shift.') : '',
      t('The new file replaces this image at the same address, so every saved session, tool and project that uses it shows the new one. Anything you’ve already exported, downloaded or shared keeps the old image.'),
      uses.length ? (uses.length === 1 ? t('It is used in 1 saved session.') : tRaw('It is used in {n} saved sessions.', { n: uses.length })) : '',
    ].filter(Boolean).join(' ');

    const ok = await confirmDialog({ title: t('Replace this image?'), message, confirmLabel: t('Replace'), danger: false });
    if (!ok || !mounted) return;

    // The stored record (bytes included) BEFORE the swap - the undo toast below
    // re-uploads it wholesale if the user changes their mind.
    const prevRecord = (await host.assets._exportUserAssets().catch(() => [] as UserAssetRecordLike[]))
      .find(r => r.id === ref.id) ?? null;
    if (!mounted) return;

    try {
      await replaceUserUpload(host as unknown as Parameters<typeof replaceUserUpload>[0], ref.id, file);
    } catch (err) {
      host.log?.('error', 'Catalog replace failed', { id: ref.id, error: String(err) });
      // Quota / too-large errors carry a user-ready message; everything else gets a plain one.
      announce((err as { code?: unknown }).code ? (err as Error).message : t('Couldn’t replace that image.'), { assertive: true });
      return;
    }
    if (!mounted) return;
    await reload();          // the record changed under _listUserAssets
    if (!mounted) return;
    rerender();
    announce(t('Image replaced.'));
    if (prevRecord?.blob) {
      showUndoToast({
        message: tRaw('Replaced "{name}".', { name: String(prevRecord.meta?.name ?? ref.id) }),
        undo: async () => {
          try { await host.assets._uploadUserAsset({ ...prevRecord, version: String(Date.now()) }); }
          catch (err) { host.log?.('error', 'Replace undo failed', { id: ref.id, error: String(err) }); return; }
          if (!mounted) return;
          await reload();
          if (!mounted) return;
          rerender();
          announce(t('Restored the previous image.'));
        },
      });
    }
  }

  // ── trim margins (plan 97 section 7.3) ─────────────────────────────────────────────────
  // The retro-trim of an upload that arrived padded - the same offer the dropzone and
  // the asset picker make at ingest, made again later against the STORED bytes. The
  // card is the confirmation (section 14.4): nothing is written until the user takes "Trim",
  // and what is written replaces the original margins for good.

  /**
   * Read the record behind a user upload and measure a trim of its stored bytes.
   * Null = it could not be read at all; `proposal: null` = it was read and there is
   * nothing worth trimming (already tight to its content).
   *
   * The read is `_exportUserAssets` because the bridge exposes no get-one-record
   * call, and `_getBlob` hands back bytes without the metadata a rewrite has to carry
   * forward. It walks the rows, not the pixels - an IndexedDB blob is a file-backed
   * handle - which is what makes it fine on an explicit one-shot action (the storage
   * meter's `_userAssetsSize` takes the same read on every visit).
   */
  async function measureTrim(ref: AssetRef): Promise<{ record: UserAssetRecordLike; proposal: TrimProposal | null } | null> {
    const { prepareTrim } = await import('../lib/design-system/trim-offer.ts');
    const record = (await host.assets._exportUserAssets()).find(r => r.id === ref.id);
    if (!record?.blob) return null;
    // A File, not the raw Blob: the measure routes on magic bytes first but falls back
    // to the MIME type and then the name, and a stored blob's type can be blank.
    const name = String(record.meta?.name ?? ref.id.split('/').pop() ?? 'image');
    const file = new File([record.blob], name, { type: record.blob.type || '' });
    return { record, proposal: await prepareTrim(file) };
  }

  /**
   * The stored dimensions for the bytes a trim actually produced. Measured from the
   * RESULT rather than taken from the proposal: the card's padding stepper may have
   * moved since it was built, and it resolves with a file, not a box. Empty when they
   * can't be read - the record then carries no dimensions rather than the old ones,
   * which after a trim would be a wrong aspect for every tool that reads them.
   */
  async function trimmedDimensions(file: File): Promise<{ width?: number; height?: number }> {
    if (/svg/i.test(file.type)) {
      const { svgArtboardBox } = await import('../lib/design-system/trim-offer.ts');
      const box = svgArtboardBox(await file.text().catch(() => ''));
      // User units, so keep the fraction the viewBox rewrite wrote (to 3 places).
      return box ? { width: Math.round(box.width * 1000) / 1000, height: Math.round(box.height * 1000) / 1000 } : {};
    }
    try {
      const bitmap = await createImageBitmap(file);
      const dims = { width: bitmap.width, height: bitmap.height };
      bitmap.close?.();
      return dims;
    } catch {
      return {};
    }
  }

  /**
   * Commit a trim: replace one upload's stored bytes, keeping its id.
   *
   * A read-modify-write in the discipline of the bridge's own `_renameUserAsset` /
   * `_restampUserAsset` - read the record, change only what the trim changed, put it
   * back under the SAME id. `user/…` ids are a permanent contract: sessions, project
   * folders and tool inputs already point at this one, and minting a new id would
   * quietly orphan every one of them. `version` is bumped for the same reason
   * `_restampUserAsset` bumps it: object URLs are cached as `user:<id>:<format>:
   * <version>`, so without it the grid would keep painting the untrimmed bytes.
   *
   * The write goes through `_uploadUserAsset`, the one narrow helper the bridge
   * exposes for a whole record, so the quota guard at that boundary still runs. It
   * measures the WHOLE blob rather than the delta (the caveat `_restampUserAsset`
   * documents) - for a trim that is the safe direction, since the new bytes all but
   * always weigh less than the ones they replace.
   *
   * Carried forward on purpose: `credential` / `credentialFormat` / `aiGenerated`. A
   * trim is a derivative edit, and ingest already keeps a re-encoded upload's original
   * credential so a download can carry it as an ingredient; dropping it here would
   * launder an AI image's disclosure out of the library. `checksum` is the one field
   * deliberately left behind - it describes bytes that no longer exist.
   */
  async function commitTrim(record: UserAssetRecordLike, file: File): Promise<void> {
    const format = /svg/i.test(file.type) ? 'svg' : /png/i.test(file.type) ? 'png' : record.format;
    const prevName = String(record.meta?.name ?? '');
    const { checksum: _staleChecksum, ...carried } = record;
    const { width, height } = await trimmedDimensions(file);
    await host.assets._uploadUserAsset({
      ...carried,
      // A plain Blob like every other stored record, and a slice rather than a
      // re-wrap so the bytes are viewed, not copied.
      blob: file.slice(0, file.size, file.type),
      format,
      width,
      height,
      version: String(Date.now()),
      meta: {
        ...record.meta,
        // A raster trim re-encodes to PNG, so a "logo.webp" would now be lying about
        // its own bytes - the same honesty ingest keeps with renameExt.
        ...(prevName && format !== record.format ? { name: `${prevName.replace(/\.[^./\\]+$/, '')}.${format}` } : {}),
        bytes: file.size,
      },
    });
  }

  // ── selection (user uploads only) ───────────────────────────────────────────────
  // The set of currently-selectable ids - exactly the uploads the grid is SHOWING right now.
  // The same three filters assetsSectionHtml() builds the uploads section from (visible +
  // search + filetype), so "Select all" and pruneSelection() can never reach a tile that
  // isn't on screen: an off-screen id in the selection would ride into a bulk delete
  // invisibly. (The filetype filter belongs here for the same reason the search does.)
  const selectableIds = (): Set<string> => selectableIdsRule(
    visibleAssets(),
    // An empty query short-circuits inside the rule, so hand it an empty index
    // rather than building one nobody will read. Scope 'all': every visible tile
    // is selectable; destructive bulk actions gate per-kind (allSelectedUploads).
    { query, haystack: query ? haystack() : EMPTY_HAYSTACK, typeFilter, scope: 'all' },
  );
  // The uploads section's "Select all" button keeps its uploads-only scope.
  const uploadSelectableIds = (): Set<string> => selectableIdsRule(
    visibleAssets(),
    { query, haystack: query ? haystack() : EMPTY_HAYSTACK, typeFilter, scope: 'uploads' },
  );
  const allSelectedUploads = (): boolean =>
    selected.size > 0 && [...selected].every(id => assetById.get(id)?.source === 'user');
  // The single selected upload, or null. Replace (one file → one file) and Rename (one
  // asset's name) only make sense on exactly one of the user's own uploads.
  const singleSelectedUploadRef = (): AssetRef | null => {
    if (selected.size !== 1) return null;
    const ref = assetById.get([...selected][0]!);
    return ref?.source === 'user' ? ref : null;
  };
  const allSelectedFav = (): boolean =>
    selected.size > 0 && [...selected].every(id => favSet.has(assetBaseId(id)));
  const allSelectedHidden = (): boolean =>
    selected.size > 0 && [...selected].every(id => hiddenSet.has(assetBaseId(id)));

  // Drop selected ids that are gone (deleted, or filtered out by a search) so the count
  // stays honest. Runs at the top of every render().
  function pruneSelection(): void {
    pruneSelectionRule(selected, selectableIds());
  }

  function toggleSelect(id: string): void {
    if (selected.has(id)) selected.delete(id); else selected.add(id);
    // Update the one tile in place - no full render, so scroll + focus are kept.
    const on = selected.has(id);
    const tile = [...viewEl.querySelectorAll<HTMLElement>('.cat-tile')].find(t => t.dataset.id === id);
    tile?.classList.toggle('is-selected', on);
    tile?.querySelector('.cat-check')?.setAttribute('aria-pressed', String(on));
    syncSelectAll();
    syncBulkBar();
  }

  function selectAllUploads(): void {
    const ids = uploadSelectableIds();
    const allSel = ids.size > 0 && [...ids].every(id => selected.has(id));
    if (allSel) for (const id of ids) selected.delete(id);
    else for (const id of ids) selected.add(id);
    // Flip each upload tile's checkbox in place (mirrors toggleSelect) rather than
    // rebuilding the grid - selection never moves a tile between buckets.
    for (const tile of viewEl.querySelectorAll<HTMLElement>('.cat-tile')) {
      const id = tile.dataset.id ?? '';
      if (!ids.has(id)) continue;
      const on = selected.has(id);
      tile.classList.toggle('is-selected', on);
      tile.querySelector('.cat-check')?.setAttribute('aria-pressed', String(on));
    }
    syncSelectAll();
    syncBulkBar();
  }

  // Keep the "Select all / Deselect all" label + pressed state in sync after a single toggle.
  function syncSelectAll(): void {
    const ids = uploadSelectableIds();
    const allSel = ids.size > 0 && [...ids].every(id => selected.has(id));
    const btn = viewEl.querySelector<HTMLElement>('.cat-uploads-selectall');
    if (btn) { btn.textContent = allSel ? t('Deselect all') : t('Select all'); btn.setAttribute('aria-pressed', String(allSel)); }
  }

  const syncBulkBar = (): void => syncSharedBulkBar(viewEl, bulkBarCfg);

  // Escape drops the selection (yielding to any open menu/dialog/field first) - 
  // the keyboard exit the ✕ button and an empty-canvas click already provide.
  const unwireEscape = wireEscapeClearsSelection({
    active: () => mounted && selected.size > 0,
    clear: () => handleBulk('clear'),
  });

  // ── Where-used (plans/132 WP-G) ─────────────────────────────────────────
  // A lazy reverse index over saved sessions: each session's stored data as one
  // JSON string, scanned for an asset's base id. Built once per mount on first
  // demand (details open / Replace confirm); sessions are local IndexedDB reads.
  let sessionTexts: Array<{ slot: string; label: string; text: string }> | null = null;
  let sessionTextsLoading: Promise<void> | null = null;
  async function ensureSessionTexts(): Promise<void> {
    if (sessionTexts) return;
    if (!sessionTextsLoading) {
      sessionTextsLoading = (async () => {
        const h = host as unknown as { state?: { list?: () => Promise<Array<{ slot: string; label?: string | null; toolId?: string }>>; load?: (slot: string) => Promise<unknown> } };
        const rows = (await h.state?.list?.().catch(() => [])) ?? [];
        const out: Array<{ slot: string; label: string; text: string }> = [];
        for (const row of rows) {
          if (typeof row.slot !== 'string' || isHiddenSlot(row.slot)) continue;
          const data = await h.state?.load?.(row.slot).catch(() => null);
          if (!data) continue;
          try { out.push({ slot: row.slot, label: String(row.label ?? row.toolId ?? row.slot), text: JSON.stringify(data) }); }
          catch { /* unserialisable session - skip */ }
        }
        sessionTexts = out;
      })();
    }
    await sessionTextsLoading;
  }
  /** Saved sessions whose stored values reference this asset (base-id substring
   *  inside the serialized data - honest as "appears in", not a strict parse). */
  async function usedInSessions(ref: AssetRef): Promise<Array<{ slot: string; label: string }>> {
    await ensureSessionTexts();
    const needle = `"${assetBaseId(ref.id)}`;
    return (sessionTexts ?? []).filter(s2 => s2.text.includes(needle)).map(({ slot, label }) => ({ slot, label }));
  }

  /**
   * "Add to project…" (plans/132 WP-D): reference the assets into a folder via
   * the SAME store Projects uses - no byte copies (folder image items are refs;
   * the projects reconciler already keeps catalog refs alive). Offers every
   * folder path-labelled, plus creating a new one on the spot.
   */
  async function addToProject(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const store = createFolderStore(host as unknown as FolderHost);
    const folders = await store.list();
    const pathLabel = (id: string): string => folderPath(folders, id).map(f => f.name).join(' / ');
    const chosen = await choiceDialog({
      title: ids.length === 1 ? t('Add to project') : tRaw('Add {n} assets to project', { n: ids.length }),
      message: t('The assets stay in the Catalog; the project holds a reference.'),
      choices: [
        ...folders.map(f => ({ id: f.id, label: pathLabel(f.id) })),
        { id: '__new__', label: t('New project…'), primary: folders.length === 0 },
      ],
    });
    if (!chosen || !mounted) return;
    let target = chosen;
    if (chosen === '__new__') {
      const name = await promptDialog({ title: t('New project'), message: t('Name the project folder.'), placeholder: t('Project name'), confirmLabel: t('Create') });
      if (!name || !mounted) return;
      try { target = (await store.create(name)).id; }
      catch (err) { announce(String((err as Error).message ?? err), { assertive: true }); return; }
    }
    for (const id of ids) await store.addItem(target, { type: 'image', ref: id }).catch(() => {});
    announce(ids.length === 1 ? t('Added to the project') : tRaw('Added {n} assets to the project', { n: ids.length }));
  }

  function handleBulk(action: string): void {
    if (action === 'clear') {
      // Deselect in place - drop the highlight from every selected tile, no full re-render.
      for (const tile of viewEl.querySelectorAll<HTMLElement>('.cat-tile.is-selected')) {
        tile.classList.remove('is-selected');
        tile.querySelector('.cat-check')?.setAttribute('aria-pressed', 'false');
      }
      selected.clear();
      // The anchor goes with the selection: left behind, it would silently become the far
      // end of the next Shift-click's range, selecting a swathe the user never started.
      tileSelect.resetAnchor();
      syncSelectAll();
      syncBulkBar();
    }
    // The destructive trio is hidden unless the whole selection is uploads; the
    // guard re-checks at dispatch so a selection that changed under a stale menu
    // can never route a catalog asset into a delete.
    else if (action === 'add-to-project') { void addToProject([...selected]); }
    else if (action === 'delete') { if (allSelectedUploads()) void deleteSelection(); }
    else if (action === 'download') { if (allSelectedUploads()) void downloadSelection(); }
    else if (action === 'duplicate') { if (allSelectedUploads()) void duplicateSelection(); }
    else if (action === 'edit-tags') {
      if (allSelectedUploads()) void editTags([...selected].map(id => assetById.get(id)).filter((r): r is AssetRef => !!r));
    }
    // Replace + Rename act on exactly one upload; the guard re-checks at dispatch so a
    // selection that grew under a stale bar can never misroute them.
    else if (action === 'replace') { const r = singleSelectedUploadRef(); if (r) void replaceUserAsset(r); }
    else if (action === 'rename') { const r = singleSelectedUploadRef(); if (r) void renameUserAsset(r); }
    else if (action === 'fav') void favouriteSelection();
    else if (action === 'hide') void hideSelection();
  }

  // Bulk favourite/unfavourite - smart toggle (all starred → unstar all), one
  // profile write, tiles + strip reflected in place. Works on ANY selection kind.
  async function favouriteSelection(): Promise<void> {
    if (!selected.size) return;
    const on = !allSelectedFav();
    const bases = new Set([...selected].map(assetBaseId));
    for (const b of bases) { if (on) favSet.add(b); else favSet.delete(b); }
    if (profile) await saveFavouriteAssets(host, profile, favSet);
    if (!mounted) return;
    for (const b of bases) reflectFavInGrid(b, on);
    refreshFavStrip();
    syncBulkBar();
    announce(on ? t('{n} added to favourites', { n: bases.size }) : t('{n} removed from favourites', { n: bases.size }));
  }

  // Bulk hide/unhide - smart toggle, one profile write, then a full re-render
  // (hiding relocates tiles between the category grids and the Hidden section,
  // and the selection is cleared with it - the tiles are leaving the view).
  async function hideSelection(): Promise<void> {
    if (!selected.size) return;
    const unhide = allSelectedHidden();
    const bases = new Set([...selected].map(assetBaseId));
    for (const b of bases) { if (unhide) hiddenSet.delete(b); else hiddenSet.add(b); }
    if (profile) await saveHiddenAssets(host, profile, hiddenSet);
    if (!mounted) return;
    selected.clear();
    tileSelect.resetAnchor();
    announce(unhide ? t('{n} unhidden', { n: bases.size }) : t('{n} hidden', { n: bases.size }));
    rerender();
    showUndoToast({
      message: unhide ? tRaw('Unhid {n} assets.', { n: bases.size }) : tRaw('Hid {n} assets.', { n: bases.size }),
      undo: async () => {
        for (const b of bases) { if (unhide) hiddenSet.add(b); else hiddenSet.delete(b); }
        if (profile) await saveHiddenAssets(host, profile, hiddenSet);
        if (mounted) rerender();
      },
    });
  }

  /**
   * Bulk "Duplicate": a byte-identical copy of every selected upload, then move
   * the selection onto the new copies - so the very next move / edit / download
   * acts on THEM, while the originals stay put and untouched. Copies mint with a
   * fresh, now-stamped id, so they sort to the top of "Your uploads" and land in
   * view (we scroll the first into sight), already highlighted and ready to grab.
   *
   * The copy loop is a background JOB (progress + cancel in the global job toast),
   * so an N-image run neither hides its progress nor dies with the view. heavy:
   * false - byte copies through the asset store, no inference. Cancel is
   * cooperative (_duplicateUserAsset has no abort): the copies already made are
   * kept and announced, since they exist in the library either way.
   */
  async function duplicateSelection(): Promise<void> {
    const ids = [...selected];
    if (!ids.length) return;
    const job = startJob({
      title: t('Duplicating images'),
      heavy: false,
      cancel: () => { /* cooperative - the loop polls job.cancelled between copies */ },
    });
    const newIds: string[] = [];
    for (const id of ids) {
      if (job.cancelled) break;
      job.progress(newIds.length, ids.length);
      try {
        const newId = await host.assets._duplicateUserAsset(id);
        if (newId) newIds.push(newId);
      } catch (err) {
        host.log?.('warn', 'Catalog bulk duplicate: member skipped', { id, error: String(err) });
      }
    }
    job.progress(newIds.length, ids.length);
    job.finish();
    if (!newIds.length) return;
    // Announce first: the copies are made whether or not this view is still up, and
    // the live region is body-level, so the count is announced after a navigation too.
    announce(newIds.length === 1 ? t('1 copy made · selected') : t('{n} copies made · selected', { n: newIds.length }));
    if (!mounted) return;
    await reload();                     // pull the new copies into allAssets / assetById
    if (!mounted) return;
    // Hand the selection to the copies (not the originals). render()'s pruneSelection
    // keeps only ids that are present + selectable, so a copy filtered out by an
    // active search simply drops from the selection - the visible ones stay selected.
    selected.clear();
    tileSelect.resetAnchor();           // the originals are no longer the selection's origin
    for (const newId of newIds) selected.add(newId);
    render();
    // Bring the first new copy into view so "the copies appeared" is visible, not
    // just a count in the bar - nearest, so it doesn't jump when already on screen.
    viewEl.querySelector<HTMLElement>('.cat-tile.is-selected')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /**
   * The byte payload a download of `ref` should carry - byte-exact, EXCEPT a user
   * upload whose ingest captured a credential store: its stored bytes were
   * re-encoded (credential no longer inside), so wrap them in a Lolly manifest
   * that opens the original as an ingredient. Same rule as directDownload's
   * single save - keep the two in step.
   */
  async function credentialedBytes(ref: AssetRef): Promise<Blob> {
    const format = String(ref.format || 'bin');
    if (ref.id.startsWith('user/') && STAMPABLE.has(format)) {
      try {
        const ingredients = await sourceIngredients(ref);
        if (ingredients) {
          const blob = await (await fetch(ref.url)).blob();
          const { stampDerivedC2pa } = await import('../bridge/export.ts');
          return await stampDerivedC2pa(host, blob, format, {
            title: String(ref.meta?.name ?? ref.id),
            actions: [{ action: 'c2pa.converted', description: `Re-encoded to ${format.toUpperCase()} when added to the device library` }],
            ingredients,
            inputs: { asset: ref.id },
            ...(ref.width && ref.height ? { dimensions: `${ref.width}×${ref.height}` } : {}),
          });
        }
      } catch { /* fall through to the byte-exact bytes */ }
    }
    return await (await fetch(ref.url)).blob();
  }

  // Bulk "Download": the whole selection in ONE zip (optionally password-locked,
  // same prompt as every batch export), each member's Content Credentials checked
  // with the engine verifier so the announcement is honest about what it carries.
  //
  // The fetch/verify loop and the zip are a background JOB, so a big selection shows
  // progress and cancels from the global job toast. heavy: false - network reads plus
  // a deflate, no inference. Cancel stops between members; a cancel BEFORE the zip
  // delivers nothing (a partial archive the user stopped is not what they asked for).
  // Delivery deliberately ignores `mounted`: saveBlob is a browser download and the
  // live region is body-level, so leaving the catalog mid-run no longer loses the zip.
  async function downloadSelection(): Promise<void> {
    const refs = [...selected].map(id => assetById.get(id)).filter((r): r is AssetRef => !!r);
    if (!refs.length) return;
    const { askExportLock } = await import('../lib/export-lock.ts');
    const { ok, strongPassword, zipLock } = await askExportLock(refs.length === 1 ? t('1 selected image') : t('{n} selected images', { n: refs.length }), true);
    if (!ok || !mounted) return;
    const job = startJob({
      title: t('Zipping images'),
      heavy: false,
      cancel: () => { /* cooperative - the loop polls job.cancelled between members */ },
    });
    const files: { name: string; blob: Blob }[] = [];
    const names = new Set<string>();
    let credentialed = 0;
    for (const ref of refs) {
      if (job.cancelled) return;
      job.progress(files.length, refs.length);
      try {
        const blob = await credentialedBytes(ref);
        try {
          const bytes = new Uint8Array(await blob.arrayBuffer());
          if (extractC2paStore(bytes) && (await verifyC2pa(bytes)).found) credentialed++;
        } catch { /* the check is advisory - never blocks the zip */ }
        const orig = downloadName(ref, String(ref.format || 'bin'));
        let name = orig;
        for (let n = 2; names.has(name); n++) {
          name = orig.includes('.') ? orig.replace(/(\.[^.]+)$/, ` (${n})$1`) : `${orig} (${n})`;
        }
        names.add(name);
        files.push({ name, blob });
      } catch (err) {
        host.log?.('warn', 'Catalog bulk download: member skipped', { id: ref.id, error: String(err) });
      }
    }
    if (!files.length) { job.finish(); return; }
    job.progress(files.length, refs.length);
    const { buildZip, saveBlob } = await import('../pro/zip.ts');
    let zip: Blob;
    try {
      zip = await buildZip(files, { zipName: 'lolly-images', zipLock, password: strongPassword });
    } catch (err) {
      job.fail(err);
      throw err;
    }
    saveBlob(zip, 'lolly-images.zip');
    job.finish();
    announce(files.length === 1
      ? t('1 image zipped · {c} with Content Credentials', { c: credentialed })
      : t('{n} images zipped · {c} with Content Credentials', { n: files.length, c: credentialed }));
  }

  async function deleteSelection(): Promise<void> {
    const refs = [...selected].map(id => assetById.get(id)).filter((r): r is AssetRef => !!r);
    if (!refs.length) return;
    selected.clear();
    tileSelect.resetAnchor();           // the anchor was almost certainly one of the deleted
    softDeleteUploads(refs);
  }

  // ── downloads ──────────────────────────────────────────────────────────────────
  async function saveUrl(url: string, filename: string): Promise<void> {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(String(r.status));
      await host.export.download(await r.blob(), filename);
    } catch {
      // Fallback for same-origin / data URLs when fetch is blocked.
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
    }
  }

  // ── Content Credentials for modified downloads ────────────────────────────────
  // A download that changes an asset's bytes (recolour, colour treatment, crop,
  // rasterise) breaks any credential embedded in them. Instead of shipping a
  // clean-but-unsigned file, re-sign it: a Lolly manifest whose action history
  // records exactly what this download did, with the source's own credential
  // preserved as an ingredient - so an AI-generated or camera-signed origin, or
  // a previous round of Lolly edits, stays in the chain. Re-uploading such a
  // download captures its store at ingest, so every edit round adds a manifest.

  // Both the ingredient lookup and the derived stamp moved to
  // lib/derived-asset.ts (plans/148 WP-E), so the framing bake's "Use as a new
  // image" runs the SAME provenance path this crop does instead of a second copy
  // that drifts. These two thin wrappers keep every call site here unchanged.
  const sourceIngredients = (ref: AssetRef, sourceBytes?: Uint8Array): Promise<IngredientCredential[] | undefined> =>
    sharedSourceIngredients(host as never, ref, sourceBytes);

  /** What downloadCrop hands its delivery: the (unsigned) bytes + the credential
   *  inputs. The default delivery signs-and-downloads; the crop mode's
   *  "Save to catalog" delivery signs-and-uploads instead. */
  type CropDeliver = (blob: Blob, format: string, o: DerivedSignInputs) => Promise<void>;

  const signDerived = (ref: AssetRef, blob: Blob, format: string, o: DerivedSignInputs): Promise<Blob> =>
    sharedSignDerived(host as never, ref, blob, format, o);

  async function downloadSigned(ref: AssetRef, blob: Blob, format: string, filename: string, o: DerivedSignInputs): Promise<void> {
    await host.export.download(await signDerived(ref, blob, format, o), filename);
  }

  // Raster / video / lottie: download the file as-is (no styling or reformat to
  // offer) - except a user upload whose ingest captured a credential: its stored
  // bytes were re-encoded (credential no longer inside), so wrap the save in a
  // Lolly manifest that opens the original as an ingredient. Even an unmodified
  // save then keeps the chain - an AI image stays declared as one.
  async function directDownload(ref: AssetRef): Promise<void> {
    const format = String(ref.format || 'bin');
    const filename = downloadName(ref, format);
    // credentialedBytes IS this save's byte rule (it was extracted for the bulk
    // zip and the send dialog; the three delivery surfaces share one path now).
    try { await host.export.download(await credentialedBytes(ref), filename); return; }
    catch { /* fetch blocked (opaque/data URL edge) - anchor fallback below */ }
    await saveUrl(ref.url, filename);
  }

  // "Send to…" for a STORED asset (plans/129 section 2.3): the same connected
  // destinations the export panel offers, fed the same byte-exact bytes a
  // download of this asset delivers (credentialedBytes - credential intact,
  // re-stamped where ingest captured one). As-is bytes only: recolour and
  // format conversion stay download-dialog features.
  // ponytail: no per-provider format conversion here - add if a social target's
  // format gap (svg → png) ever comes up in practice.
  async function openSendDialog(ref: AssetRef): Promise<void> {
    const format = String(ref.format || 'bin').toLowerCase();
    const name = String(ref.meta?.name ?? ref.id);
    try {
      const { ensureBuiltinSendTargets } = await import('../lib/send-targets-builtin.ts');
      await ensureBuiltinSendTargets();
    } catch (err) { console.error('Send destinations unavailable:', err); }
    if (!mounted) return;
    const offered = sendTargetsFor(format, 'asset');

    closeDownloadDialog();
    const content = `
      <h2 class="cat-dl-title">${t('Send {name}', { name })}</h2>
      ${offered.length ? `
      <div class="cat-dl-section">
        <span class="cat-dl-label">${t('Send to')}</span>
        <div class="cat-send-row">
          ${offered.map(tg => `<button type="button" class="btn" data-send-kind="${escape(sendTargetId(tg))}"${tg.hint ? ` title="${escape(tg.hint)}"` : ''}>${icon('upload', { size: 14 })}<span>${escape(tg.label)}</span></button>`).join('')}
        </div>
        <p class="cat-send-status" role="status"></p>
      </div>` : `
      <p class="cat-send-empty">${t('Nothing connected can take this file type yet. Connect a service under Profile → Connected services.')}</p>`}
      <div class="cat-dl-actions">
        <button type="button" class="btn cat-dl-cancel">${t('Close')}</button>
      </div>`;
    const modal = mountModal(content, {
      className: 'cat-dl',
      initialFocus: (el) => el.querySelector<HTMLElement>('[data-send-kind]') ?? el.querySelector<HTMLElement>('.cat-dl-cancel'),
      onClose: () => { dlDialog = null; dlModal = null; },
    });
    const dlg = modal.el;
    dlDialog = dlg;
    dlModal = modal;

    dlg.addEventListener('click', async (e) => {
      const el = e.target as HTMLElement;
      if (el.closest('.cat-dl-cancel')) { closeDownloadDialog(); return; }
      const btn = el.closest<HTMLButtonElement>('[data-send-kind]');
      if (!btn || btn.hasAttribute('disabled')) return;
      const target = sendTargetsFor(format, 'asset').find(tg => sendTargetId(tg) === btn.dataset.sendKind);
      if (!target) return;
      const status = dlg.querySelector<HTMLElement>('.cat-send-status');
      // Swap the label span, not the button - it also holds the glyph.
      const label = btn.querySelector<HTMLElement>('span') ?? btn;
      const prev = label.textContent;
      btn.toggleAttribute('disabled', true);
      btn.setAttribute('aria-busy', 'true');
      try {
        const name = downloadName(ref, format);
        // Destination first, bytes second - a target with a picker (Penpot's
        // project + file name) asks before anything is fetched or rendered.
        // Cancelling sends nothing.
        let choice: Record<string, unknown> | undefined;
        if (target.prepare) {
          const picked = await target.prepare({ name, format, mime: '' }, { anchor: btn });
          if (!picked) {
            if (status && dlDialog === dlg) status.textContent = t('Cancelled');
            return;
          }
          choice = picked;
        }
        label.textContent = t('Sending…');
        const blob = await credentialedBytes(ref);
        const out = await target.send({
          bytes: new Uint8Array(await blob.arrayBuffer()),
          name,
          format,
          mime: blob.type || 'application/octet-stream',
          choice,
        });
        if (status && dlDialog === dlg) {
          // The driver's url is REMOTE-SOURCED (the upload service's response) -
          // scheme-gate it before it renders as a link.
          status.innerHTML = out.url && safeHref(out.url)
            // nosemgrep: lolly-href-escape-is-not-scheme-validation - safeHref()-gated in the guard above
            ? `<a href="${escape(out.url)}" target="_blank" rel="noopener">${escape(out.label)}</a>`
            : escape(out.label);
        }
        announce(`Sent to ${target.label}`);
      } catch (err) {
        console.error(`Send to ${target.kind} failed:`, err);
        const msg = String((err as Error)?.message || '');
        if (status && dlDialog === dlg) status.textContent = msg && msg.length <= 120 ? msg : t('Send failed - try again');
        announce('Send failed', { assertive: true });
      } finally {
        btn.removeAttribute('aria-busy');
        btn.removeAttribute('disabled');
        label.textContent = prev;
      }
    });
  }

  function closeDownloadDialog(): void {
    dlModal?.close(); // nulls dlDialog/dlModal in its onClose
  }

  // The crop SOURCE the inline crop mode works from.
  interface CropSource {
    vector: boolean;
    svgText: string | null;   // working SVG (may be recoloured)
    origSvg: string | null;   // pre-recolour source - the credential ingredient
    theme: IconTheme | null;
    treatment: PhotoTreatment | null;
    rasterSrc: string;        // crop source for raster - a treatment bakes it into a wrapper
    aspect: number;           // provisional for raster; the real value is read from naturalWidth on load
  }
  // Fetch + prepare the crop source, baking a themable icon's colours or a raster photo's
  // treatment into it (`modifier` is a theme id for themable icons, a treatment id for
  // rasters) so the cropped-out region carries the look and the credential records it.
  // Returns null when a vector asset isn't fetchable/parseable as SVG - the caller should
  // fall back to a plain direct download. Used by enterInlineCrop.
  async function prepCropSource(ref: AssetRef, modifier: string | null): Promise<CropSource | null> {
    const vector = isVector(ref);
    let svgText: string | null = null;
    let origSvg: string | null = null;
    let theme: IconTheme | null = null;
    let treatment: PhotoTreatment | null = null;
    let rasterSrc = ref.url;
    let aspect = 1;
    if (vector) {
      try { const r = await fetch(ref.url); svgText = await r.text(); if (!/<svg[\s>]/i.test(svgText)) throw new Error('not svg'); }
      catch { return null; }
      origSvg = svgText;
      if (isThemable(ref) && modifier && modifier !== ORIGINAL_THEME) {
        const th = iconThemes.find(x => x.id === modifier);
        const out = th && restyleIconTheme(svgText, th);
        if (out && out !== svgText) { svgText = stripC2paManifest(out); theme = th ?? null; }
      }
      aspect = svgAspect(svgText);
    } else if (modifier && ref.type === 'raster' && photoTreatments.length) {
      // The wrapper's pixel size = the photo's, so downloadCrop's canvas cut is unchanged.
      const wrap = await treatedWrapperSvg(ref, modifier).catch(() => null);
      if (wrap) {
        rasterSrc = svgTextToDataUrl(wrap.svg); aspect = wrap.w / wrap.h;
        treatment = photoTreatments.find(x => x.id === modifier) ?? null;
      }
    }
    return { vector, svgText, origSvg, theme, treatment, rasterSrc, aspect };
  }

  // The crop-box interaction core, shared VERBATIM by the crop dialog and the inline crop
  // mode: aspect-fit stage sizing, a default centred box, wheel/HUD zoom (the stage grows
  // image + box together inside a fixed clipping viewport, so the box stays the same fraction
  // of the stage and the crop math never changes), and pointer drag/resize/pan. Pan is the
  // viewport's scroll position (overflow:hidden still scrolls from JS); the cursor point is
  // held fixed on wheel zoom, like the details inspector. The box's edges are draggable along
  // their full length, not just at the corner handles. The caller reads the framed region as
  // a fraction of the asset via getFrac().
  function wireCropBox(els: {
    viewport: HTMLElement; stage: HTMLElement; imgEl: HTMLImageElement;
    boxEl: HTMLElement; hudEl: HTMLElement | null; vector: boolean; aspect: number;
  }): { getFrac(): { fx: number; fy: number; fw: number; fh: number } } {
    const { viewport, stage, imgEl, boxEl, hudEl, vector } = els;
    let aspect = els.aspect;
    let bx = 0, by = 0, bw = 0, bh = 0;    // crop box in stage px
    let fitW = 0, fitH = 0, zoom = 1;      // stage = fit × zoom, clipped by the fixed viewport
    const ZMAX = 16;                       // 100%…1600%, same range as the details inspector
    const paintBox = (): void => {
      boxEl.style.left = `${bx}px`; boxEl.style.top = `${by}px`;
      boxEl.style.width = `${bw}px`; boxEl.style.height = `${bh}px`;
    };
    const sizeStage = (): void => {
      // Fit the asset's aspect into the workspace the MODE provides (the
      // .cat-crop-body pane), so the image keeps the size and place the
      // preview showed it at - entering crop must not shrink or shift the
      // picture (Andy, 2026-08-19). The old fixed dialog caps survive only
      // as the fallback for an unmeasurable container.
      const box = viewport.parentElement?.getBoundingClientRect();
      const maxW = box && box.width > 80 ? box.width - 24 : Math.min(680, window.innerWidth * 0.82);
      const maxH = box && box.height > 80 ? box.height - 24 : Math.min(460, window.innerHeight * 0.5);
      let w = maxW, h = maxW / aspect;
      if (h > maxH) { h = maxH; w = maxH * aspect; }
      fitW = Math.round(w); fitH = Math.round(h);
      viewport.style.width = `${fitW}px`;
      viewport.style.height = `${fitH}px`;
      stage.style.width = `${fitW * zoom}px`;
      stage.style.height = `${fitH * zoom}px`;
    };
    const initGeom = (): void => {
      sizeStage();
      // Default box: 60% centred (20% in from each side) so every handle sits well
      // clear of the stage edges and is easy to grab.
      const sw = stage.clientWidth, sh = stage.clientHeight;
      bx = sw * 0.2; by = sh * 0.2; bw = sw * 0.6; bh = sh * 0.6;
      paintBox();
    };
    if (vector) initGeom();
    else if (imgEl.complete && imgEl.naturalWidth) { aspect = imgEl.naturalWidth / imgEl.naturalHeight; initGeom(); }
    else imgEl.addEventListener('load', () => { aspect = imgEl.naturalWidth / imgEl.naturalHeight || 1; initGeom(); }, { once: true });

    const setZoom = (next: number, fx?: number, fy?: number): void => {
      const z2 = Math.min(ZMAX, Math.max(1, next));
      if (z2 === zoom) return;
      const r = z2 / zoom;
      const px = fx ?? viewport.clientWidth / 2, py = fy ?? viewport.clientHeight / 2;
      const sl = (viewport.scrollLeft + px) * r - px;
      const st = (viewport.scrollTop + py) * r - py;
      zoom = z2;
      stage.style.width = `${fitW * zoom}px`;
      stage.style.height = `${fitH * zoom}px`;
      bx *= r; by *= r; bw *= r; bh *= r;
      paintBox();
      viewport.scrollLeft = sl; viewport.scrollTop = st;
      hud?.setReadout(`${Math.round(zoom * 100)}%`);
      viewport.classList.toggle('is-zoomed', zoom > 1.001);
    };
    const hud = hudEl ? mountZoomHud(hudEl, {
      ariaLabel: t('Zoom'),
      classes: { btn: 'cat-zoom-btn', pct: 'cat-zoom-pct' },
      initialReadout: '100%',
      onZoom: (dir) => setZoom(zoom * (dir > 0 ? 1.5 : 1 / 1.5)),
      onFit: () => setZoom(1),
      outContent: ZOOM_OUT_ICON,
      inContent: ZOOM_IN_ICON,
      outAriaLabel: t('Zoom out'), outTitle: t('Zoom out'),
      inAriaLabel: t('Zoom in'), inTitle: t('Zoom in'),
      pctAriaLabel: t('Reset zoom'), pctTitle: t('Reset zoom'),
    }) : null;
    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = viewport.getBoundingClientRect();
      setZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    // Drag the box body to move; drag a corner handle or an edge (its full length is a
    // hit area) to resize (opposite side fixed); drag outside the box while zoomed to pan.
    const MIN = 16;
    let mode: string | null = null, sx = 0, sy = 0, ox = 0, oy = 0, ow = 0, oh = 0;
    stage.addEventListener('pointerdown', (e) => {
      const handle = (e.target as HTMLElement).closest<HTMLElement>('[data-h]');
      const onBox = (e.target as HTMLElement).closest('.cat-crop-box');
      if (handle) mode = handle.dataset.h!;
      else if (onBox) mode = 'move';
      else if (zoom > 1) mode = 'pan';
      else return;
      sx = e.clientX; sy = e.clientY;
      if (mode === 'pan') { ox = viewport.scrollLeft; oy = viewport.scrollTop; viewport.classList.add('is-panning'); }
      else { ox = bx; oy = by; ow = bw; oh = bh; }
      try { stage.setPointerCapture(e.pointerId); } catch { /* unsupported */ }
      e.preventDefault();
    });
    stage.addEventListener('pointermove', (e) => {
      if (!mode) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (mode === 'pan') { viewport.scrollLeft = ox - dx; viewport.scrollTop = oy - dy; return; }
      const sw = stage.clientWidth, sh = stage.clientHeight;
      if (mode === 'move') {
        bx = Math.min(sw - bw, Math.max(0, ox + dx));
        by = Math.min(sh - bh, Math.max(0, oy + dy));
      } else {
        let x0 = ox, y0 = oy, x1 = ox + ow, y1 = oy + oh;
        if (mode.includes('w')) x0 = Math.min(x1 - MIN, Math.max(0, ox + dx));
        if (mode.includes('e')) x1 = Math.max(x0 + MIN, Math.min(sw, ox + ow + dx));
        if (mode.includes('n')) y0 = Math.min(y1 - MIN, Math.max(0, oy + dy));
        if (mode.includes('s')) y1 = Math.max(y0 + MIN, Math.min(sh, oy + oh + dy));
        bx = x0; by = y0; bw = x1 - x0; bh = y1 - y0;
      }
      paintBox();
    });
    const endDrag = (e: PointerEvent): void => {
      if (!mode) return; mode = null;
      viewport.classList.remove('is-panning');
      try { stage.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    };
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);

    return {
      getFrac() {
        const sw = stage.clientWidth || 1, sh = stage.clientHeight || 1;
        return { fx: bx / sw, fy: by / sh, fw: bw / sw, fh: bh / sh };
      },
    };
  }

  // Crop-before-download: a dialog with the asset fitted into an aspect-matched stage
  // and a drag/resize crop box over it. The box is the ONLY way to change dimensions
  // (there is no width/height resize anywhere else): you frame a region and download
  // just that. The stage matches the asset's aspect, so the image fills it with no
  // letterbox. That makes the crop a straight fraction of the asset: box/stage gives a
  // fraction, which maps to asset pixels (raster, canvas-crop) or a narrowed viewBox
  // (vector, stays vector). The interaction core and the source prep are shared with
  // the inline crop mode (see wireCropBox / prepCropSource), so the two paths cannot
  // drift apart. The details modal's Crop action now opens the inline mode instead of
  // this standalone dialog. The dialog is kept as-is, driving its own crop box the
  // same way, so a future caller outside the details modal can still reach it.
  // Render the framed region. Vector gives a narrowed viewBox (SVG stays vector; PNG
  // rasterises that sub-viewBox). Raster gives a canvas cut of the source at natural
  // resolution. Every output is a modified copy, so it goes out signed
  // (downloadSigned): the crop, plus any theme/treatment already baked into the crop
  // source, in the action history, and the source's own credential as an ingredient.
  /** Straighten transforms the inline crop can bake in (rasters only). */
  interface CropTransform { rotate: number; quarter: number; skewX: number; skewY: number; flipH: boolean; flipV: boolean }

  async function downloadCrop(
    ref: AssetRef, vector: boolean, svgText: string | null, imgEl: HTMLImageElement,
    frac: { fx: number; fy: number; fw: number; fh: number }, fmt: string,
    baked: { theme?: IconTheme | null; treatment?: PhotoTreatment | null; origSvg?: string | null; transform?: CropTransform } = {},
    deliver?: CropDeliver,
  ): Promise<void> {
    const send: CropDeliver = deliver
      ?? (async (b, f, o) => { await downloadSigned(ref, b, f, downloadName(ref, f), o); });
    const { fx, fy, fw, fh } = frac;
    // Steps for what the crop SOURCE already carries (prepCropSource baked these in).
    const bakedEdits: C2paActionInput[] = [];
    const detail: Record<string, string> = {};
    if (baked.theme) {
      bakedEdits.push({ action: 'c2pa.color_adjustments', description: `Recoloured with the '${baked.theme.label ?? baked.theme.id}' icon colours (${baked.theme.c1 ?? '?'} / ${baked.theme.c2 ?? '?'})` });
      detail.theme = String(baked.theme.label ?? baked.theme.id);
      detail.colours = `${baked.theme.c1 ?? ''} / ${baked.theme.c2 ?? ''}`;
    }
    if (baked.treatment) {
      bakedEdits.push({ action: 'c2pa.color_adjustments', description: `Applied the '${baked.treatment.label ?? baked.treatment.id}' colour treatment` });
      detail.treatment = String(baked.treatment.label ?? baked.treatment.id);
    }
    if (vector && svgText) {
      const sourceBytes = baked.origSvg ? new TextEncoder().encode(baked.origSvg) : undefined;
      const [vx, vy, vw, vh] = svgViewBox(svgText);
      const box: [number, number, number, number] = [vx + fx * vw, vy + fy * vh, fw * vw, fh * vh];
      const cropped = cropSvg(svgText, box);
      const cropStep: C2paActionInput = {
        action: 'c2pa.cropped',
        description: `Cropped to ${Math.round(box[2])}×${Math.round(box[3])} of the ${Math.round(vw)}×${Math.round(vh)} artwork (viewBox units)`,
      };
      detail.crop = `${Math.round(box[2])}×${Math.round(box[3])} @ ${Math.round(box[0])},${Math.round(box[1])}`;
      if (fmt === 'svg') {
        await send(new Blob([cropped], { type: 'image/svg+xml' }), 'svg', {
          edits: [...bakedEdits, cropStep], detail, sourceBytes,
        });
        return;
      }
      const edge = 1024, ar = box[2] / box[3];
      const w = ar >= 1 ? edge : Math.max(1, Math.round(edge * ar));
      const h = ar >= 1 ? Math.max(1, Math.round(edge / ar)) : edge;
      await send(await svgToPng(cropped, w, h), 'png', {
        edits: [...bakedEdits, cropStep, { action: 'c2pa.converted', description: `Rasterised the SVG artwork to PNG at ${w}×${h}px` }],
        detail, dims: `${w}×${h}`, sourceBytes,
      });
      return;
    }
    // Raster: cut the source at its NATURAL pixels (fraction × naturalWidth/Height).
    const NW = imgEl.naturalWidth, NH = imgEl.naturalHeight;
    const sxp = Math.round(fx * NW), syp = Math.round(fy * NH);
    const swp = Math.max(1, Math.round(fw * NW)), shp = Math.max(1, Math.round(fh * NH));
    const canvas = document.createElement('canvas');
    canvas.width = swp; canvas.height = shp;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2D context');
    if (fmt === 'jpg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, swp, shp); }   // JPEG has no alpha
    const tf = baked.transform;
    if (tf) {
      // The exact matrix the preview showed: CSS `rotate() skewX() skewY()
      // scale()` composes left-to-right, and canvas calls post-multiply in the
      // same order - both about the IMAGE CENTRE (CSS's default transform
      // origin), with the crop rect measured in the untransformed layout box.
      const rad = ((tf.quarter * 90 + tf.rotate) * Math.PI) / 180;
      ctx.translate(-sxp, -syp);
      ctx.translate(NW / 2, NH / 2);
      ctx.rotate(rad);
      ctx.transform(1, 0, Math.tan((tf.skewX * Math.PI) / 180), 1, 0, 0);
      ctx.transform(1, Math.tan((tf.skewY * Math.PI) / 180), 0, 1, 0, 0);
      ctx.scale(tf.flipH ? -1 : 1, tf.flipV ? -1 : 1);
      ctx.translate(-NW / 2, -NH / 2);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(imgEl, 0, 0, NW, NH);
    } else {
      ctx.drawImage(imgEl, sxp, syp, swp, shp, 0, 0, swp, shp);
    }
    const mime = fmt === 'jpg' ? 'image/jpeg' : fmt === 'webp' ? 'image/webp' : 'image/png';
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, mime, 0.97));
    if (!blob) throw new Error('crop encode failed');
    const outFmt = fmt === 'jpg' ? 'jpg' : fmt;
    detail.crop = `${swp}×${shp}px @ ${sxp},${syp}`;
    const tfEdits: C2paActionInput[] = [];
    if (tf) {
      const bits = [
        tf.quarter * 90 + tf.rotate ? `rotated ${(tf.quarter * 90 + tf.rotate).toFixed(1)}°` : '',
        tf.skewX ? `skewed X ${tf.skewX.toFixed(1)}°` : '',
        tf.skewY ? `skewed Y ${tf.skewY.toFixed(1)}°` : '',
        tf.flipH ? 'flipped horizontally' : '',
        tf.flipV ? 'flipped vertically' : '',
      ].filter(Boolean).join(', ');
      if (bits) {
        tfEdits.push({ action: 'c2pa.edited', description: `Straightened (${bits})` });
        detail.straighten = bits;
      }
    }
    await send(blob, outFmt, {
      edits: [
        ...bakedEdits,
        ...tfEdits,
        { action: 'c2pa.cropped', description: `Cropped to ${swp}×${shp}px (from ${NW}×${NH}px)` },
        { action: 'c2pa.converted', description: `Rendered to ${outFmt.toUpperCase()}` },
      ],
      detail, dims: `${swp}×${shp}`,
    });
  }

  // Vector / themable icon: a small dialog to (optionally) recolour a themable icon via
  // the icon styler, then download as SVG or as PNG at a chosen size.
  async function openDownloadDialog(ref: AssetRef, initialTheme?: string | null): Promise<void> {
    let baseSvg: string;
    try {
      const r = await fetch(ref.url);
      baseSvg = await r.text();
      if (!/<svg[\s>]/i.test(baseSvg)) throw new Error('not svg');
    } catch { await directDownload(ref); return; }   // not fetchable/SVG → just save it
    if (!mounted) return;

    const themable = isThemable(ref) && iconThemes.length > 0;
    // Default to the ORIGINAL bytes (keeps a Content Credential intact); honour a
    // colour already chosen in the details view (initialTheme) as an explicit recolour.
    let themeId: string | null = themable
      ? ((initialTheme && iconThemes.some(t => t.id === initialTheme) ? initialTheme : ORIGINAL_THEME))
      : null;
    const aspect = svgAspect(baseSvg);
    const name = String(ref.meta?.name ?? ref.id);

    const currentSvg = (): string => {
      if (!themable || themeId === ORIGINAL_THEME || !themeId) return baseSvg;
      const t = iconThemes.find(x => x.id === themeId);
      const out = (t && restyleIconTheme(baseSvg, t)) || baseSvg;
      // A recolour changes the bytes, breaking any embedded credential's byte
      // binding - strip it here; the download re-signs the file with the
      // original credential preserved as an ingredient (downloadSigned).
      return out === baseSvg ? out : stripC2paManifest(out);
    };

    closeDownloadDialog();
    const content = `
      <h2 class="cat-dl-title">${t('Download {name}', { name })}</h2>
      <div class="cat-dl-preview"><img alt="" class="cat-dl-img"></div>
      ${themable ? `
      <div class="cat-dl-section">
        <span class="cat-dl-label">${t('Colours')}</span>
        <div class="cat-dl-themes" role="group" aria-label="${escape(t('Icon colours'))}">
          <button type="button" class="cat-dl-theme${themeId === ORIGINAL_THEME ? ' is-active' : ''}" data-theme="${ORIGINAL_THEME}" aria-pressed="${themeId === ORIGINAL_THEME}" title="${escape(t('Original - unchanged; keeps its Content Credential'))}" style="width:auto;padding:0 9px;font-size:11px;font-weight:600">${t('Original')}</button>
          ${iconThemes.map((th) => `
            <button type="button" class="cat-dl-theme${th.id === themeId ? ' is-active' : ''}" data-theme="${escape(th.id)}" data-sfx="shimmer" aria-pressed="${th.id === themeId}" title="${escape(th.label ?? th.id)}">
              <span class="cat-dl-duo" style="background:${escape(th.previewBg ?? '#fff')}"><i style="background:${escape(String(th.c2 ?? '#888'))}"></i><i style="background:${escape(String(th.c1 ?? '#333'))}"></i></span>
            </button>`).join('')}
        </div>
      </div>` : ''}
      <div class="cat-dl-section">
        <span class="cat-dl-label">${t('Format')}</span>
        <div class="cat-dl-fmt" role="radiogroup" aria-label="${escape(t('Format'))}">
          <label class="field-toggle"><input type="radio" class="field-radio" name="cat-dl-fmt" value="svg" checked> SVG <span class="cat-dl-hint">${t('vector')}</span></label>
          <label class="field-toggle"><input type="radio" class="field-radio" name="cat-dl-fmt" value="png"> PNG <span class="cat-dl-hint">${t('raster')}</span></label>
        </div>
      </div>
      <div class="cat-dl-actions">
        <button type="button" class="btn cat-dl-cancel">${t('Cancel')}</button>
        <button type="button" class="btn cat-dl-go modal-primary">${t('Download')}</button>
      </div>`;
    const modal = mountModal(content, {
      className: 'cat-dl',
      initialFocus: (el) => el.querySelector<HTMLElement>('.cat-dl-go'),
      onClose: () => { dlDialog = null; dlModal = null; },
    });
    const dlg = modal.el;
    dlDialog = dlg;
    dlModal = modal;

    const imgEl = dlg.querySelector<HTMLImageElement>('.cat-dl-img')!;
    const paintPreview = (): void => { imgEl.src = svgTextToDataUrl(currentSvg()); };
    paintPreview();
    const fmt = (): string => (dlg.querySelector<HTMLInputElement>('input[name="cat-dl-fmt"]:checked')?.value ?? 'svg');

    dlg.addEventListener('click', async (e) => {
      const t = e.target as HTMLElement;
      // Scope to THIS dialog's colour buttons (.cat-dl-theme). A bare [data-theme]
      // selector also matches the <html data-theme> root, so it hijacked EVERY click in
      // the dialog (Download included) → the theme branch returned early and no download
      // ever ran (all vector/icon downloads were dead).
      const themeBtn = t.closest<HTMLElement>('.cat-dl-theme');
      if (themeBtn) {
        themeId = themeBtn.dataset.theme!;
        dlg.querySelectorAll<HTMLElement>('[data-theme]').forEach(b => {
          const on = b === themeBtn; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on));
        });
        paintPreview();
        return;
      }
      if (t.closest('.cat-dl-cancel')) { closeDownloadDialog(); return; }
      if (t.closest('.cat-dl-go')) {
        const svg = currentSvg();
        const theme = themable && themeId && themeId !== ORIGINAL_THEME ? iconThemes.find(x => x.id === themeId) : null;
        const recoloured = Boolean(theme) && svg !== baseSvg;
        // The transform history + detail for the signed download. The original
        // (untouched SVG) is the one path that stays byte-exact and unsigned.
        const edits: C2paActionInput[] = recoloured
          ? [{ action: 'c2pa.color_adjustments', description: `Recoloured with the '${theme!.label ?? theme!.id}' icon colours (${theme!.c1 ?? '?'} / ${theme!.c2 ?? '?'})` }]
          : [];
        const detail: Record<string, string> = recoloured
          ? { theme: String(theme!.label ?? theme!.id), colours: `${theme!.c1 ?? ''} / ${theme!.c2 ?? ''}` }
          : {};
        const sourceBytes = new TextEncoder().encode(baseSvg);
        try {
          if (fmt() === 'png') {
            // No user resize (dimension changes live in the details-view crop). PNG renders
            // the whole asset at a sensible fixed resolution - longest edge 1024, aspect kept.
            const edge = 1024;
            const w = aspect >= 1 ? edge : Math.max(1, Math.round(edge * aspect));
            const h = aspect >= 1 ? Math.max(1, Math.round(edge / aspect)) : edge;
            await downloadSigned(ref, await svgToPng(svg, w, h), 'png', downloadName(ref, 'png'), {
              edits: [...edits, { action: 'c2pa.converted', description: `Rasterised the SVG artwork to PNG at ${w}×${h}px` }],
              detail, dims: `${w}×${h}`, sourceBytes,
            });
          } else if (recoloured) {
            await downloadSigned(ref, new Blob([svg], { type: 'image/svg+xml' }), 'svg', downloadName(ref, 'svg'), {
              edits, detail, sourceBytes,
            });
          } else {
            // Original SVG - byte-exact for library assets (any embedded
            // credential stays intact). A user upload was sanitised at ingest,
            // which stripped the in-file credential the record preserved - when
            // one exists, re-sign so even the unmodified save keeps the chain.
            const blob = new Blob([svg], { type: 'image/svg+xml' });
            if (ref.id.startsWith('user/') && await sourceIngredients(ref)) {
              await downloadSigned(ref, blob, 'svg', downloadName(ref, 'svg'), {
                edits: [{ action: 'c2pa.edited', description: 'Sanitised the SVG markup when added to the device library' }],
              });
            } else {
              await host.export.download(blob, downloadName(ref, 'svg'));
            }
          }
        } catch (err) { host.log?.('error', 'Catalog download failed', { id: ref.id, error: String(err) }); }
        closeDownloadDialog();
      }
    });
  }

  // Bake a photo treatment into a self-contained SVG wrapper (the source photo inlined as a
  // data URI + the treatment <filter>), at the photo's natural pixel size - the same wrapper
  // the bridge bakes at resolve, but built here so it works for user uploads too (which carry
  // no catalog format dimensions). Returns null when there's no valid treatment.
  async function treatedWrapperSvg(ref: AssetRef, treatmentId: string | null): Promise<{ svg: string; w: number; h: number } | null> {
    const def = treatmentId ? photoTreatments.find(t => t.id === treatmentId) : null;
    if (!def) return null;
    const blob = await (await fetch(ref.url)).blob();
    const href = await blobToDataUrl(blob);
    const { w, h } = await new Promise<{ w: number; h: number }>((res) => {
      const im = new Image();
      im.onload = () => res({ w: im.naturalWidth || 1, h: im.naturalHeight || 1 });
      im.onerror = () => res({ w: 1, h: 1 });
      im.src = href;
    });
    return { svg: wrapRasterWithTreatment({ href, width: w, height: h, treatment: def }), w, h };
  }

  // Raster "Download as": Original is byte-exact; choosing PNG/JPG/WebP always
  // runs a real encoder and checks the resulting container before naming it. The
  // common path is intentionally short (format + quality preset). Exact quality,
  // sizing and GPS metadata live in a clearly-labelled advanced disclosure.
  async function openPhotoDownloadDialog(ref: AssetRef, initialTreatment?: string | null): Promise<void> {
    if (ref.type !== 'raster' || ref.meta?.animated) { await directDownload(ref); return; }
    const hasTreatments = photoTreatments.length > 0;
    if (hasTreatments) ensureTreatmentDefs();
    let treatmentId: string | null = hasTreatments && initialTreatment && photoTreatments.some(t => t.id === initialTreatment)
      ? initialTreatment : null;
    const name = String(ref.meta?.name ?? ref.id);
    const sourceFormat = String(ref.format || 'file').toLowerCase();
    const webpSupported = (() => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        return canvas.toDataURL('image/webp').startsWith('data:image/webp');
      } catch { return false; }
    })();

    closeDownloadDialog();
    const content = `
      <h2 class="cat-dl-title">${t('Download {name}', { name })}</h2>
      <div class="cat-dl-preview"><img alt="" class="cat-dl-img" src="${escape(ref.url)}"></div>
      ${hasTreatments ? `<div class="cat-dl-section">
        <span class="cat-dl-label">${t('Colour')}</span>
        ${treatmentSwatchRow(treatmentId)}
      </div>` : ''}
      <div class="cat-dl-section">
        <span class="cat-dl-label">${t('Format')}</span>
        <select class="field-select cat-dl-select" name="cat-dl-fmt" aria-label="${escape(t('Format'))}">
          <option value="original">${t('Original')} (${escape(sourceFormat.toUpperCase())})</option>
          <option value="png">PNG · ${t('lossless')}</option>
          <option value="jpg">JPG · ${t('smaller')}</option>
          ${webpSupported ? `<option value="webp">WebP · ${t('modern')}</option>` : ''}
        </select>
      </div>
      <div class="cat-dl-section cat-dl-quality-row" data-lossy-control hidden>
        <label class="cat-dl-field"><span class="cat-dl-label">${t('Quality')}</span>
          <select class="field-select cat-dl-select" name="cat-dl-quality">
            <option value="balanced">${t('Balanced')}</option>
            <option value="smaller">${t('Smaller file')}</option>
            <option value="best">${t('Best quality')}</option>
          </select>
        </label>
      </div>
      <details class="cat-dl-advanced" data-convert-control hidden>
        <summary>${t('Advanced settings')}</summary>
        <div class="cat-dl-advanced-grid">
          <label class="cat-dl-field" data-lossy-control hidden><span>${t('Exact quality')}</span><span class="cat-dl-unit"><input class="field-input" name="cat-dl-exact-quality" type="number" min="1" max="100" placeholder="85">%</span></label>
          <label class="cat-dl-field"><span>${t('Maximum edge')}</span><span class="cat-dl-unit"><input class="field-input" name="cat-dl-max-edge" type="number" min="1" max="16384" placeholder="${t('Original')}"> px</span></label>
          <label class="field-toggle cat-dl-check"><input type="checkbox" class="field-checkbox" name="cat-dl-gps"> ${t('Keep location metadata')}</label>
        </div>
      </details>
      <p class="cat-dl-provenance">${t('Conversions are made on this device. The source Content Credential is kept in the new file’s provenance chain.')}</p>
      <p class="cat-dl-status" aria-live="polite"></p>
      <div class="cat-dl-actions">
        <button type="button" class="btn cat-dl-cancel">${t('Cancel')}</button>
        <button type="button" class="btn cat-dl-go modal-primary">${t('Download')}</button>
      </div>`;
    const modal = mountModal(content, {
      className: 'cat-dl',
      initialFocus: (el) => el.querySelector<HTMLElement>('.cat-dl-go'),
      onClose: () => { dlDialog = null; dlModal = null; },
    });
    const dlg = modal.el;
    dlDialog = dlg;
    dlModal = modal;

    const imgEl = dlg.querySelector<HTMLImageElement>('.cat-dl-img')!;
    const applyPreview = (): void => { imgEl.style.filter = treatmentId ? `url(#${TREATMENT_FILTER_PREFIX}${treatmentId})` : ''; };
    const formatSelect = dlg.querySelector<HTMLSelectElement>('[name="cat-dl-fmt"]')!;
    const syncConvertControls = (): void => {
      const converting = formatSelect.value !== 'original' || Boolean(treatmentId);
      dlg.querySelectorAll<HTMLElement>('[data-convert-control]').forEach(el => { el.hidden = !converting; });
      const effectiveFormat = formatSelect.value === 'original' ? sourceFormat : formatSelect.value;
      const lossy = converting && (effectiveFormat === 'jpg' || effectiveFormat === 'jpeg' || effectiveFormat === 'webp');
      dlg.querySelectorAll<HTMLElement>('[data-lossy-control]').forEach(el => { el.hidden = !lossy; });
    };
    applyPreview();
    syncConvertControls();
    formatSelect.addEventListener('change', syncConvertControls);

    dlg.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      const treatBtn = target.closest<HTMLElement>('.cat-dl-treat');
      if (treatBtn) {
        treatmentId = treatBtn.dataset.treatment || null;
        dlg.querySelectorAll<HTMLElement>('.cat-dl-treat').forEach(b => {
          const on = b === treatBtn; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on));
        });
        applyPreview();
        syncConvertControls();
        return;
      }
      if (target.closest('.cat-dl-cancel')) { closeDownloadDialog(); return; }
      if (target.closest('.cat-dl-go')) {
        const go = dlg.querySelector<HTMLButtonElement>('.cat-dl-go')!;
        const status = dlg.querySelector<HTMLElement>('.cat-dl-status')!;
        go.disabled = true;
        status.textContent = t('Preparing download…');
        try {
          const mod = await import('../lib/catalog-download.ts');
          const chosen = dlg.querySelector<HTMLSelectElement>('[name="cat-dl-fmt"]')?.value ?? 'original';
          const sourceImageFormat = mod.imageDownloadFormat(sourceFormat);
          if (chosen === 'original' && !treatmentId) {
            await directDownload(ref);
            closeDownloadDialog();
            return;
          }
          const f = (chosen === 'original' ? (sourceImageFormat ?? 'png') : chosen) as import('../lib/catalog-download.ts').ImageDownloadFormat;
          const preset = (dlg.querySelector<HTMLSelectElement>('[name="cat-dl-quality"]')?.value ?? 'balanced') as import('../lib/catalog-download.ts').DownloadQuality;
          const exactRaw = dlg.querySelector<HTMLInputElement>('[name="cat-dl-exact-quality"]')?.value;
          const maxEdgeRaw = dlg.querySelector<HTMLInputElement>('[name="cat-dl-max-edge"]')?.value;
          const quality = mod.imageQualityValue(preset, exactRaw ? Number(exactRaw) : undefined);
          const maxEdge = maxEdgeRaw ? Number(maxEdgeRaw) : undefined;
          const keepGps = dlg.querySelector<HTMLInputElement>('[name="cat-dl-gps"]')?.checked === true;
          const wrap = treatmentId ? await treatedWrapperSvg(ref, treatmentId) : null;
          let converted: { blob: Blob; format: import('../lib/catalog-download.ts').ImageDownloadFormat; width: number; height: number };
          if (wrap) {
            const scale = maxEdge && maxEdge > 0 && Math.max(wrap.w, wrap.h) > maxEdge
              ? maxEdge / Math.max(wrap.w, wrap.h) : 1;
            const width = Math.max(1, Math.round(wrap.w * scale));
            const height = Math.max(1, Math.round(wrap.h * scale));
            const blob = await svgToRaster(wrap.svg, width, height, mod.imageDownloadMime(f), quality);
            const actual = mod.imageDownloadFormat(blob.type);
            if (actual !== f) throw new Error(t('This browser returned {actual} instead of {requested}.', {
              actual: blob.type || t('an unknown format'), requested: mod.imageDownloadMime(f),
            }));
            converted = { blob, format: actual, width, height };
          } else {
            const source = await (await fetch(ref.url)).blob();
            converted = await mod.transcodeCatalogImage(host.images, source, { format: f, quality, maxEdge, keepGps });
          }
          const def = treatmentId ? photoTreatments.find(x => x.id === treatmentId) : null;
          const label = def ? String(def.label ?? def.id) : '';
          const resized = Boolean(maxEdge && ref.width && ref.height && Math.max(ref.width, ref.height) > maxEdge);
          const edits: C2paActionInput[] = [
            ...(label ? [{ action: 'c2pa.color_adjustments', description: `Applied the '${label}' colour treatment` } as C2paActionInput] : []),
            ...(resized ? [{ action: 'c2pa.resized', description: `Resized to ${converted.width}×${converted.height}px` } as C2paActionInput] : []),
            { action: 'c2pa.converted', description: `Encoded to ${converted.format.toUpperCase()} at ${converted.width}×${converted.height}px` },
          ];
          await downloadSigned(ref, converted.blob, converted.format, downloadName(ref, converted.format), {
            edits,
            detail: {
              ...(label ? { treatment: label } : {}),
              quality: `${Math.round(quality * 100)}%`,
              ...(maxEdge ? { maximumEdge: `${Math.round(maxEdge)}px` } : {}),
              locationMetadata: keepGps ? 'kept' : 'removed',
            },
            dims: `${converted.width}×${converted.height}`,
            requireCredential: true,
          });
          closeDownloadDialog();
        } catch (err) {
          host.log?.('error', 'Catalog photo download failed', { id: ref.id, error: String(err) });
          status.textContent = err instanceof Error ? err.message : t('Could not prepare this download.');
          go.disabled = false;
        }
      }
    });
  }

  /** Audio download-as keeps the first choice deliberately boring: Original is
   *  byte-exact. A selected container is decoded and re-encoded on-device; the
   *  quality stop is approachable, while exact bitrate/sample depth are one
   *  discoverable disclosure away. */
  async function openAudioDownloadDialog(ref: AssetRef): Promise<void> {
    const [formatSupport, audio] = await Promise.all([
      import('../bridge/format-support.ts'), import('../lib/audio-encode.ts'),
    ]);
    await formatSupport.probeWebCodecsAudioSupport();
    const sourceFormat = String(ref.format || 'file').toLowerCase();
    if (!audio.isAudioFormat(sourceFormat)) { await directDownload(ref); return; }
    const support = formatSupport.audioSupport();
    const labels: Record<import('../lib/audio-encode.ts').AudioFormat, string> = {
      wav: 'WAV · lossless', mp3: 'MP3 · compatible', m4a: 'M4A · AAC',
      aac: 'AAC · stream', opus: 'Opus · WebM', ogg: 'Ogg · Opus', flac: 'FLAC · lossless',
    };
    const formats = audio.AUDIO_FORMATS.filter(f => support[f]);
    const name = String(ref.meta?.name ?? ref.id);
    closeDownloadDialog();
    const content = `
      <h2 class="cat-dl-title">${t('Download {name}', { name })}</h2>
      <div class="cat-dl-media-mark" aria-hidden="true">${CAT_ICONS.audio}</div>
      <div class="cat-dl-section">
        <label class="cat-dl-field"><span class="cat-dl-label">${t('Format')}</span>
          <select class="field-select cat-dl-select" name="cat-dl-fmt">
            <option value="original">${t('Original')} (${escape(sourceFormat.toUpperCase())})</option>
            ${formats.map(f => `<option value="${f}">${escape(labels[f])}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="cat-dl-section" data-lossy-control hidden>
        <label class="cat-dl-field"><span class="cat-dl-label">${t('Quality')}</span>
          <select class="field-select cat-dl-select" name="cat-dl-quality">
            <option value="balanced">${t('Balanced')}</option>
            <option value="smaller">${t('Smaller file')}</option>
            <option value="best">${t('Best quality')}</option>
          </select>
        </label>
      </div>
      <details class="cat-dl-advanced" data-advanced-control hidden>
        <summary>${t('Advanced settings')}</summary>
        <div class="cat-dl-advanced-grid">
          <label class="cat-dl-field" data-lossy-control hidden><span>${t('Exact bitrate')}</span><span class="cat-dl-unit"><input class="field-input" name="cat-dl-bitrate" type="number" min="32" max="512" placeholder="192"> kbps</span></label>
          <label class="cat-dl-field" data-wav-control hidden><span>${t('WAV sample format')}</span>
            <select class="field-select" name="cat-dl-sample">
              <option value="int16">16-bit PCM</option><option value="float32">32-bit float</option>
            </select>
          </label>
        </div>
      </details>
      <p class="cat-dl-provenance">${t('Conversion happens on this device. The source Content Credential is kept as an ingredient in the new file.')}</p>
      <p class="cat-dl-status" aria-live="polite"></p>
      <div class="cat-dl-actions"><button type="button" class="btn cat-dl-cancel">${t('Cancel')}</button><button type="button" class="btn cat-dl-go modal-primary">${t('Download')}</button></div>`;
    const modal = mountModal(content, {
      className: 'cat-dl', initialFocus: el => el.querySelector<HTMLElement>('.cat-dl-go'),
      onClose: () => { dlDialog = null; dlModal = null; },
    });
    const dlg = modal.el;
    dlDialog = dlg;
    dlModal = modal;
    const formatSelect = dlg.querySelector<HTMLSelectElement>('[name="cat-dl-fmt"]')!;
    const syncConvertControls = (): void => {
      const f = formatSelect.value;
      const converting = f !== 'original';
      const lossy = converting && f !== 'wav' && f !== 'flac';
      dlg.querySelectorAll<HTMLElement>('[data-lossy-control]').forEach(el => { el.hidden = !lossy; });
      dlg.querySelectorAll<HTMLElement>('[data-wav-control]').forEach(el => { el.hidden = f !== 'wav'; });
      dlg.querySelectorAll<HTMLElement>('[data-advanced-control]').forEach(el => { el.hidden = !converting || f === 'flac'; });
    };
    formatSelect.addEventListener('change', syncConvertControls);
    syncConvertControls();
    dlg.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('.cat-dl-cancel')) { closeDownloadDialog(); return; }
      if (!target.closest('.cat-dl-go')) return;
      const chosen = dlg.querySelector<HTMLSelectElement>('[name="cat-dl-fmt"]')?.value ?? 'original';
      if (chosen === 'original') { closeDownloadDialog(); void directDownload(ref); return; }
      if (!audio.isAudioFormat(chosen)) return;
      const preset = (dlg.querySelector<HTMLSelectElement>('[name="cat-dl-quality"]')?.value ?? 'balanced') as import('../lib/catalog-download.ts').DownloadQuality;
      const exact = dlg.querySelector<HTMLInputElement>('[name="cat-dl-bitrate"]')?.value;
      const sample = (dlg.querySelector<HTMLSelectElement>('[name="cat-dl-sample"]')?.value ?? 'int16') as import('../../../../engine/src/wav.ts').WavSampleFormat;
      closeDownloadDialog();
      const job = startJob({ title: t('Converting audio') });
      void (async () => {
        await job.started;
        try {
          const mod = await import('../lib/catalog-download.ts');
          const bitrate = mod.audioBitrateValue(preset, exact ? Number(exact) : undefined);
          const result = await mod.transcodeCatalogAudio(ref.url, {
            format: chosen, bitrate, ...(chosen === 'wav' ? { sampleFormat: sample } : {}),
          });
          await downloadSigned(ref, result.blob, result.format, downloadName(ref, result.format), {
            edits: [{ action: 'c2pa.converted', description: `Transcoded to ${result.format.toUpperCase()}${chosen === 'wav' ? ` (${sample})` : ` at ${Math.round(bitrate / 1000)} kbps`}` }],
            detail: {
              format: result.format.toUpperCase(),
              ...(chosen === 'wav' ? { sampleFormat: sample } : { bitrate: `${Math.round(bitrate / 1000)} kbps` }),
            },
            requireCredential: true,
          });
          job.finish();
        } catch (err) {
          host.log?.('error', 'Catalog audio conversion failed', { id: ref.id, error: String(err) });
          job.fail(err);
        }
      })();
    });
  }

  /** Video download-as uses the existing streaming decoder/muxer: source cadence
   *  by default, three approachable quality stops, exact FPS/bitrate for experts.
   *  The heavy-job queue keeps concurrent transcodes from exhausting the tab. */
  async function openVideoDownloadDialog(ref: AssetRef): Promise<void> {
    const formatSupport = await import('../bridge/format-support.ts');
    await formatSupport.probeWebCodecsVideoSupport();
    const support = formatSupport.videoSupport();
    const targets = (['mp4', 'webm'] as const).filter(f => support[f]);
    if (!targets.length) { await directDownload(ref); return; }
    const sourceFormat = String(ref.format || 'file').toLowerCase();
    const name = String(ref.meta?.name ?? ref.id);
    closeDownloadDialog();
    const content = `
      <h2 class="cat-dl-title">${t('Download {name}', { name })}</h2>
      <div class="cat-dl-media-mark" aria-hidden="true">${CAT_ICONS.motion}</div>
      <div class="cat-dl-section"><label class="cat-dl-field"><span class="cat-dl-label">${t('Format')}</span>
        <select class="field-select cat-dl-select" name="cat-dl-fmt">
          <option value="original">${t('Original')} (${escape(sourceFormat.toUpperCase())})</option>
          ${targets.map(f => `<option value="${f}">${f.toUpperCase()} · ${f === 'mp4' ? t('compatible') : t('open format')}</option>`).join('')}
        </select>
      </label></div>
      <div class="cat-dl-section" data-convert-control hidden><label class="cat-dl-field"><span class="cat-dl-label">${t('Quality')}</span>
        <select class="field-select cat-dl-select" name="cat-dl-quality"><option value="balanced">${t('Balanced')}</option><option value="smaller">${t('Smaller file')}</option><option value="best">${t('Best quality')}</option></select>
      </label></div>
      <details class="cat-dl-advanced" data-convert-control hidden><summary>${t('Advanced settings')}</summary><div class="cat-dl-advanced-grid">
        <label class="cat-dl-field"><span>${t('Frame rate')}</span><span class="cat-dl-unit"><input class="field-input" name="cat-dl-fps" type="number" min="1" max="60" placeholder="${t('Source')}"> fps</span></label>
        <label class="cat-dl-field"><span>${t('Exact bitrate')}</span><span class="cat-dl-unit"><input class="field-input" name="cat-dl-bitrate" type="number" min="1" max="24" step="0.1" placeholder="${t('Automatic')}"> Mbps</span></label>
      </div><p class="cat-dl-fineprint">${t('On-device conversion supports clips up to 2 minutes and 4K.')}</p></details>
      <p class="cat-dl-provenance">${t('The source Content Credential and edit history are carried into the transcoded file.')}</p>
      <div class="cat-dl-actions"><button type="button" class="btn cat-dl-cancel">${t('Cancel')}</button><button type="button" class="btn cat-dl-go modal-primary">${t('Download')}</button></div>`;
    const modal = mountModal(content, {
      className: 'cat-dl', initialFocus: el => el.querySelector<HTMLElement>('.cat-dl-go'),
      onClose: () => { dlDialog = null; dlModal = null; },
    });
    const dlg = modal.el;
    dlDialog = dlg;
    dlModal = modal;
    const formatSelect = dlg.querySelector<HTMLSelectElement>('[name="cat-dl-fmt"]')!;
    const syncConvertControls = (): void => {
      dlg.querySelectorAll<HTMLElement>('[data-convert-control]').forEach(el => { el.hidden = formatSelect.value === 'original'; });
    };
    formatSelect.addEventListener('change', syncConvertControls);
    syncConvertControls();
    dlg.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('.cat-dl-cancel')) { closeDownloadDialog(); return; }
      if (!target.closest('.cat-dl-go')) return;
      const chosen = dlg.querySelector<HTMLSelectElement>('[name="cat-dl-fmt"]')?.value ?? 'original';
      if (chosen === 'original') { closeDownloadDialog(); void directDownload(ref); return; }
      if (chosen !== 'mp4' && chosen !== 'webm') return;
      const preset = (dlg.querySelector<HTMLSelectElement>('[name="cat-dl-quality"]')?.value ?? 'balanced') as import('../bridge/video-mime.ts').VideoQuality;
      const fpsRaw = dlg.querySelector<HTMLInputElement>('[name="cat-dl-fps"]')?.value;
      const bitrateRaw = dlg.querySelector<HTMLInputElement>('[name="cat-dl-bitrate"]')?.value;
      const fps = fpsRaw ? Math.max(1, Math.min(60, Number(fpsRaw))) : 0;
      const controller = new AbortController();
      closeDownloadDialog();
      const job = startJob({ title: t('Converting video'), cancel: () => controller.abort() });
      void (async () => {
        await job.started;
        if (job.cancelled) return;
        try {
          const [{ videoBitrateValue }, { transcodeVideo }] = await Promise.all([
            import('../lib/catalog-download.ts'), import('../lib/video-jobs.ts'),
          ]);
          const bitrate = bitrateRaw
            ? videoBitrateValue(ref.width ?? 1280, ref.height ?? 720, fps || 30, preset, Number(bitrateRaw))
            : undefined;
          const result = await transcodeVideo(ref, { format: chosen, fps, bitrate, quality: preset }, {
            isCancelled: () => job.cancelled || controller.signal.aborted,
            onProgress: (done, total) => job.progress(done, total, t('Encoding frames')),
          });
          if (!result || job.cancelled) return;
          await downloadSigned(ref, result.blob, result.format, downloadName(ref, result.format), {
            edits: [{ action: 'c2pa.converted', description: `Transcoded to ${result.format.toUpperCase()} at ${Number(result.fps.toFixed(2))} fps and ${(result.bitrate / 1_000_000).toFixed(1)} Mbps` }],
            detail: { format: result.format.toUpperCase(), frameRate: `${Number(result.fps.toFixed(2))} fps`, bitrate: `${(result.bitrate / 1_000_000).toFixed(1)} Mbps` },
            dims: `${result.width}×${result.height}`,
            requireCredential: true,
          });
          job.finish();
        } catch (err) {
          host.log?.('error', 'Catalog video conversion failed', { id: ref.id, error: String(err) });
          job.fail(err);
        }
      })();
    });
  }

  /** One routing rule for tiles and the details modal, so no entry point can
   *  accidentally bypass a selected conversion format. */
  async function openAssetDownloadDialog(
    ref: AssetRef, initialTheme?: string | null, initialTreatment?: string | null,
  ): Promise<void> {
    if (isVector(ref) || isThemable(ref)) return openDownloadDialog(ref, initialTheme);
    if (ref.type === 'raster') return openPhotoDownloadDialog(ref, initialTreatment);
    if (ref.type === 'audio') return openAudioDownloadDialog(ref);
    if (ref.type === 'video') return openVideoDownloadDialog(ref);
    return directDownload(ref);
  }

  // ── wiring ───────────────────────────────────────────────────────────────────
  // Recolour every themable icon in a category group in place (the category "Colours"
  // switcher). A null theme restores the base URL; base SVGs are cached (iconSvgCache) so
  // flipping between colours never re-fetches. Best-effort per tile - a failure leaves it.
  async function retheemeGroup(group: HTMLElement, themeId: string | null): Promise<void> {
    const th = themeId ? iconThemes.find(x => x.id === themeId) : null;
    // Recolour every icon in the group concurrently. The old serial `for…await`
    // did up to ~111 network round-trips one after another on the first colour
    // pick (before iconSvgCache warms), stalling the whole group visibly.
    await Promise.all([...group.querySelectorAll<HTMLElement>('.cat-tile')].map(async tile => {
      const id = tile.dataset.id;
      const ref = id ? assetById.get(id) : null;
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
  function ensureTreatmentDefs(): void {
    if (!photoTreatments.length || viewEl.querySelector('#lolly-pt-defs')) return;
    const defs = photoTreatments.map(t => treatmentFilterSvg(t, `${TREATMENT_FILTER_PREFIX}${t.id}`)).join('');
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
  function retreatGroup(group: HTMLElement, treatmentId: string | null): void {
    const def = treatmentId ? photoTreatments.find(t => t.id === treatmentId) : null;
    for (const tile of group.querySelectorAll<HTMLElement>('.cat-tile')) {
      const ref = tile.dataset.id ? assetById.get(tile.dataset.id) : null;
      const img = tile.querySelector<HTMLElement>('.cat-thumb');
      if (ref?.type !== 'raster' || !(img instanceof HTMLImageElement)) continue;
      img.style.filter = def ? `url(#${TREATMENT_FILTER_PREFIX}${def.id})` : '';
    }
  }

  // Re-apply the active treatment to every raster group after a (re-)render - the wash
  // is a CSS style on fresh tiles, so it must be re-stamped when the grid rebuilds.
  function reapplyTreatment(): void {
    ensureTreatmentDefs();
    if (!catPhotoTreatment) return;
    viewEl.querySelectorAll<HTMLElement>('.cat-group').forEach(g => retreatGroup(g, catPhotoTreatment));
  }

  function wire(): void {
    const body = viewEl.querySelector<HTMLElement>('.catalog-body');
    if (!body) return;

    body.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;

      // "Clear search" link in the no-results copy (the shell bar owns its own ✕;
      // its onQuery('') notification lands in the claim below and re-renders).
      const clr = target.closest<HTMLElement>('[data-search-clear]');
      if (clr) { e.preventDefault(); clearSearchBar({ focus: true }); return; }

      // Swatches-section palette download - exports the palette exactly as shown.
      const sdl = target.closest<HTMLElement>('[data-swatch-dl]');
      if (sdl) {
        try {
          const { blob, filename } = exportSwatches(paletteEntriesToSwatches(palette), sdl.dataset.swatchDl as SwatchExportFormat);
          await host.export.download(blob, filename);
          announce(tRaw('Palette downloaded as {filename}', { filename }));
        } catch { announce(t('Couldn’t export the palette.')); }
        return;
      }

      // Retry the catalogue load after a total sync failure (the failed state's control).
      const retry = target.closest<HTMLButtonElement>('.cat-retry');
      if (retry) {
        retry.disabled = true; retry.textContent = t('Retrying…');
        await reload();
        if (mounted) render();
        return;
      }

      // Selection dot. Shift-click extends from the anchor instead of toggling - see
      // lib/tile-select.ts (the same gesture Projects uses).
      const check = target.closest<HTMLElement>('[data-select]');
      if (check) {
        const id = check.dataset.select!;
        tileSelect.onDotClick(id, e.shiftKey, () => toggleSelect(id));
        return;
      }

      const selectAll = target.closest<HTMLElement>('[data-selectall]');
      if (selectAll) { selectAllUploads(); return; }

      // "Script audio" (uploads section): the lazy TTS dialog; a saved clip lands in
      // "Your uploads", so reload + repaint exactly like a dropzone ingest.
      const scriptAudioBtn = target.closest<HTMLElement>('[data-script-audio]');
      if (scriptAudioBtn) {
        const { openScriptAudioDialog } = await import('./script-audio.ts');
        const ref = await openScriptAudioDialog(host as unknown as PickerHost);
        if (ref && mounted) { await reload(); if (mounted) rerender(); }
        return;
      }

      // "Paste text" (uploads section): the lazy paste dialog; the saved text
      // asset lands in "Your uploads", so reload + repaint like a dropzone ingest.
      const pasteTextBtn = target.closest<HTMLElement>('[data-paste-text]');
      if (pasteTextBtn) {
        const { openPasteTextDialog } = await import('./paste-text.ts');
        const ref = await openPasteTextDialog(host as unknown as PickerHost);
        if (ref && mounted) { await reload(); if (mounted) rerender(); }
        return;
      }

      // Category "Colour" treatment swatch - wash this group's raster photos in place
      // (checked before the icon branch: treatment buttons also carry .cat-dl-theme).
      const treatSw = target.closest<HTMLElement>('.cat-dl-treat');
      const treatGroup = treatSw?.closest<HTMLElement>('.cat-group');
      if (treatSw && treatGroup) {
        catPhotoTreatment = treatSw.dataset.treatment || null;
        treatGroup.querySelectorAll<HTMLElement>('.cat-dl-treat').forEach(b => {
          const on = b === treatSw; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on));
        });
        retreatGroup(treatGroup, catPhotoTreatment);
        return;
      }

      // Category "Colours" swatch - recolour this group's themable icons in place.
      const catSw = target.closest<HTMLElement>('.cat-dl-theme');
      const catGroup = catSw?.closest<HTMLElement>('.cat-group');
      if (catSw && catGroup) {
        catIconTheme = catSw.dataset.theme ?? null;
        catGroup.querySelectorAll<HTMLElement>('.cat-dl-theme').forEach(b => {
          const on = b === catSw; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on));
        });
        await retheemeGroup(catGroup, catIconTheme);
        return;
      }

      const openBtn = target.closest<HTMLElement>('[data-open]');
      if (openBtn) {
        const ref = assetById.get(openBtn.dataset.open!);
        // Carry the category grid's colour choice into the details modal - an icon opens on
        // its category theme, a photo on its category treatment (openDetails picks the one
        // that applies to the asset's type; passing both is harmless).
        if (ref) openDetails(ref, catIconTheme, catPhotoTreatment);
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
        persistCollapsed();
        syncSectionUrl();
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
        persistCollapsed();
        syncSectionUrl();
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
        if (next !== typeFilter) { typeFilter = next; renderBody(); }
        return;
      }

      if (target.closest('.cat-showhidden')) { showHidden = !showHidden; rerender(); return; }

      // Star toggle on a swatch card → flip its membership in the favourites strip.
      const sFav = target.closest<HTMLElement>('.plat-swatch-fav');
      if (sFav) {
        const key = swatchFavKey(sFav.dataset.favSwatch ?? '');
        const on = !favSet.has(key);
        if (on) favSet.add(key); else favSet.delete(key);
        if (profile) void saveFavouriteAssets(host, profile, favSet);
        sFav.classList.toggle('is-on', on);
        sFav.setAttribute('aria-pressed', String(on));
        const label = on ? t('Remove from favourites') : t('Add to favourites');
        sFav.setAttribute('aria-label', label);
        sFav.title = label;
        refreshFavStrip();
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
      stub.textContent = assetById.get(id)?.type ?? 'image';
      img.replaceWith(stub);
    }, true);

    // ── Bulk-action bar (lives in .catalog, outside .catalog-body) ──────────────
    viewEl.querySelector<HTMLElement>('.cat-bulkbar')?.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-bulk]');
      if (b) handleBulk(b.dataset.bulk!);
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
    const voDisclosure = wireDisclosure(voBtn, voPop, { onToggle: (open) => { viewOptsOpen = open; } });
    closeViewOpts = () => voDisclosure.close();
    // Gallery ↔ Cover Flow: switch the live strip in place (no full re-render).
    voPop?.addEventListener('click', (e) => {
      const layoutSeg = (e.target as HTMLElement).closest<HTMLElement>('[data-catlayout]');
      if (layoutSeg) {
        const next = layoutSeg.dataset.catlayout === 'list' ? 'list' : 'grid';
        if (next === catLayout) return;
        catLayout = next;
        try { localStorage.setItem(LAYOUT_PREF_KEY, catLayout); } catch { /* storage off */ }
        rerender();
        return;
      }
      const densitySeg = (e.target as HTMLElement).closest<HTMLElement>('[data-catdensity]');
      if (densitySeg) {
        const next = densitySeg.dataset.catdensity === 'compact' ? 'compact' : 'comfortable';
        if (next === catDensity) return;
        catDensity = next;
        try { localStorage.setItem(DENSITY_PREF_KEY, catDensity); } catch { /* storage off */ }
        rerender();
        return;
      }
      // Sort segment (plans/132 WP-A): re-orders every section in place.
      const sortSeg = (e.target as HTMLElement).closest<HTMLElement>('[data-catsort]');
      if (sortSeg) {
        const next = sortSeg.dataset.catsort as CatSort;
        if (!CAT_SORTS.includes(next) || next === catSort) return;
        catSort = next;
        try { localStorage.setItem(SORT_PREF_KEY, catSort); } catch { /* storage off */ }
        voPop.querySelectorAll<HTMLElement>('[data-catsort]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.catsort === catSort)));
        rerender();
        return;
      }
      const seg = (e.target as HTMLElement).closest<HTMLElement>('[data-favview]');
      if (!seg) return;
      const next: FeaturedViewMode = seg.dataset.favview === 'coverflow' ? 'coverflow' : 'gallery';
      const changed = next !== favView;
      favView = next;
      try { localStorage.setItem(FAV_VIEW_KEY, favView); } catch { /* storage off */ }
      voPop.querySelectorAll<HTMLElement>('[data-favview]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.favview === favView)));
      featuredHandle?.setViewMode(favView);
      // Same cue as the main gallery's Gallery|Cover Flow switch (gallery.ts) - Cover Flow is
      // cool & futuristic, Gallery is refined.
      if (changed) playSfx(favView === 'coverflow' ? 'coverflow' : 'gallery');
    });
    // Show / hide the favourites strip - mount or tear down in place (no full re-render,
    // so the open popover isn't disturbed).
    voPop?.querySelector<HTMLInputElement>('.cat-favstrip-toggle')?.addEventListener('change', (e) => {
      favStripOn = (e.target as HTMLInputElement).checked;
      try { localStorage.setItem(FAV_STRIP_KEY, favStripOn ? 'on' : 'off'); } catch { /* storage off */ }
      const assets = viewEl.querySelector<HTMLElement>('.cat-assets');
      let mount = viewEl.querySelector<HTMLElement>('.cat-fav-strip');
      if (favStripOn) {
        if (!mount && assets && (favItems().length || favSwatches().length)) {
          mount = document.createElement('div'); mount.className = 'cat-fav-strip';
          assets.insertBefore(mount, assets.firstChild);
        }
        mountFavStrip();
      } else {
        featuredHandle?.destroy(); featuredHandle = null; mount?.remove();
      }
    });

    // Mobile: the avatar opens the shared profile menu (theme + settings); desktop
    // keeps it a plain link to /profile. Matches Tools + Projects. `headshotUrl` is
    // already resolved (in reload(), before the first render) so no deferred fetch here.
    mountViewTopbar(viewEl, host);
  }

  // ── mount ──────────────────────────────────────────────────────────────────────
  // A lighter, brighter arrival "ahhh" led in by four rising "stacking" clicks - the catalog's
  // counterpart to the gallery's bassy one. One-shot, gesture-gated, silent when sound's off.
  playCatalogAah();
  // Claim the shell's persistent search bar (plans/99 M1). The tap applies the same
  // trim+lowercase the old inline handler did, so filtering is byte-identical.
  const releaseSearch = claimSearchBar({
    placeholder: t('Search the catalogue…'),
    ariaLabel: t('Search the catalogue'),
    value: query,
    onQuery: (raw) => {
      if (!mounted) return;
      const q = raw.trim().toLowerCase();
      if (q === query) return;
      query = q;
      renderBody();
    },
  });
  // Drag-out (plans/132 WP-F): a tile drag carries the asset id in the app's
  // own `text/lolly-asset` type (tool slots + free-canvas accept it) and as
  // plain text. Delegated on the persistent viewEl; bound once per mount.
  const onTileDragStart = (e: DragEvent): void => {
    const tile = (e.target as HTMLElement).closest?.('.cat-tile[data-id]') as HTMLElement | null;
    if (!tile || !e.dataTransfer) return;
    const id = tile.dataset.id!;
    e.dataTransfer.setData('text/lolly-asset', id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'copy';
  };
  viewEl.addEventListener('dragstart', onTileDragStart);

  (viewEl as ViewElement)._cleanup = () => {
    mounted = false;
    viewEl.removeEventListener('dragstart', onTileDragStart);
    // Deferred deletions must not outlive the view that owns their Undo.
    flushUndoToasts();
    cancelArrivalAah();
    releaseSearch();
    // Not optional: the marquee's mousedown is bound to viewEl (#view), which the router
    // REUSES for every route - leave it bound and the next mount stacks another copy.
    tileSelect.destroy();
    tileMenu.destroy();
    unwireEscape();
    featuredHandle?.destroy();
    featuredHandle = null;
    lottieThumbs?.destroy();
    lottieThumbs = null;
    // Leaving the view must also abandon any waveform decode still running, or a finished
    // analysis paints into a grid that is no longer on screen.
    audioThumbs?.destroy();
    audioThumbs = null;
    textThumbs?.destroy();
    textThumbs = null;
    motionThumbs?.destroy();
    motionThumbs = null;
    closeViewOpts();
    closeDetails();
    closeDownloadDialog();
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
  await reload();
  if (!mounted) return;
  // Deep link: expand the linked sections (validated) BEFORE the first paint so they render
  // open over the collapsed-by-default state; persist so the choice sticks for this user.
  const openTargets = linkedSections.filter(k => ALL_SECTION_KEYS.includes(k));
  if (openTargets.length) { for (const k of openTargets) collapsed.delete(k); persistCollapsed(); }
  render();
  // …then scroll the first linked section into view. The favourites hero + first images grow
  // the layout above the target during the opening moments and reset an early scroll, so we
  // re-measure and re-scroll across that window; the later passes land once it settles.
  if (openTargets.length) {
    const firstKey = openTargets.find(k => viewEl.querySelector(`.cat-group[data-group="${k}"]`));
    const scrollToSection = (smooth: boolean): void => {
      const el = firstKey ? viewEl.querySelector<HTMLElement>(`.cat-group[data-group="${firstKey}"]`) : null;
      if (!el || !mounted) return;
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
    const ref = assetById.get(baseId)
      ?? assetById.get(linkedAsset)
      ?? [...assetById.values()].find(a => assetBaseId(a.id) === baseId);
    if (ref) openDetails(ref, theme, treatment);
    else {
      // The deep-linked asset isn't in this user's catalogue (never synced, a deleted upload,
      // or an unknown id) - say so instead of a silent no-op: announce() for assistive tech,
      // plus a brief self-clearing line at the top of the grid so a sighted user sees it too.
      announce(t('That asset isn’t in your catalogue'));
      const bodyEl = viewEl.querySelector<HTMLElement>('.catalog-body');
      if (bodyEl) {
        const note = document.createElement('p');
        note.className = 'cat-empty';
        note.style.cssText = 'padding:0.85rem 1rem';
        note.textContent = t('That asset isn’t in your catalogue.');
        bodyEl.insertBefore(note, bodyEl.firstChild);
        setTimeout(() => note.remove(), 6000);
      }
    }
  }
}
