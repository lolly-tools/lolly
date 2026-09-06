// SPDX-License-Identifier: MPL-2.0
/**
 * Asset Picker - a host-owned modal UI.
 *
 * Why this is a host concern, not a tool concern: tools have no business
 * rendering picker chrome. They declare what they want; the host owns the
 * UX. This means picker UX improves across every tool simultaneously.
 *
 * Mounted lazily on first use. The picker calls back into:
 *   - host.assets.query(filter)  → list candidate library assets
 *   - host.assets.get(id)        → resolve the chosen one to an AssetRef
 *   - host.state.list()/load()   → the user's saved tool sessions (Saved creations)
 *   - host.compose.renderUrl()   → render a Lolly tool/session as the image
 *   - user-asset upload          → stores blob in IDB, returns user/* AssetRef
 *
 * Three ways in beyond the library, all producing an ordinary image AssetRef:
 *   - "Saved creations" - a previous saved single-tool session, re-rendered to an image
 *   - "Tools" - any local tool, configured first (opts.editTool) then inserted
 *   - paste a Lolly link in the search box (the original smart-paste flow)
 *
 * Exported function: openPicker(host, opts) → Promise<AssetRef | null>
 *   opts.editTool?(toolUrl, mode?) → Promise<AssetRef|null> - when present, choosing a
 *   tool opens the full input editor (the caller wires it to tool.js's openEmbedEditor)
 *   so the user can configure the tool before it's inserted. Absent (e.g. batch mode) →
 *   the picker falls back to its inline format/size render card.
 *   opts.currentToolUrl / opts.currentToolName - when the slot being changed already
 *   holds a Lolly render (the AssetRef's meta.toolUrl), the picker shows an "edit the
 *   tool you're already using" banner that re-opens its inputs pre-filled (mode 'edit');
 *   the grids below still offer choosing a different image instead.
 */

import '../styles/picker.css';   // async CSS chunk (lazy view - not on the landing)
import { isHiddenSlot } from '../lib/batch-slots.ts';
import { archiveBudgetFor, archiveMemberFile, readArchiveMembers, readUploadZip, readUploadArchiveBytes } from '../lib/archive-ingest.ts';
import DOMPurify from 'dompurify';
import { serializeUrlState, buildEmbedUrl, parseThemedAssetId, buildThemedAssetId, restyleIconTheme, sniffAnimatedRaster, sniffVideoContainer, parseTreatedAssetId, buildTreatedAssetId, treatmentFilterSvg, stripAssetModifiers, extractC2paStore, prepareC2paIngredientFromStore, stripMetadata, midiToZzfxm, bakeAssetRef, decodeBmp, isBmp, decodeIco, isIco, gunzip, packPng, analyzeTextSignals, LEXICON_VERSION, extractFileMetadata } from '@lolly/engine';
import { createToolRuntime as createRuntime } from '../lib/mount-runtime.ts';
// Format + embeddability rules - pure and unit-tested in ./picker-formats.test.ts.
import {
  extFromMime, audioFormatOf, formatsForType, isEmbeddable, imageFormatSeed,
  relTime as relTimeAt, VIDEO_FMTS, RASTER_MOTION_FMTS, IMG_FORMATS,
} from './picker-formats.ts';
import { fmtBytes } from '../lib/format.ts';
import { fold, tokenize, scoreHaystack, SEARCH_DEBOUNCE_MS } from '../lib/search/match.ts';
import { getTool } from '../bridge/tool-loader.ts';
import { trapFocus, type FocusTrap } from '../lib/focus-trap.ts';
import { wireTabs } from '../lib/tabs.ts';
import { downscaleRaster, computeResize, MAX_LONGEST_EDGE, readVideoDimensions } from '../bridge/image-resize.ts';
import { depthHint } from '../lib/image-sample.ts';
import { createFolderStore, childFolders, folderPath } from '../folders.ts';
import { announce } from '../a11y.ts';
import { choiceDialog, confirmDialog } from '../components/confirm-dialog.ts';
import { maybeNudgeAssetMilestone } from '../lib/asset-milestone.ts';
import { invalidateNeurospicyTracks } from '../lib/neurospicy.ts';
import { onIdle } from '../lib/clip-thumbs.ts';
import { audioThumbShape, audioThumbSvg, audioThumbPlaceholder } from '../lib/audio-thumb.ts';
import { audioThumbPool, type ThumbTheme } from '../lib/audio-thumb-colour.ts';
import { mountTextThumbs } from '../lib/text-thumbs.ts';
import { loadAudioCovers, resolveAudioLook, type AudioCover } from '../lib/audio-covers.ts';
import { livePalette } from '../lib/live-palette.ts';
import { cachedPeaks, derivePeaks, memoPeaks, deletePeaks, MAX_CONCURRENT_DERIVES, peaksFingerprint } from '../lib/audio-peaks.ts';
import { libCategory, LIB_GROUPS, loadAssetCategories, categoryLabel } from '../lib/asset-category.ts';
import type { LibGroup } from '../lib/asset-category.ts';
import { categoryGlyph } from '../lib/category-icons.ts';
import { icon } from '../lib/icons.ts';
import { isChromium } from '../capabilities.ts';
import { loadFavouriteAssets, loadHiddenAssets, assetBaseId } from '../lib/asset-favourites.ts';
import { matchesType as pickerMatchesType, type TypeFilter as PickerTypeFilter } from './catalog-filter.ts';

/** The type pills an untyped pick offers (plans/134 P5) - the catalog's buckets. */
const PICKER_TYPE_FILTERS: ReadonlyArray<{ key: PickerTypeFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'image', label: 'Image' },
  { key: 'vector', label: 'Vector' },
  { key: 'motion', label: 'Motion' },
  { key: 'audio', label: 'Audio' },
  { key: 'text', label: 'Text' },
];
import { VISUAL_TYPES, isPlaceableAsset } from '../lib/asset-kinds.ts';
import { typeMatches } from '../bridge/assets.ts';
import { autoplayLottieThumbs } from './lottie-mount.ts';
import { previewMedia, motionVideoThumb, armMotionPreviews } from '../lib/preview-media.ts';
import { escapeHtml } from '../lib/html.ts';
import { NAV_EVENTS } from '../utils.ts';
import { t, tRaw, docsAppHref } from '../i18n.ts';
import { genAiPill, assetAiKind, aiSignalsChip } from '../lib/genai-pill.ts';
import { isFlagOn, STRIP_UPLOAD_META_FLAG } from '../feature-flags.ts';
import type { AssetRef, AssetPickerOpts, ComposeUrlOpts, ExportFormat, HostV1, Profile } from '@lolly-tools/core/host-v1';
import type { InputValue } from '../../../../engine/src/inputs.ts';
import type { IconTheme } from '../../../../engine/src/icon-theme.ts';
import type { PhotoTreatment } from '../../../../engine/src/photo-treatment.ts';
import type { Folder, FolderItem, FolderHost } from '../folders.ts';
import type { WebStateAPI } from '../bridge/state.ts';
import type { VideoJobHost } from '../lib/video-jobs.ts';

/** Every file kind the upload surfaces can ingest - the `accept` list for any
 *  affordance that feeds storeUserUpload (the picker's footer input, the catalog's
 *  drop area). Images (raster + SVG), short video, Lottie, and audio all flow
 *  through storeUserUpload; audio (the user's own music) is stored verbatim as a
 *  type:'audio' asset. PDF/.ai and PowerPoint .pptx don't go through storeUserUpload
 *  itself: callers route them to pdf-import.ts's ingestPdfAsSvgAssets /
 *  pptx-import.ts's ingestPptxAsSvgAssets (page(s)/slide(s) → stored SVG) via
 *  isPdfUpload / isPptxUpload. */
export const UPLOAD_ACCEPT = 'image/svg+xml,image/png,image/apng,image/jpeg,image/webp,image/gif,image/avif,image/heic,image/heif,image/bmp,.bmp,image/x-icon,image/vnd.microsoft.icon,.ico,.cur,.svgz,video/mp4,video/webm,video/x-matroska,.mp4,.webm,.mov,.mkv,audio/*,.mp3,.wav,.ogg,.oga,.opus,.m4a,.aac,.flac,.mid,.midi,.mod,.xm,.it,.s3m,.stm,.mtm,application/json,.json,.lottie,application/pdf,.pdf,application/illustrator,.ai,application/vnd.openxmlformats-officedocument.presentationml.presentation,.pptx,.xlsx,.csv,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/*,.txt,.md,.markdown,.text,.js,.jsx,.mjs,.cjs,.ts,.tsx,.py,.rb,.go,.rs,.java,.c,.h,.hpp,.cc,.cpp,.cs,.swift,.kt,.kts,.php,.pl,.lua,.sql,.scala,.sh,.bash,.zsh,.fish,.yaml,.yml,.toml,.ini,.cfg,.conf,.css,.scss,.less,.html,.htm,.xml,.vue,.svelte,.astro';

/** A PDF - or an Illustrator .ai, which saved PDF-compatible IS a PDF - that upload
 *  surfaces must hand to the page→SVG converter instead of storeUserUpload. Sync and
 *  chunk-free on purpose: callers decide the route before lazy-loading pdf-import. */
export const isPdfUpload = (file: File): boolean =>
  /\.(pdf|ai)$/i.test(file.name) || /^application\/(pdf|illustrator)$/i.test(file.type);

/** A PowerPoint .pptx that upload surfaces must hand to the slide→SVG converter
 *  instead of storeUserUpload. Sync and chunk-free on purpose: callers decide the
 *  route before lazy-loading pptx-import. */
export const isPptxUpload = (file: File): boolean =>
  /\.pptx$/i.test(file.name) || file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

/** The window.__toolIndex tool slice the picker reads (a denormalised catalog/sync
 *  projection, not an engine domain type). */
export interface PickerTool {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  preview?: string;
  /** The tool's motion preview, when its content genuinely animates (catalog index `anim`).
   *  `preview` stays the still poster - see lib/preview-media.ts. */
  anim?: string;
  formats?: readonly string[];
  exportable?: boolean;
  // Canvas dimensions (from the catalog index) - used to fit an animated card.html banner
  // to the fixed-height preview slot at the right aspect. See toolCard / previewMedia.
  width?: number;
  height?: number;
}

/** A saved single-tool session, projected for the "Saved creations" tab. */
interface PickerSession {
  slot: string;
  toolId: string;
  label?: string;
  toolName: string;
  toolIcon: string | null;
  thumb: string | null;
  updatedAt: string;
}

type TabId = 'library' | 'uploads' | 'sessions' | 'projects' | 'tools';
interface Tab {
  id: TabId;
  label: string;
}

/** The picker-facing structure of bridge/compose.ts's `_describeUrl` result (the
 *  detected-tool card). Local: `_describeUrl` is web-only host-UI chrome with no
 *  exported type. */
interface ToolUrlDescription {
  toolId: string;
  name: string;
  formats: string[];
  format: string;
  /** Subset of `formats` that carries movement (webm/mp4/gif/apng the tool
   *  supports and this browser can produce) - a motion pick renders a live clip. */
  motion: string[];
  width: number | null;
  height: number | null;
  unit: string | null;
  dpi: number | null;
}

/** The user-asset record storeUserUpload writes via host.assets._uploadUserAsset
 *  (mirrors bridge/assets.ts's non-exported UserAssetRecord for the fields we set). */
interface UserAssetRecordInput {
  id: string;
  type: AssetRef['type'];
  format: string;
  blob?: Blob;
  version?: string;
  width?: number;
  height?: number;
  meta?: Record<string, unknown>;
  credential?: Uint8Array;
  credentialFormat?: string;
}

/** Outcome of a collect-mode add, driving the transient per-tile feedback. A bare
 *  boolean is shorthand for `{ ok }`. `silent` suppresses the ✓/✗ flash entirely -
 *  used when the user dismissed a sub-chooser, so nothing was added and there is
 *  nothing to report. */
export interface CollectResult { ok: boolean; label?: string; silent?: boolean }

/**
 * "Collect into a folder" mode. When present, the picker stops being a fill-one-slot
 * chooser and becomes an ADD surface: a pick files the chosen thing into the caller's
 * folder and the dialog STAYS OPEN (multi-add) with a transient "✓ Added" on the tile,
 * closing only on × / Escape / backdrop. Each callback returns whether the add stuck.
 * The four callbacks map to the four things a folder can gain:
 *   - onAsset       library / your-images / upload / webcam / a rendered Lolly link → an image item
 *   - onSession     a saved single-tool session → filed in as an (editable) session item
 *   - onOpenTool    open a tool's editor (navigates away; the picker tears down)
 *   - onQuickAddTool  a default-settings session for a tool, no editor step
 */
export interface CollectOpts {
  folderName: string;
  /** Tools to list in the Tools tab. Projects passes every non-utility creative tool - 
   *  a superset of the image-embeddable set the slot picker uses. */
  tools?: PickerTool[];
  onAsset(ref: AssetRef): Promise<CollectResult | boolean>;
  onSession(slot: string): Promise<CollectResult | boolean>;
  onOpenTool(toolId: string): void;
  onQuickAddTool(toolId: string): Promise<CollectResult | boolean>;
}

/** The picker's option bag: AssetPickerOpts (title/allowUpload/current/type/…)
 *  widened with the web-only `type: 'image'` slot value and the editTool /
 *  current-tool banner hooks the caller (views/tool.js's openEmbedEditor) wires in. */
interface PickerOpts {
  type?:
    | 'vector'
    | 'raster'
    | 'video'
    | 'audio'
    | 'lottie'
    | 'model'
    | 'lut'
    | 'palette'
    | 'tokens'
    | 'font'
    | 'profile'
    | 'ratecard'
    | 'text'
    | 'data'
    | 'image';
  namespace?: string;
  tags?: string[];
  includeDeprecated?: boolean;
  title?: string;
  allowUpload?: boolean;
  /**
   * The calling slot's TOOL can consume moving pictures (it declares an onFrame
   * hook, so the live frame loop plays a video pick through the render). Widens an
   * `image` pick to also offer the user's video uploads - capability-driven, never
   * a per-tool special case. Ignored for every other `type`.
   */
  motion?: boolean;
  current?: string;
  editTool?: (toolUrl: string, mode?: string) => Promise<AssetRef | null>;
  currentToolUrl?: string;
  currentToolName?: string;
  /**
   * Which source pane the picker opens on. A DEFAULT, not a lock: the tab strip stays
   * fully usable, so the user can move off it immediately. A tab this pick doesn't
   * offer (`tools` with no embeddable tools, `projects` on a slot that shows none)
   * degrades to Library rather than opening a pane that isn't there. Absent keeps the
   * historical default - collect mode opens on Tools, everything else on Library.
   * Callers use it to match the pane to the ADD KIND the user chose: "add a tool"
   * lands on Tools, "add audio" lands on the (already type-filtered) library.
   */
  initialTab?: TabId;
  /** Present → "collect into a folder" mode (see {@link CollectOpts}). */
  collect?: CollectOpts;
}

/** The web compose surface the picker uses: the v1 ComposeAPI plus the web-only
 *  `_describeUrl` host-UI helper, with `renderUrl` pinned present (the web shell
 *  always provides it - see bridge/compose.ts). */
type WebComposeAPI = NonNullable<HostV1['compose']> & {
  renderUrl(url: string, opts?: ComposeUrlOpts): Promise<AssetRef | null>;
  _describeUrl(url: string): Promise<ToolUrlDescription | null>;
};

/** The web host surface the picker touches: HostV1 plus the web-only asset/state/
 *  compose helpers (underscore-prefixed, not part of the tool-facing v1 contract).
 *  Exported for surfaces that reuse the picker's ingest path (lib/upload-dropzone.ts). */
export interface PickerHost extends HostV1 {
  state: WebStateAPI;
  compose: WebComposeAPI;
  assets: HostV1['assets'] & {
    _deleteUserAsset(id: string): Promise<void>;
    _listUserAssets(): Promise<AssetRef[]>;
    _userAssetsCount(): Promise<number>;
    _iconThemes(): Promise<IconTheme[]>;
    _photoTreatments(): Promise<PhotoTreatment[]>;
    _uploadUserAsset(record: UserAssetRecordInput): Promise<void>;
  };
}

type WindowWithToolIndex = typeof window & { __toolIndex?: { tools?: PickerTool[] } };

let modalEl: HTMLDivElement | null = null;

// Per-open gate for the per-card raster "Upscale" button. Set in render() below - 
// the card renderers (card / userCard / projectImageCard) that read it are
// module-level and can't see render()'s closure, and the picker is a singleton
// (one modalEl), so a shared flag is safe.
let upscaleEnabled = false;
// True when the on-device background remover (host.matte) is present AND at least
// one model is STAGED - models() is empty until a model's licence + weights are
// verified, so the affordance stays hidden rather than opening a dead dialog.
let matteEnabled = false;
// True when a VIDEO asset could have its background removed on-device (plan 124 WP-G):
// the browser can decode video (WebCodecs' VideoDecoder, mediabunny's floor) AND a matte
// model is staged - the same gate the catalog detail modal uses. Read by the per-video
// card affordance (vidMatteButton), which - like the two flags above - is a module-level
// renderer that can't see render()'s closure, so the flag is module-level too.
let videoMatteEnabled = false;

/**
 * Clicking an image slot that already holds a live Lolly render doesn't jump
 * straight into the picker: ask which of the two intents the click meant.
 * Shared by every Lolly-image surface (top-level slot, block fields, free-canvas
 * boxes) so the wording stays identical. Resolves 'edit' | 'pick' | null.
 */
export function askLollyIntent(toolName?: string): Promise<string | null> {
  return choiceDialog({
    title: t('This image is a Lolly'),
    message: tRaw("It's a live render from {toolName}. Tweak its inputs, or put a different image in this slot?", { toolName: toolName ?? t('a Lolly tool') }),
    choices: [
      { id: 'edit', label: `✦ ${t('Edit this Lolly')}`, primary: true },
      { id: 'pick', label: t('Select another asset') },
    ],
  });
}

// Lucide-style camera glyph for the "Take a photo" affordance (themes via currentColor).
const cameraGlyph = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>';

// Lucide-style folder glyph for the Projects tab's folder cards.
const folderGlyph = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>';

export function openPicker(host: PickerHost, opts: PickerOpts = {}): Promise<AssetRef | null> {
  return new Promise(resolve => {
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.className = 'asset-picker-modal';
      document.body.appendChild(modalEl);
    }
    render(modalEl, host, opts, resolve);
  });
}

async function render(
  root: HTMLElement,
  host: PickerHost,
  opts: PickerOpts,
  resolve: (value: AssetRef | null) => void,
): Promise<void> {
  // "Collect into a folder" mode (see CollectOpts): a pick ADDS to the caller's folder
  // and the dialog stays open, instead of resolving one asset into a tool slot.
  const collect = opts.collect;
  // The personal-image library is offered only when this input accepts uploads.
  const showUserAssets = opts.allowUpload === true;
  let userAssets: AssetRef[] = [];

  // Per-user asset overlays (profile-backed, shared with the Catalog view): starred
  // assets pin to a "Favourites" section at the top; hidden assets drop from the library
  // AND user list; category overrides re-bucket assets. Loaded non-blocking (after the
  // synchronous first paint below), then the renders that depend on them await it.
  let favSet = new Set<string>();
  let hiddenSet = new Set<string>();
  let assetCategoryOverrides: Record<string, string> = {};
  const profileReady = host.profile.get().then((p: Profile) => {
    favSet = loadFavouriteAssets(p);
    hiddenSet = loadHiddenAssets(p);
    assetCategoryOverrides = loadAssetCategories(p);
  }).catch(() => { /* no profile → empty overlays */ });
  // Folders the user has organized their images into (in the gallery overlay).
  // Browse-only here - the picker reflects the grouping; it doesn't edit it.
  // host.profile (HostV1's ProfileAPI) is a superset of FolderHost's narrower
  // profile shape at runtime; the cast is type-only (FolderHost's structural
  // subset isn't inferable from HostV1's declared ProfileAPI).
  const folderStore = createFolderStore(host as unknown as FolderHost);
  let folders: Folder[] = [];
  let foldersLoaded = false;
  // The folder the Projects tab is currently browsing (null = the top level).
  let projectFolder: string | null = null;

  // "Take a photo" is offered on the same terms as upload (the slot accepts the
  // user's own images) for raster-capable slots, when the browser exposes a camera.
  // It produces an ordinary raster AssetRef - no engine/bridge involvement, purely a
  // shell affordance like upload. Pixels are captured + stored on-device.
  const canWebcam = showUserAssets && opts.type !== 'vector'
    && typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

  // Would a raster screenshot serve this slot at all? Shared gate for both capture
  // sources below - same terms as webcam: upload-capable, not a vector slot.
  const captureCouldServe = showUserAssets && opts.type !== 'vector';

  // "Capture screen" beside it, feature-detected on getDisplayMedia (absent on most
  // mobile browsers). A picker-level source like webcam - NOT gated on any tool
  // capability flag: the browser's own share picker is the whole selection UI, and
  // recorder.still() releases the stream the moment the frame is grabbed.
  const canScreencap = captureCouldServe
    && typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getDisplayMedia)
    && typeof host.recorder?.still === 'function';

  // "Script audio" beside them: type a script, synthesize speech on-device via the
  // optional host.speech bridge (v1.96), and store the clip as a user audio asset.
  // Offered when the slot can take the user's own audio - an audio slot, or an
  // untyped upload slot. Feature-detected on the bridge, not capability-gated.
  const canScriptAudio = showUserAssets && (opts.type === 'audio' || opts.type === undefined)
    && host.speech?.isAvailable() === true;

  // "Upscale" beside it: enlarge a raster image on-device via the optional
  // host.upscale bridge (v1.101), saving the result as a user raster asset.
  // Offered for a slot that accepts rasters - 'raster', the raster-or-vector
  // 'image' superset, or an untyped upload slot (never vector/audio/video).
  // Feature-detected on the bridge, not capability-gated.
  const canUpscale = showUserAssets && (opts.type === 'raster' || opts.type === 'image' || opts.type === undefined)
    && host.upscale?.isAvailable() === true;
  // Background removal - same slot gate as upscale; hidden until a model is staged.
  const canMatte = showUserAssets && (opts.type === 'raster' || opts.type === 'image' || opts.type === undefined)
    && host.matte?.isAvailable() === true && (host.matte.models().length > 0);

  // The per-card "Upscale" affordance (a hover-revealed button on RASTER cards - 
  // library assets AND the user's own uploads) is a distinct entry point from the
  // footer shortcut above: it upscales an image the user ALREADY has as the source,
  // without re-uploading it. Gated purely on the on-device upscaler being present;
  // the per-ref raster check lives in the module-level card renderers (upscaleButton).
  upscaleEnabled = host.upscale?.isAvailable() === true;
  matteEnabled = host.matte?.isAvailable() === true && (host.matte.models().length > 0);
  // Streaming on-device VIDEO background removal (WP-G): needs only that the browser can
  // decode video (WebCodecs). The shared dialog offers two methods - the on-device model
  // (if one is staged) and the deterministic COLOUR KEY (no model at all) - so the
  // affordance appears wherever a video can be decoded, not only where a model is staged.
  // A video-only affordance, so it needs no slot-type gate (a video card only ever appears
  // in a slot that offers video picks) - like matteButton relies on the ref being raster.
  videoMatteEnabled = typeof (window as { VideoDecoder?: unknown }).VideoDecoder !== 'undefined';

  // A pasted https URL that is NOT a Lolly link can still become an image where the
  // shell can capture pages (extension installed / Tauri) - see showUrlFallback.
  const canCaptureUrl = captureCouldServe && (host.capabilities ?? []).includes('capture');

  // Smart-paste / compose: any image slot can render a Lolly tool (or a previous
  // saved creation) AS the image - available whenever the shell can compose and the
  // slot isn't video-only. The toolId in any link/tool must resolve to a real local
  // tool, so this can only ever render a tool that ships in this build.
  const allowToolUrl = Boolean((host.compose as Partial<WebComposeAPI> | undefined)?.renderUrl
    && (host.compose as Partial<WebComposeAPI> | undefined)?._describeUrl)
    && opts.type !== 'video';

  // The Projects tab browses the user's folders of saved creations + images. It's
  // worth showing whenever a folder could hold something pickable here: saved
  // creations (needs compose) or the user's own images (needs an upload-capable slot).
  const showProjects = allowToolUrl || showUserAssets;
  // Load the folder tree once whenever it could be shown (the Projects tab or the
  // "Your images" folder grouping), so a slot that only offers saved creations (no
  // upload) still gets its projects.
  const foldersReady: Promise<void> = showProjects
    ? folderStore.list().then(fs => { folders = fs; foldersLoaded = true; })
        .catch(() => { foldersLoaded = true; })
    : Promise.resolve();

  // A vector slot wants vector renders, so only tools that can emit SVG qualify.
  const needsSvg = opts.type === 'vector';

  // The runtime tool list is populated at boot by catalog/sync (window.__toolIndex);
  // every field we need (id, name, icon, formats, exportable) is already on it, so no
  // fetch. Restrict to tools that can produce an image (mirrors compose IMAGE_FORMATS)
  // and, for a vector slot, SVG specifically.
  const toolIndex = ((typeof window !== 'undefined' && (window as WindowWithToolIndex).__toolIndex?.tools) || []) as PickerTool[];
  const toolById  = new Map(toolIndex.map((t): [string, PickerTool] => [t.id, t]));
  // In collect mode the Tools tab starts a SESSION (open editor or quick-add), not an
  // image render - so it lists whatever creative tools the caller passed (Projects sends
  // every non-utility tool), not just the image-embeddable subset the slot picker needs.
  const embedTools = collect?.tools
    ? [...collect.tools].sort((a, b) => a.name.localeCompare(b.name))
    : allowToolUrl
      ? toolIndex.filter(t => isEmbeddable(t, needsSvg)).sort((a, b) => a.name.localeCompare(b.name))
      : [];

  // ── Acceptance (plans/162, fade-not-hide) ──────────────────────────────────
  // Whether a slot with THIS opts.type would accept an asset of a given type -
  // the SAME predicate the catalog query uses (typeMatches, incl. image→+video for
  // a motion slot). Andy's rule: instead of HIDING what a slot can't take, a
  // still-image family slot shows the whole visual catalog with the non-acceptable
  // tiles FADED + aria-disabled (and rejected on click), so the grid never looks
  // mysteriously empty. Only "family" (visual) slots broaden; audio/text/data and
  // untyped `any` keep their existing set (nothing comparable to fade).
  const VISUAL_SLOT_TYPES = new Set(['vector', 'raster', 'image', 'video', 'lottie']);
  const visualSlot = opts.type != null && VISUAL_SLOT_TYPES.has(opts.type);
  const isAcceptable = (assetType: string): boolean => typeMatches(assetType, opts.type, opts.motion === true);

  // The slot's current image may itself be a Lolly render (meta.toolUrl on the
  // AssetRef). Offer an edit path back into that tool's own inputs - pre-filled
  // with the values already in use - without giving up the normal pick-another-
  // image grids below. Needs editTool (the caller's embed editor) to mean anything.
  const currentToolUrl = (opts.editTool && typeof opts.currentToolUrl === 'string' && opts.currentToolUrl) || null;

  // Saved single-tool sessions (filled async below); null while loading.
  let sessions: PickerSession[] | null = null;

  // ── Icon colour themes ──────────────────────────────────────────────────────
  // Themable two-colour icons (assets tagged "themable") can take a colour
  // pairing chosen here. The pairings come from the catalog's icon-themes
  // palette asset via host.assets._iconThemes(); the strip mounts only when the
  // library actually contains themable icons. The first pairing is the default
  // (identical to the fills baked into every icon) - choosing it keeps the plain
  // asset id, so default picks stay class-overridable when inlined.
  // A non-default choice is carried in the picked id (`<id>?theme=<themeId>`).
  let iconThemes: IconTheme[] = [];
  const currentBaseId = stripAssetModifiers(String(opts.current ?? ''));
  const { theme: currentTheme } = parseThemedAssetId(String(opts.current ?? ''));
  let activeTheme: string | null | undefined = currentTheme;
  // Two-colour icons (tag 'themable', c1/c2 swap) AND multi-colour illustrations
  // (tag 'illustration', monochromatic remap) both take a colour theme here - the
  // engine's restyle/apply pick the right recolour per SVG shape.
  const isThemableRef = (ref: AssetRef | undefined): ref is AssetRef => {
    const tags = ref?.meta?.tags as string[] | undefined;
    return Boolean(tags?.includes('themable') || tags?.includes('illustration'));
  };

  // ── Photo colour treatments ─────────────────────────────────────────────────
  // The raster analogue of the icon colour strip: a raster photo can take a
  // greyscale or duotone-wash treatment chosen here. The treatments come from the
  // catalog's photo-treatments palette via host.assets._photoTreatments(); the
  // strip mounts only on groups that hold raster photos. "None" is the plain
  // photo (no suffix); a treatment choice rides in the picked id
  // (`<id>?treatment=<treatmentId>`).
  let photoTreatments: PhotoTreatment[] = [];
  const { treatment: currentTreatment } = parseTreatedAssetId(String(opts.current ?? ''));
  let activeTreatment: string | null | undefined = currentTreatment;
  const isTreatableRef = (ref: AssetRef | undefined): ref is AssetRef => ref?.type === 'raster';

  // Which sources get a tab. The Catalog is always present; the rest are conditional.
  // ("library" stays the internal id/data-pane - the visible label is "Catalogue".)
  const tabs: Tab[] = [{ id: 'library', label: 'Catalogue' }];
  // The user's own uploads live on their own tab - private to them until shared.
  if (showUserAssets) tabs.push({ id: 'uploads', label: 'Private assets' });
  if (allowToolUrl) tabs.push({ id: 'sessions', label: 'Saved creations' });
  if (showProjects) tabs.push({ id: 'projects', label: 'Projects' });
  if (embedTools.length) tabs.push({ id: 'tools', label: 'Tools' });
  // Which pane opens first. The caller's `initialTab` wins when this pick actually
  // offers that tab (so "add a tool" opens on Tools and "add audio" opens on the
  // type-filtered library); it's only a default - the strip below stays live, so the
  // user can switch away at once. A requested tab that isn't in `tabs` is ignored
  // rather than honoured into an empty pane.
  // Absent, the historical rule stands: collect mode (the Projects "+ New asset" flow)
  // opens straight on Tools, because the primary intent there is starting a fresh
  // creation rather than picking an existing image; the slot-fill picker keeps Library.
  const requestedTab = opts.initialTab && tabs.some(tb => tb.id === opts.initialTab) ? opts.initialTab : null;
  // Last-used tab for this pick type (plans/134 P1) - a remembered DEFAULT that an
  // explicit initialTab (and collect mode's Tools opening) still outranks.
  const rememberedTab = ((): TabId | null => {
    const m = readTabMemory(opts.type ?? 'any') as TabId | null;
    return m && tabs.some(tb => tb.id === m) ? m : null;
  })();
  let activeTab: TabId = requestedTab ?? (collect && embedTools.length ? 'tools' : rememberedTab ?? 'library');
  // Declared before the boot code that applies the initial tab (applyTab is
  // hoisted and runs during setup, so this must already be initialised).
  let tabMemoryArmed = false;

  const placeholderFor = (id: TabId): string =>
    id === 'tools'    ? t('Search tools…')
    : id === 'sessions' ? t('Search your saved creations…')
    : id === 'projects' ? t('Search your projects…')
    : id === 'uploads'  ? t('Search your private assets…')
    : allowToolUrl    ? t('Search, or paste a Lolly link…')
    : t('Search…');

  // A real ARIA tab widget only when there's an actual tab strip (>1 source): each
  // source pane becomes its tab's panel, wired back to the tab that labels it. With a
  // single source there's no tablist, so the lone pane stays a plain section.
  const hasTabs = tabs.length > 1;
  const paneAria = (id: TabId): string =>
    hasTabs ? ` role="tabpanel" id="asset-picker-pane-${id}" aria-labelledby="asset-picker-tab-${id}"` : '';

  root.innerHTML = `
    <div class="asset-picker-backdrop" aria-hidden="true"></div>
    <div class="asset-picker-panel" role="dialog" aria-modal="true" aria-labelledby="asset-picker-title">
      <header class="asset-picker-header">
        <h2 id="asset-picker-title">${escapeHtml(opts.title ?? (collect ? tRaw('Add to {name}', { name: collect.folderName }) : t('Choose an asset')))}</h2>
        <input type="search" class="asset-picker-search" placeholder="${escapeHtml(placeholderFor('library'))}" autocomplete="off" spellcheck="false" aria-label="${escapeHtml(t('Search assets'))}">
        <button type="button" class="asset-picker-close" aria-label="${escapeHtml(t('Close'))}">×</button>
      </header>
      ${tabs.length > 1 ? `<div class="asset-picker-tabs" role="tablist" aria-label="${escapeHtml(t('Asset sources'))}">${tabs.map(tabBtn).join('')}</div>` : ''}
      ${currentToolUrl ? `<div class="asset-picker-current">
        <span class="asset-picker-current-label"><span class="asset-picker-current-spark" aria-hidden="true">✦</span> ${t('Current image is from <strong>{name}</strong> - tweak it, or pick a different image below', { name: opts.currentToolName ?? t('a Lolly tool') })}</span>
        <button type="button" class="asset-picker-current-edit">${t('Edit inputs…')}</button>
      </div>` : ''}
      <div class="asset-picker-body">
        <section class="asset-picker-pane"${paneAria('library')} data-pane="library">
          ${visualSlot ? `<div class="asset-picker-fitbar"><button type="button" class="asset-picker-fit-toggle" data-fit-toggle aria-pressed="false">${escapeHtml(t('Hide items this slot can’t use'))}</button></div>` : ''}
          <div class="asset-picker-typebar" role="group" aria-label="${escapeHtml(t('Filter by type'))}" hidden></div>
          <div class="asset-picker-catbar" role="group" aria-label="${escapeHtml(t('Filter by category'))}" hidden></div>
          <section class="asset-picker-recents" hidden></section>
          <section class="asset-picker-favourites" hidden></section>
          <section class="asset-picker-library">
            <div class="asset-picker-loading">${t('Loading…')}</div>
          </section>
        </section>
        ${showUserAssets ? `<section class="asset-picker-pane"${paneAria('uploads')} data-pane="uploads" hidden><section class="asset-picker-userassets"></section></section>` : ''}
        ${allowToolUrl ? `<section class="asset-picker-pane"${paneAria('sessions')} data-pane="sessions" hidden></section>` : ''}
        ${showProjects ? `<section class="asset-picker-pane"${paneAria('projects')} data-pane="projects" hidden></section>` : ''}
        ${embedTools.length ? `<section class="asset-picker-pane"${paneAria('tools')} data-pane="tools" hidden></section>` : ''}
        <div class="asset-picker-toolcard-host" hidden></div>
      </div>
      ${opts.allowUpload ? `
        <!-- Where the shared trim-to-content card mounts, between the scrolling body and
             the upload row that raised the question (plan 97 section 7.3). Empty + hidden at rest. -->
        <div class="asset-picker-trim trimo-host" hidden></div>
        <footer class="asset-picker-footer">
          <label class="asset-picker-upload">
            <input type="file" class="visually-hidden" accept="${UPLOAD_ACCEPT}" />
            <span class="asset-picker-upload-label">${t('Upload your own…')}</span>
          </label>
          ${canWebcam ? `<button type="button" class="asset-picker-webcam">${cameraGlyph} ${t('Take a photo')}</button>` : ''}
          ${canScreencap ? `<button type="button" class="asset-picker-screencap">${icon('monitor', { size: 14 })} ${t('Capture screen')}</button>` : ''}
          ${canScriptAudio ? `<button type="button" class="asset-picker-scriptaudio">${icon('mic', { size: 14 })} ${t('Script audio')}</button>` : ''}
          ${canUpscale ? `<button type="button" class="asset-picker-upscale">${icon('aiSpark', { size: 14 })} ${t('Upscale')}</button>` : ''}
          ${canMatte ? `<button type="button" class="asset-picker-matte">${icon('scissors', { size: 14 })} ${t('Remove background')}</button>` : ''}
          <span class="asset-picker-footer-error" role="alert" hidden></span>
        </footer>
      ` : ''}
    </div>
  `;

  /** Per-tab match counts while a query is active (plans/134 P3). Cheap: the
   *  same in-memory filters each pane renders from; badges clear with the query. */
  function syncTabCounts(q: string): void {
    const counts = new Map<TabId, number>();
    if (q) {
      counts.set('library', typeFiltered(libraryCandidates).filter(c => searchMatches(q, String(c.meta?.name ?? c.id), c.id)).length);
      if (showUserAssets) counts.set('uploads', userAssets.filter(a => searchMatches(q, String(a.meta?.name ?? a.id), a.id)).length);
      if (sessions) counts.set('sessions', sessions.filter(s2 => searchMatches(q, s2.toolName, s2.label, s2.toolId)).length);
      counts.set('tools', embedTools.filter(t2 => searchMatches(q, t2.name, t2.description ?? '', t2.id)).length);
    }
    for (const btn of root.querySelectorAll<HTMLElement>('.asset-picker-tab')) {
      btn.querySelector('.asset-picker-tabcount')?.remove();
      const id = btn.dataset.tab as TabId;
      const n = counts.get(id);
      if (q && n !== undefined && id !== activeTab) {
        const badge = document.createElement('span');
        badge.className = 'asset-picker-tabcount';
        badge.textContent = String(n);
        btn.appendChild(badge);
      }
    }
  }

  function tabBtn(tab: Tab): string {
    const on = tab.id === activeTab;
    // Roving tabindex: only the selected tab is in the page Tab sequence; the rest
    // are reached with Arrow keys (see the tablist keydown handler below).
    return `<button type="button" id="asset-picker-tab-${tab.id}" class="asset-picker-tab${on ? ' is-active' : ''}" role="tab" data-tab="${tab.id}" aria-selected="${on}" aria-controls="asset-picker-pane-${tab.id}" tabindex="${on ? '0' : '-1'}">${escapeHtml(t(tab.label))}</button>`;
  }

  // Return focus to whatever opened the picker (the asset-picker trigger button)
  // when the dialog closes.
  const opener = document.activeElement;
  // On-screen-gated lottie autoplayer over the whole library pane (see refreshLottieThumbs);
  // torn down when the picker closes so no player keeps ticking after the dialog is gone.
  let lottieThumbs: { destroy(): void } | null = null;
  // On-screen-gated waveform upgrader over the whole picker body (see refreshAudioThumbs);
  // torn down with the dialog so an in-flight decode can't paint into a dead grid.
  let audioThumbs: { destroy(): void } | null = null;
  let textThumbs: { destroy(): void } | null = null;
  // The playback gate for every video thumbnail and every animated tool preview in the
  // dialog (see refreshMotionThumbs); torn down with the dialog so nothing keeps decoding
  // behind a closed picker.
  let motionThumbs: { destroy(): void } | null = null;
  // Answers an open trim-to-content card on the user's behalf (keeping the original
  // margins) if the dialog goes away while it is still asking - see offerTrim below.
  let pendingTrim: (() => void) | null = null;
  let trap: FocusTrap | undefined;
  const close = (value: AssetRef | null): void => {
    stopAudition();
    NAV_EVENTS.forEach(ev => window.removeEventListener(ev, onNav));
    trap?.release();
    lottieThumbs?.destroy();
    audioThumbs?.destroy();
    textThumbs?.destroy();
    motionThumbs?.destroy();
    // Before the wipe: the card's teardown revokes its preview URLs, and the upload
    // it is blocking still has to reach storeUserUpload with an answer.
    pendingTrim?.();
    root.innerHTML = '';
    if (opener instanceof HTMLElement) opener.focus();
    resolve(value);
  };
  // A route change under the open dialog (browser Back, an in-app link elsewhere)
  // closes it: the picker is body-mounted, so it would otherwise keep covering - 
  // and, via trapFocus's inert background, keep unusable - the freshly-mounted
  // view, with the openPicker promise never settling (NAV_EVENTS contract, utils.ts).
  const onNav = (): void => close(null);
  NAV_EVENTS.forEach(ev => window.addEventListener(ev, onNav));

  root.querySelector('.asset-picker-close')?.addEventListener('click', () => close(null));
  root.querySelector('.asset-picker-backdrop')?.addEventListener('click', () => close(null));

  const body         = root.querySelector<HTMLElement>('.asset-picker-body')!;
  const currentEl    = root.querySelector<HTMLElement>('.asset-picker-current');
  const libraryPane  = root.querySelector<HTMLElement>('.asset-picker-pane[data-pane="library"]')!;
  // Fade-not-hide toggle: flip a class so pure CSS hides the dimmed (incompatible)
  // tiles when a broadened catalog gets cluttered. No re-render - the tiles stay in
  // the DOM, just display:none; aria-disabled already keeps them out of keyboard nav.
  root.querySelector('[data-fit-toggle]')?.addEventListener('click', (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    const on = libraryPane.classList.toggle('hide-incompatible');
    btn.setAttribute('aria-pressed', String(on));
    btn.classList.toggle('is-active', on);
  });
  // (Re)arm the lottie autoplayer over the library pane - its favourites, user-uploads, and
  // library grids all render inside it. Called after each of those grids (re)renders so newly
  // built [data-lottie-src] markers get observed; destroys the prior observer to avoid stacking.
  const refreshLottieThumbs = (): void => {
    lottieThumbs?.destroy();
    lottieThumbs = autoplayLottieThumbs(libraryPane, { isCurrent: () => libraryPane.isConnected });
  };
  // (Re)arm the waveform upgrader. Scoped to the whole picker BODY, not just the library
  // pane: audio tiles also appear in Favourites, "Your images" and inside a project folder,
  // and a fix that lands on one grid and not the others is the bug we're removing. Called
  // after each grid (re)renders; the previous observer is destroyed first so re-renders
  // don't stack them.
  const refreshAudioThumbs = (): void => {
    audioThumbs?.destroy();
    audioThumbs = mountAudioThumbs(
      body,
      host,
      (id) => candidateById.get(id) ?? userAssets.find(a => a.id === id),
      () => body.isConnected,
    );
  };
  // The text sibling: upgrade ¶ stubs to fitted, brand-inked excerpts
  // (lib/text-thumbs.ts) on the same grids, same lifecycle.
  const refreshTextThumbs = (): void => {
    textThumbs?.destroy();
    textThumbs = mountTextThumbs(
      body,
      host,
      (id) => candidateById.get(id) ?? userAssets.find(a => a.id === id),
      () => body.isConnected,
    );
  };
  // (Re)arm the ONE motion-playback policy (lib/preview-media.ts) over the picker BODY -
  // same scope and lifecycle as the waveform upgrader, and for the same reason: video
  // thumbnails and animated tool previews appear in the library, in Favourites, in "Your
  // images" and in a project folder, so a gate on one grid and not the others is the bug
  // being removed here.
  const refreshMotionThumbs = (): void => {
    motionThumbs?.destroy();
    motionThumbs = armMotionPreviews(body, { isCurrent: () => body.isConnected });
  };
  const libraryEl    = root.querySelector<HTMLElement>('.asset-picker-library')!;
  const favEl        = root.querySelector<HTMLElement>('.asset-picker-favourites');
  const recentsEl    = root.querySelector<HTMLElement>('.asset-picker-recents');
  let auditionEl: HTMLAudioElement | null = null;
  const stopAudition = (): void => {
    auditionEl?.pause();
    auditionEl = null;
    root.querySelectorAll<HTMLElement>('[data-audition-src]').forEach(b => { b.textContent = '▶'; b.setAttribute('aria-pressed', 'false'); });
  };
  const typebarEl    = root.querySelector<HTMLElement>('.asset-picker-typebar');
  const userEl       = root.querySelector<HTMLElement>('.asset-picker-userassets');
  const searchInput  = root.querySelector<HTMLInputElement>('.asset-picker-search')!;
  // Contain keyboard focus within the modal (inert the page behind + wrap Tab) and
  // land focus in the search field. Escape/arrow-roving are handled below already.
  trap = trapFocus(root, { initialFocus: searchInput });
  const toolcardHost = root.querySelector<HTMLElement>('.asset-picker-toolcard-host')!;
  const footerEl     = root.querySelector<HTMLElement>('.asset-picker-footer');
  const sessionsPane = root.querySelector<HTMLElement>('.asset-picker-pane[data-pane="sessions"]');
  const projectsPane = root.querySelector<HTMLElement>('.asset-picker-pane[data-pane="projects"]');
  const toolsPane    = root.querySelector<HTMLElement>('.asset-picker-pane[data-pane="tools"]');
  const catbarEl     = root.querySelector<HTMLElement>('.asset-picker-catbar');

  // ── collect-mode feedback ────────────────────────────────────────────────────
  const collectOk = (r: CollectResult | boolean): boolean => typeof r === 'boolean' ? r : r.ok;
  const collectLabel = (r: CollectResult | boolean): string =>
    (typeof r === 'object' && r.label) || (collectOk(r) ? t('Added') : t('Couldn’t add'));
  // Flash a tile as added (green ✓ overlay) or failed, then restore - the dialog stays
  // open so several items can be gathered in a row. The card owns `position:relative`
  // already (the format badge sits on it), so the overlay pins cleanly.
  function flashCard(el: HTMLElement, r: CollectResult | boolean): void {
    const ok = collectOk(r), label = collectLabel(r);
    const card = el.closest<HTMLElement>('.asset-picker-toolcell, .asset-picker-card, .asset-picker-toolitem') ?? el;
    card.classList.add(ok ? 'is-added' : 'is-addfail');
    const badge = document.createElement('span');
    badge.className = 'asset-picker-added';
    badge.textContent = (ok ? '✓ ' : '') + label;
    card.appendChild(badge);
    announce(label);
    setTimeout(() => { badge.remove(); card.classList.remove('is-added', 'is-addfail'); }, 1200);
  }
  // A transient toast (upload / webcam / pasted-link adds have no tile to flash).
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  function collectToast(r: CollectResult | boolean): void {
    const ok = collectOk(r), label = collectLabel(r);
    let toast = root.querySelector<HTMLElement>('.asset-picker-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'asset-picker-toast';
      toast.setAttribute('role', 'status');
      root.querySelector('.asset-picker-panel')?.appendChild(toast);
    }
    toast.textContent = (ok ? '✓ ' : '') + label;
    toast.classList.toggle('is-fail', !ok);
    toast.classList.add('is-shown');
    announce(label);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast?.classList.remove('is-shown'), 1600);
  }

  // "Edit the tool you're already using": re-open the source tool's inputs seeded
  // from the slot's current embed URL (mode 'edit' → "Re-apply to slot"). A commit
  // resolves the picker with the fresh render; cancelling stays here so the user
  // can still pick a different image instead.
  currentEl?.querySelector('.asset-picker-current-edit')?.addEventListener('click', async () => {
    const ref = await opts.editTool!(currentToolUrl!, 'edit');
    if (ref) close(ref);
  });

  // ── Keyboard navigation over the (responsive) card grid ────────────────────
  // Cards flow left-to-right then wrap, so DOM order == visual reading order:
  // Left/Right step through that order. The column count is unknown (responsive),
  // so Up/Down can't index by row - instead they pick the geometrically nearest
  // card in the row above/below by comparing on-screen centres. Scoped to the
  // currently visible pane so arrows never jump into a hidden one.
  const visiblePane = (): HTMLElement | null => root.querySelector<HTMLElement>('.asset-picker-pane:not([hidden])');
  const navCards = (): HTMLElement[] => {
    const pane = visiblePane();
    // Skip cards inside a collapsed section (offsetParent is null when display:none)
    // and fade-not-hide tiles this slot can't accept (aria-disabled) - keyboard
    // roving passes over them; a mouse click still hits them and is rejected.
    return pane ? [...pane.querySelectorAll<HTMLElement>('[data-asset-id],[data-tool-id],[data-session-slot]')]
      .filter(el => el.offsetParent !== null && el.getAttribute('aria-disabled') !== 'true') : [];
  };
  function focusCard(el: HTMLElement | null | undefined): void { if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'nearest' }); } }
  function moveSelection(cur: HTMLElement, key: string): void {
    const cards = navCards();
    const i = cards.indexOf(cur);
    if (key === 'ArrowRight') return focusCard(cards[i + 1]);
    if (key === 'ArrowLeft')  return focusCard(cards[i - 1]);
    const r = cur.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const down = key === 'ArrowDown';
    let best: HTMLElement | null = null, bestScore = Infinity;
    for (const c of cards) {
      if (c === cur) continue;
      const cr = c.getBoundingClientRect();
      const vy = (cr.top + cr.height / 2) - cy;
      if (down ? vy <= r.height * 0.4 : vy >= -r.height * 0.4) continue; // must be a further row
      const dx = Math.abs((cr.left + cr.width / 2) - cx);
      const score = dx + Math.abs(vy) * 1.5; // nearest column first, then nearest row
      if (score < bestScore) { bestScore = score; best = c; }
    }
    focusCard(best);
  }

  // Drag a card out of the picker (plans/134 P7): carries `text/lolly-asset`,
  // the same payload catalog tiles set - a slot behind the dialog can take it.
  root.addEventListener('dragstart', (e) => {
    const cardEl = (e.target as HTMLElement).closest?.('[data-asset-id]') as HTMLElement | null;
    if (!cardEl || !(e as DragEvent).dataTransfer) return;
    const dt = (e as DragEvent).dataTransfer!;
    dt.setData('text/lolly-asset', cardEl.dataset.assetId!);
    dt.setData('text/plain', cardEl.dataset.assetId!);
    dt.effectAllowed = 'copy';
  });
  root.querySelector<HTMLElement>('.asset-picker-panel')?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(null); return; }
    if (e.target === searchInput) {
      // Enter commits a ready tool-render card (paste link → ↵ → use).
      if (e.key === 'Enter') {
        const use = root.querySelector<HTMLButtonElement>('.asset-picker-toolcard .tc-use');
        if (use && !use.disabled) { e.preventDefault(); use.click(); }
        return;
      }
      // Down out of the search field drops into the grid.
      if (e.key === 'ArrowDown') { e.preventDefault(); focusCard(navCards()[0]); }
      return;
    }
    const cur = (e.target as HTMLElement).closest?.('[data-asset-id],[data-tool-id],[data-session-slot]') as HTMLElement | null | undefined;
    if (cur && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      moveSelection(cur, e.key);
    }
    // Enter / Space activate the focused card button natively → selects.
  });

  // Tab strip: click switches which source pane is visible; Arrow keys rove focus
  // between tabs (Home/End jump to the ends), activating each as it's reached - the
  // ARIA tabs pattern, which is lib/tabs.ts's whole job (it also picks up Up/Down,
  // which the hand-rolled copy this replaced dropped). wireTabs owns the button
  // state (is-active / aria-selected / roving tabindex) and the focus move; setTab
  // below owns everything picker-specific that follows.
  const tabsEl = root.querySelector<HTMLElement>('.asset-picker-tabs');
  // Keyboard roving must keep focus ON the tab so the next arrow press still lands
  // there; a click (or a programmatic jump) hands focus down to the pane's first card.
  const selectTab = tabsEl
    ? wireTabs(tabsEl, { key: 'tab', onSelect: (v, info) => applyTab(v as TabId, info.reason !== 'key') })
    : null;

  // The initial pane is baked into the markup as Library; if the default tab is
  // anything else (collect mode → Tools) switch to it now so the right pane paints
  // immediately, before the async library query resolves. renderTools needs only the
  // sync embedTools list, so the Tools pane is ready at once.
  if (activeTab !== 'library') setTab(activeTab);

  // One delegated handler serves every region: choose an icon colour, pick a
  // library/user asset, delete a user image, embed a saved session, or open a tool.
  body.addEventListener('click', async (e) => {
    // Icon colour pairing - the strip lives inside the (re-rendered) Icons group,
    // so it's handled by delegation rather than a per-render listener.
    const theme = (e.target as HTMLElement).closest<HTMLElement>('[data-theme-id]');
    if (theme) {
      // The first pairing is the icons' baked default → no id suffix in the pick.
      activeTheme = theme.dataset.themeId === iconThemes[0]?.id ? null : theme.dataset.themeId;
      libraryEl.querySelectorAll<HTMLElement>('[data-theme-id]').forEach(b => {
        const on = b === theme;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      retintThemableCards();
      return;
    }
    // Photo colour treatment - same delegation story as the icon strip above.
    const treat = (e.target as HTMLElement).closest<HTMLElement>('[data-treatment-id]');
    if (treat) {
      // The "None" button carries an empty id → the plain photo, no suffix.
      activeTreatment = treat.dataset.treatmentId || null;
      libraryEl.querySelectorAll<HTMLElement>('[data-treatment-id]').forEach(b => {
        const on = b === treat;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      retreatPhotoCards();
      return;
    }
    // Quick-filter by category: the icon row pins one library section open and
    // collapses the rest (click the active one again to collapse everything). The
    // section headers still toggle independently; both keep the row's indicator in
    // sync via updateCatbar().
    const catBtn = (e.target as HTMLElement).closest<HTMLElement>('[data-cat-filter]');
    if (catBtn) {
      const key = catBtn.dataset.catFilter!;
      const isOnlyOpen = !collapsedGroups.has(key)
        && libraryGroupKeys.every(k => k === key || collapsedGroups.has(k));
      if (isOnlyOpen) {
        collapsedGroups.add(key); // it was the sole open section → collapse all
      } else {
        for (const k of libraryGroupKeys) { if (k === key) collapsedGroups.delete(k); else collapsedGroups.add(k); }
      }
      applyLibraryCollapse();
      updateCatbar();
      if (!collapsedGroups.has(key)) {
        libraryEl.querySelector<HTMLElement>(`.asset-picker-group[data-group="${CSS.escape(key)}"]`)
          ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      return;
    }
    // Collapse / expand a library section. State is kept in `collapsedGroups` so it
    // survives the innerHTML rebuild a search / tab-return does.
    const gt = (e.target as HTMLElement).closest<HTMLElement>('[data-group-toggle]');
    if (gt) {
      const key = gt.dataset.groupToggle!;
      const sec = gt.closest('.asset-picker-group')!;
      const collapse = !sec.classList.contains('is-collapsed');
      sec.classList.toggle('is-collapsed', collapse);
      gt.setAttribute('aria-expanded', String(!collapse));
      if (collapse) collapsedGroups.add(key); else collapsedGroups.delete(key);
      updateCatbar(); // manually opening/closing a section moves the row's indicator too
      return;
    }
    // Projects tab: drill into a folder (or a breadcrumb) - empty id = the top level.
    const fo = (e.target as HTMLElement).closest<HTMLElement>('[data-folder-open]');
    if (fo) {
      projectFolder = fo.dataset.folderOpen || null;
      renderProjects(searchInput.value.trim().toLowerCase());
      focusCard(navCards()[0]);
      return;
    }
    const del = (e.target as HTMLElement).closest<HTMLElement>('[data-delete-id]');
    if (del) {
      const id = del.dataset.deleteId!;
      const name = (userAssets.find(a => a.id === id)?.meta?.name as string | undefined) ?? t('this image');
      // Deleting a user image is destructive and can't be undone - confirm first
      // (shared modal, matching the Catalog/Projects delete flows).
      const ok = await confirmDialog({
        title: t('Delete this image?'),
        message: tRaw('“{name}” will be permanently removed from your images. This can’t be undone.', { name }),
      });
      if (!ok) return;
      const card = del.closest<HTMLElement>('.asset-picker-card');
      card?.querySelector('.asset-picker-card-error')?.remove(); // clear any prior failure note
      try {
        // The bridge announces the delete ('lolly:user-asset-deleted', wired in
        // main.ts), which also drops an audio upload from the Neurospicy player.
        await host.assets._deleteUserAsset(id);
        // The measured waveform is keyed by asset id and nothing else deletes it, so
        // without this every deleted audio upload leaves an orphan row in the
        // 'audio-peaks' store that no code path can ever read or reclaim. Awaited
        // after the asset delete succeeded and never able to reject (deletePeaks
        // swallows), so it cannot turn a successful delete into the error branch.
        await deletePeaks(id);
        userAssets = userAssets.filter(a => a.id !== id);
        renderUserAssets();
        renderFavourites();
        announce(tRaw('Deleted {name}.', { name }));
      } catch (err) {
        host.log('error', 'Failed to delete user image', { id, error: String(err) });
        // The card is still on screen (the delete threw) - surface the failure beside
        // it rather than leaving the user staring at a card that wouldn't go away.
        if (card) {
          const msg = document.createElement('p');
          msg.className = 'asset-picker-card-error';
          msg.setAttribute('role', 'alert');
          msg.style.cssText = 'margin:4px 0 0;font-size:11px;color:hsl(var(--destructive));text-align:center';
          msg.textContent = t('Couldn’t delete - try again.');
          card.appendChild(msg);
        }
      }
      return;
    }
    // Per-card "Upscale": enlarge THIS existing raster (a library asset or one of the
    // user's uploads) on-device, without re-uploading it. Resolves the ref exactly like
    // the pick path (host.assets.get) and pre-loads it into the upscale dialog as the
    // source (skipping its choose step). The run is a BACKGROUND job (WP-F), so the
    // dialog closes at once and the saved asset arrives later via onComplete, where it
    // behaves like a normal pick - the same shape as the video jobs below. Sits beside
    // the pick button, so returning here before the [data-asset-id] branch below is what
    // stops the click from also picking the source.
    const up = (e.target as HTMLElement).closest<HTMLElement>('[data-upscale-id]');
    if (up) {
      e.preventDefault();
      const id = up.dataset.upscaleId!;
      const known = candidateById.get(id) ?? userAssets.find(a => a.id === id);
      const sourceName = (known?.meta?.name as string | undefined) ?? id;
      try {
        const ref = await host.assets.get(id);
        const { openUpscaleDialog } = await import('./upscale-dialog.ts');
        await openUpscaleDialog(host, {
          source: ref, sourceName,
          onComplete: (upscaled) => {
            if (collect) { void collect.onAsset(upscaled).then(collectToast); return; }
            close(upscaled);
          },
        });
      } catch (err) {
        host.log('error', 'Failed to upscale asset', { id, error: String(err) });
        announce(t('Couldn’t open the upscaler for this image.'), { assertive: true });
      }
      return;
    }
    // Remove-background card affordance - the exact mirror of the upscale one: take
    // the ref the user already has as the source, cut it out on-device, treat the
    // saved cutout like a normal pick. The run is a BACKGROUND job too, so the dialog
    // closes at once and the cutout arrives later via onComplete. Must return before
    // the pick branch below.
    const cut = (e.target as HTMLElement).closest<HTMLElement>('[data-matte-id]');
    if (cut) {
      e.preventDefault();
      const id = cut.dataset.matteId!;
      const known = candidateById.get(id) ?? userAssets.find(a => a.id === id);
      const sourceName = (known?.meta?.name as string | undefined) ?? id;
      try {
        const ref = await host.assets.get(id);
        const { openMatteDialog } = await import('./matte-dialog.ts');
        await openMatteDialog(host, {
          source: ref, sourceName,
          onComplete: (cutout) => {
            if (collect) { void collect.onAsset(cutout).then(collectToast); return; }
            close(cutout);
          },
        });
      } catch (err) {
        host.log('error', 'Failed to remove background', { id, error: String(err) });
        announce(t('Couldn’t open background removal for this image.'), { assertive: true });
      }
      return;
    }
    // The VIDEO mirror of the [data-matte-id] handler (WP-G): background-remove THIS
    // video on device via the shared video-job dialog. Unlike the still cut-out (which
    // returns synchronously), a video job runs in the BACKGROUND - the dialog starts it
    // and closes at once, and the saved transparent asset arrives later via onComplete,
    // where it behaves like a normal pick (the same collect-toast / close routing).
    const vcut = (e.target as HTMLElement).closest<HTMLElement>('[data-vidmatte-id]');
    if (vcut) {
      e.preventDefault();
      const id = vcut.dataset.vidmatteId!;
      const known = candidateById.get(id) ?? userAssets.find(a => a.id === id);
      const sourceName = (known?.meta?.name as string | undefined) ?? id;
      try {
        const ref = await host.assets.get(id);
        const ai = ref.meta?.aiGenerated;
        const { openVideoJobDialog } = await import('./video-job-dialog.ts');
        await openVideoJobDialog(host as unknown as VideoJobHost, {
          op: 'matte', source: ref, sourceName,
          ...(ai === 'full' || ai === 'partial' ? { aiGeneratedSource: ai } : {}),
          onComplete: (made) => {
            if (collect) { void collect.onAsset(made).then(collectToast); return; }
            close(made);
          },
        });
      } catch (err) {
        host.log('error', 'Failed to remove background from video', { id, error: String(err) });
        announce(t('Couldn’t open background removal for this video.'), { assertive: true });
      }
      return;
    }
    // Collect mode: a tool tile's "+ Add" quick-adds a default session (no editor). Must
    // beat the [data-tool-id] primary it sits inside.
    const quick = (e.target as HTMLElement).closest<HTMLElement>('[data-quickadd-tool]');
    if (quick && collect) {
      e.preventDefault(); e.stopPropagation();
      const r = await collect.onQuickAddTool(quick.dataset.quickaddTool!);
      // A silent result (the user dismissed a variation sub-chooser, so nothing was added)
      // shows no ✓/✗ feedback - there is nothing to report.
      if (!(typeof r === 'object' && r.silent)) flashCard(quick, r);
      return;
    }
    const sess = (e.target as HTMLElement).closest<HTMLElement>('[data-session-slot]');
    if (sess) {
      // Collect mode files the editable session into the folder; slot mode renders it as an image.
      if (collect) { flashCard(sess, await collect.onSession(sess.dataset.sessionSlot!)); return; }
      embedSession(sess.dataset.sessionSlot!); return;
    }
    const tool = (e.target as HTMLElement).closest<HTMLElement>('[data-tool-id]');
    if (tool) {
      // Collect mode opens the tool's editor (files in on first save) and tears down;
      // slot mode configures a render inline.
      if (collect) { collect.onOpenTool(tool.dataset.toolId!); close(null); return; }
      embedTool(tool.dataset.toolId!); return;
    }
    const pill = (e.target as HTMLElement).closest<HTMLElement>('[data-typepill]');
    if (pill) {
      libTypeFilter = pill.dataset.typepill as PickerTypeFilter;
      renderTypebar();
      restoreLibrary(searchInput.value.trim().toLowerCase());
      return;
    }
    // Audition (plans/134 P4): one shared <audio>; pressing another ▶ swaps the
    // track, pressing the playing one stops it. Never picks.
    const aud = (e.target as HTMLElement).closest<HTMLElement>('[data-audition-src]');
    if (aud) {
      e.stopPropagation();
      const src = aud.dataset.auditionSrc!;
      const playing = auditionEl && !auditionEl.paused && auditionEl.src === new URL(src, location.href).href;
      stopAudition();
      if (!playing) {
        auditionEl = new Audio(src);
        auditionEl.play().catch(() => { /* refused - the tile still picks fine */ });
        aud.textContent = '⏸';
        aud.setAttribute('aria-pressed', 'true');
        auditionEl.addEventListener('ended', stopAudition);
      }
      return;
    }
    const pick = (e.target as HTMLElement).closest<HTMLElement>('[data-asset-id]');
    if (pick) {
      // A non-default icon theme / photo treatment rides in the picked id so it
      // survives URL-mode round-trips (an asset value persists as its id alone).
      let pickId = pick.dataset.assetId!;
      const pickRef = candidateById.get(pickId);
      // Fade-not-hide (plans/162): a dimmed tile IS clickable, but this slot can't
      // take it - reject on select with a note beside the tile, rather than
      // committing an asset the tool would refuse. (aria-disabled already signals it.)
      const pickRefAny = pickRef ?? userAssets.find(a => a.id === pickId);
      if (opts.type && pickRefAny && !isAcceptable(pickRefAny.type)) {
        announce(t('This slot can’t use that kind of file.'), { assertive: true });
        const cardEl = pick.closest<HTMLElement>('.asset-picker-card') ?? pick;
        cardEl.querySelector('.asset-picker-card-error')?.remove();
        const note = document.createElement('p');
        note.className = 'asset-picker-card-error';
        note.setAttribute('role', 'alert');
        note.style.cssText = 'margin:4px 0 0;font-size:11px;color:hsl(var(--destructive));text-align:center';
        note.textContent = t('This slot can’t use that kind of file.');
        cardEl.appendChild(note);
        return;
      }
      if (activeTheme && isThemableRef(pickRef)) {
        pickId = buildThemedAssetId(pickId, activeTheme);
      } else if (activeTreatment && isTreatableRef(pickRef)) {
        pickId = buildTreatedAssetId(pickId, activeTreatment);
      }
      try {
        const resolved = await host.assets.get(pickId);
        recordRecentAsset(pickId);   // feeds the "Recent" section (plans/134 P1)
        if (collect) { flashCard(pick, await collect.onAsset(resolved)); return; }
        close(resolved);
      } catch (err) {
        host.log('error', 'Failed to resolve asset', { id: pickId, error: String(err) });
        announce(tRaw('Could not resolve asset: {message}', { message: (err as Error).message }), { assertive: true });
        // The picked card is still on screen - surface the failure beside it rather than
        // blocking on a native alert (same inline note as the delete path above).
        const card = pick.closest<HTMLElement>('.asset-picker-card');
        card?.querySelector('.asset-picker-card-error')?.remove(); // clear any prior failure note
        if (card) {
          const msg = document.createElement('p');
          msg.className = 'asset-picker-card-error';
          msg.setAttribute('role', 'alert');
          msg.style.cssText = 'margin:4px 0 0;font-size:11px;color:hsl(var(--destructive));text-align:center';
          msg.textContent = t('Couldn’t load - try again.');
          card.appendChild(msg);
        }
      }
    }
  });

  // A tool preview is a build artifact (catalog/previews/) that, though committed, can
  // be missing on a fresh checkout / before `npm run previews`, or drift from the index
  // - when one 404s, reveal the tool's inline icon instead of a broken image. Error
  // events don't bubble, so listen in the capture phase, scoped to tool previews so
  // library/session thumbs are untouched (mirrors gallery.ts).
  body.addEventListener('error', (e) => {
    const img = e.target;
    if (img instanceof HTMLImageElement && img.classList.contains('asset-picker-toolitem-preview')) {
      img.closest('.asset-picker-toolitem')?.classList.add('no-preview');
    }
  }, true);

  function setFooter(show: boolean): void { footerEl?.toggleAttribute('hidden', !show); }

  // Show/hide panes for the chosen tab, dismiss any tool-render takeover, re-filter
  // the now-visible pane with the current query, and land focus on its first card.
  // Public entry point: routes through wireTabs so the strip's own state
  // (is-active / aria-selected / roving tabindex) is applied exactly once, in one
  // place. With a single source there's no strip at all - apply the pane switch direct.
  function setTab(id: TabId): void {
    if (selectTab) selectTab(id);
    else applyTab(id, true);
  }

  // `focusFirstCard` is false only while arrow-roving the strip (see wireTabs above).
  function applyTab(id: TabId, focusFirstCard: boolean): void {
    stopAudition();
    activeTab = id;
    // Remember USER switches only - the boot application of the initial tab is
    // not a preference (and must not teach the memory the caller's default).
    if (tabMemoryArmed) recordTabMemory(opts.type ?? 'any', id);
    else tabMemoryArmed = true;
    toolcardHost.hidden = true;
    toolcardHost.innerHTML = '';
    if (currentEl) currentEl.hidden = false;
    root.querySelectorAll<HTMLElement>('.asset-picker-pane').forEach(p => { p.hidden = p.dataset.pane !== id; });
    setFooter(true);   // plans/134 P6: upload/webcam are never wrong, whatever the pane
    searchInput.placeholder = placeholderFor(id);
    const raw = searchInput.value.trim();
    const q = raw.toLowerCase();
    // A URL in the box is a paste-to-render intent, handled by the search listener - 
    // don't fight it by re-filtering a list underneath.
    if (!(allowToolUrl && /^https?:\/\//i.test(raw))) {
      if (id === 'library') restoreLibrary(q);
      else if (id === 'uploads') renderUserAssets();
      else if (id === 'sessions') renderSessions(q);
      else if (id === 'projects') renderProjects(q);
      else if (id === 'tools') renderTools(q);
    }
    if (!focusFirstCard) return;
    const first = navCards()[0];
    if (first) first.focus({ preventScroll: true });
  }

  // The "Private assets" pane - the user's own uploads, private to them until shared.
  // Filtered by the live search box (so the pane's search placeholder isn't a lie).
  function renderUserAssets(): void {
    if (!userEl) return;
    const q = searchInput.value.trim().toLowerCase();
    const list = q
      ? userAssets.filter(a => searchMatches(q, String(a.meta?.name ?? a.id), a.id))
      : userAssets;
    if (list.length === 0) {
      userEl.innerHTML = `<p class="asset-picker-empty" role="status">${
        userAssets.length === 0
          ? t('Nothing here yet. Upload your own with the button below - your assets stay private until you share them.')
          : t('No private assets match.')
      }</p>`;
      return;
    }

    // Group the loaded images by the folder each belongs to (if any), preserving
    // the newest-first order within each group. Cards keep their existing markup
    // so pick/delete/keyboard-nav are unchanged - only headings are added.
    const folderOf = new Map<string, Folder>();
    for (const f of folders) for (const it of f.items) if (it.type === 'image') folderOf.set(it.ref, f);
    const groups = new Map<string, { name: string; items: AssetRef[] }>();   // folderId → { name, items }
    const ungrouped: AssetRef[] = [];
    for (const a of list) {
      const f = folderOf.get(a.id);
      if (f) { if (!groups.has(f.id)) groups.set(f.id, { name: f.name, items: [] }); groups.get(f.id)!.items.push(a); }
      else ungrouped.push(a);
    }

    let inner = '';
    for (const g of groups.values()) {
      inner += `<div class="asset-picker-folder-head">${escapeHtml(g.name)}</div>`;
      inner += `<div class="asset-picker-grid">${g.items.map(userCard).join('')}</div>`;
    }
    if (ungrouped.length) {
      if (groups.size) inner += `<div class="asset-picker-folder-head">${t('Ungrouped')}</div>`;
      inner += `<div class="asset-picker-grid">${ungrouped.map(userCard).join('')}</div>`;
    }
    userEl.innerHTML = inner;
    refreshLottieThumbs();
    refreshAudioThumbs();
    refreshTextThumbs();
    refreshMotionThumbs();
    markIncompatibleTiles(); // fade-not-hide: dim tiles this slot can't accept
  }

  /**
   * The trim-to-content offer on the picker's upload flow (plan 97 section 7.3) - the path
   * EVERY tool's asset input goes through, so a padded logo dropped straight into a
   * tool gets the same before/after card as one added in the design-system studio.
   *
   * The card mounts INSIDE this dialog (the `.asset-picker-trim` slot above the
   * upload row), never as a second dialog over it. Resolves to the file to actually
   * store: the trimmed bytes, or the original when the user keeps the margins, when
   * the file is not an image, or when it is already tight (no card shown at all).
   *
   * NULL means the user backed out (Escape, or the card's ✕): the upload is
   * abandoned, nothing is stored and the picker stays open on the library where
   * they left it. A dismissal must not quietly ingest the file it was asking about.
   *
   * MUST run before storeUserUpload - its normaliser strips an SVG's root
   * width/height, leaving a viewBox rewrite nothing to bite on. Never rejects: a
   * failed measurement is not a reason to fail an upload.
   *
   * Deliberately not on the webcam / screen-capture paths: a captured frame has no
   * authored artboard, so there are no margins to offer back.
   */
  async function offerTrim(file: File): Promise<File | null> {
    const mount = root.querySelector<HTMLElement>('.asset-picker-trim');
    if (!mount) return file;
    // One slot, one card. The upload row stays reachable under an open card, so a
    // second pick would otherwise overwrite the mount and strand the first upload on
    // a promise nothing settles. That file just ingests as it arrived.
    if (pendingTrim) return file;
    // Lazy chunk - the measure/crop code loads only when a file actually arrives.
    const trim = await import('../lib/design-system/trim-offer.ts').catch(() => null);
    if (!trim) return file;
    const proposal = await trim.prepareTrim(file).catch(() => null);
    if (!proposal || !mount.isConnected) return file;
    mount.hidden = false;
    return new Promise<File | null>((resolve) => {
      // Assigned by the mount call below; a decision can only arrive from a click or
      // an Escape, so the null check is the "already answered" latch, not a race.
      let teardown: (() => void) | null = null;
      // `restoreFocus` only when the USER answered: the card held focus and its buttons
      // are about to go. On the dialog-is-closing path close() restores the opener.
      const finish = (chosen: File | null, restoreFocus = false): void => {
        if (!teardown) return;
        teardown();
        teardown = null;
        mount.hidden = true;
        pendingTrim = null;
        if (restoreFocus) root.querySelector<HTMLElement>('.asset-picker-upload input[type="file"]')?.focus();
        resolve(chosen);
      };
      teardown = trim.mountTrimOffer(mount, proposal, {
        t,
        onResolve: (chosen) => finish(chosen, true),
        onCancel: () => finish(null, true),
      });
      // The DIALOG going away under an open card is not the user backing out of the
      // upload: they asked for this file, so it still ingests, with its original
      // margins (see close(), which calls this before the wipe).
      pendingTrim = () => finish(proposal.originalFile);
    });
  }

  if (opts.allowUpload) {
    const fileInput = root.querySelector<HTMLInputElement>('input[type="file"]')!;
    // Drag a file onto the open picker, or paste an image (plans/134 P6): both
    // hand the file to the input's own change pipeline (DataTransfer), so the
    // PDF/PPTX routing and the trim-to-content offer all run unchanged.
    const panel = root.querySelector<HTMLElement>('.asset-picker-panel');
    const ingestDropped = (file: File | undefined | null): void => {
      if (!file) return;
      root.querySelector<HTMLElement>('.asset-picker-footer-error')?.setAttribute('hidden', '');
      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change'));
      } catch { /* DataTransfer construction unsupported - the Upload button remains */ }
    };
    panel?.addEventListener('dragover', (e) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      panel.classList.add('is-dropping');
    });
    panel?.addEventListener('dragleave', (e) => {
      if (e.target === panel) panel.classList.remove('is-dropping');
    });
    panel?.addEventListener('drop', (e) => {
      if (!e.dataTransfer?.files.length) return;
      e.preventDefault();
      panel.classList.remove('is-dropping');
      ingestDropped(e.dataTransfer.files[0]);
    });
    panel?.addEventListener('paste', (e) => {
      const file = [...(e.clipboardData?.files ?? [])][0];
      if (!file) return;
      e.preventDefault();
      ingestDropped(file);
    });
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      try {
        // A PDF/.ai becomes an SVG asset of one chosen page (the picker fills a single
        // slot, so single-select). The converter is a lazy chunk - pdf-lib only loads
        // when a PDF actually arrives. A cancelled page pick returns no refs: stay open.
        if (isPdfUpload(file)) {
          // Collect mode can file every chosen page into the folder (multi-select);
          // slot mode fills the single slot with the first page.
          const { ingestPdfAsSvgAssets } = await import('./pdf-import.ts');
          const refs = await ingestPdfAsSvgAssets(host, file, {
            mode: collect ? 'multi' : 'single',
            warn: (m) => announce(m, { assertive: true }),
          });
          if (collect) { for (const r of refs) await collect.onAsset(r); if (refs.length) collectToast(true); return; }
          if (refs[0]) close(refs[0]);
          return;
        }
        // A .pptx deck routes the same way - chosen slide(s) become SVG assets via
        // the lazy pptx-import chunk. Same collect/slot semantics as the PDF branch.
        if (isPptxUpload(file)) {
          const { ingestPptxAsSvgAssets } = await import('./pptx-import.ts');
          const refs = await ingestPptxAsSvgAssets(host, file, {
            mode: collect ? 'multi' : 'single',
            warn: (m) => announce(m, { assertive: true }),
          });
          if (collect) { for (const r of refs) await collect.onAsset(r); if (refs.length) collectToast(true); return; }
          if (refs[0]) close(refs[0]);
          return;
        }
        // The trim question, then the ingest - and with the answer's file, never the
        // one the input handed over (offerTrim's doc comment says why the order matters).
        const answered = await offerTrim(file);
        if (!answered) return;   // backed out of the card: nothing stored, dialog stays open
        const ref = await storeUserUpload(host, answered);
        if (collect) { collectToast(await collect.onAsset(ref)); return; }
        close(ref);
      } catch (e) {
        host.log('error', 'Upload failed', { error: String(e) });
        // Visible, not just announced (plans/134 P6): the footer keeps the reason
        // on screen until the next attempt clears it.
        const errEl = root.querySelector<HTMLElement>('.asset-picker-footer-error');
        if (errEl) { errEl.hidden = false; errEl.textContent = (e as { code?: unknown }).code ? (e as Error).message : t('Upload failed. Try another file.'); }
        // Cap/quota errors carry a user-ready message; prefix only the rest.
        announce((e as { code?: unknown }).code ? (e as Error).message : tRaw('Upload failed: {message}', { message: (e as Error).message }), { assertive: true });
      } finally {
        fileInput.value = ''; // allow re-selecting the same file after an error
      }
    });
  }

  // "Take a photo": open a live webcam preview, capture one frame, and store it as an
  // ordinary raster user asset (same path + AssetRef as an upload). Camera teardown is
  // handled inside openWebcamCapture so no track outlives the dialog.
  root.querySelector('.asset-picker-webcam')?.addEventListener('click', async () => {
    const ref = await openWebcamCapture(host);
    if (!ref) return;
    if (collect) { collectToast(await collect.onAsset(ref)); return; }
    close(ref);
  });

  // "Capture screen": the browser's own display picker IS the selection UI - 
  // recorder.still() prompts it, grabs one frame, and stops the share immediately.
  // The frame takes the SAME ingest path as a webcam shot (storeUserUpload), so
  // resize/metadata/provenance handling stays identical across capture sources.
  root.querySelector('.asset-picker-screencap')?.addEventListener('click', async () => {
    try {
      const blob = await host.recorder!.still({ source: 'screen' });
      const file = new File([blob], `screen-${Date.now()}.png`, { type: blob.type || 'image/png' });
      const ref = await storeUserUpload(host, file);
      if (collect) { collectToast(await collect.onAsset(ref)); return; }
      close(ref);
    } catch (e) {
      // Dismissing the browser's share picker is a cancel, not a failure.
      if ((e as Error | null)?.name === 'NotAllowedError') return;
      host.log('error', 'Screen capture failed', { error: String(e) });
      announce(t('Couldn’t capture the frame.'), { assertive: true });
    }
  });

  // "Script audio": type/paste a script, pick a voice, generate speech on-device, save
  // it as a user audio asset. The dialog is a lazy chunk (views/script-audio.ts) so the
  // TTS UI costs nothing until asked for; teardown (abort/revoke) lives inside it.
  root.querySelector('.asset-picker-scriptaudio')?.addEventListener('click', async () => {
    const { openScriptAudioDialog } = await import('./script-audio.ts');
    const ref = await openScriptAudioDialog(host);
    if (!ref) return;
    if (collect) { collectToast(await collect.onAsset(ref)); return; }
    close(ref);
  });

  // "Upscale": choose a raster image, enlarge it on-device (host.upscale), save it
  // as a user raster asset. A lazy chunk (views/upscale-dialog.ts) so the model UI
  // costs nothing until asked for. The run itself is a background job, so the dialog
  // closes on Run and the finished asset arrives through onComplete.
  root.querySelector('.asset-picker-upscale')?.addEventListener('click', async () => {
    const { openUpscaleDialog } = await import('./upscale-dialog.ts');
    await openUpscaleDialog(host, {
      onComplete: (ref) => {
        if (collect) { void collect.onAsset(ref).then(collectToast); return; }
        close(ref);
      },
    });
  });

  // "Remove background": choose a raster image, cut the subject out on-device
  // (host.matte), save the cutout as a user raster asset. Lazy chunk
  // (views/matte-dialog.ts) so the model UI costs nothing until asked for. The run
  // itself is a background job, so the dialog closes on Run and the finished cutout
  // arrives through onComplete.
  root.querySelector('.asset-picker-matte')?.addEventListener('click', async () => {
    const { openMatteDialog } = await import('./matte-dialog.ts');
    await openMatteDialog(host, {
      onComplete: (ref) => {
        if (collect) { void collect.onAsset(ref).then(collectToast); return; }
        close(ref);
      },
    });
  });

  // Library sections + bucketing live in lib/asset-category.ts (shared with the Catalog
  // view so both group identically). A per-user override (profile.assetCategories) layers
  // over the tag inference - loaded once per open, refreshed on each render() below.
  const cat = (ref: AssetRef): string => libCategory(ref, assetCategoryOverrides);
  const collapsedGroups = new Set<string>(); // group keys the user collapsed; persists across re-render
  // The present top-level library category keys, in display order - the model behind
  // the category filter row. Refreshed on every renderLibrary (search narrows it).
  let libraryGroupKeys: string[] = [];
  // Seed the "one category open" default exactly once, on the first full render.
  let catFilterSeeded = false;
  const CHEVRON = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 6 15 12 9 18"/></svg>';

  // One collapsible section shell - used by the library groups and their nested
  // sub-groups, so the delegated toggle handler
  // and collapse-state Set serve all of them identically. `collapsed` defaults to
  // the persisted state but callers can override it (the library forces every
  // section open while a search query is active so matches are never hidden).
  function sectionHtml(
    g: { key: string; label: string }, count: string | number, strip: string, bodyHtml: string,
    collapsed: boolean = collapsedGroups.has(g.key),
  ): string {
    return `<section class="asset-picker-group${collapsed ? ' is-collapsed' : ''}" data-group="${escapeHtml(g.key)}">
      <div class="asset-picker-group-head">
        <button type="button" class="asset-picker-group-toggle" data-group-toggle="${escapeHtml(g.key)}" aria-expanded="${!collapsed}">
          <span class="asset-picker-group-chevron">${CHEVRON}</span>
          <span class="asset-picker-group-icon">${categoryGlyph(g.key)}</span>
          <span class="asset-picker-group-title">${escapeHtml(t(g.label))}</span>
          <span class="asset-picker-count">${count}</span>
        </button>
        ${strip}
      </div>
      <div class="asset-picker-group-body">${bodyHtml}</div>
    </section>`;
  }

  // The category filter row (icons up the top of the library pane): one glyph per
  // present category, active when its section is open, hidden while searching or
  // when there's only one category (nothing to filter between).
  function renderCatbar(): void {
    if (!catbarEl) return;
    const searching = searchInput.value.trim() !== '';
    if (searching || libraryGroupKeys.length < 2) { catbarEl.hidden = true; catbarEl.innerHTML = ''; return; }
    catbarEl.hidden = false;
    catbarEl.innerHTML = libraryGroupKeys.map(key => {
      const on = !collapsedGroups.has(key);
      const label = t(categoryLabel(key));
      return `<button type="button" class="asset-picker-catbtn${on ? ' is-active' : ''}" data-cat-filter="${escapeHtml(key)}" aria-pressed="${on}" aria-label="${escapeHtml(label)}" data-tip="${escapeHtml(label)}" data-tip-below>
        <span class="asset-picker-catbtn-glyph">${categoryGlyph(key)}</span>
      </button>`;
    }).join('');
  }

  // Reflect collapsedGroups onto the filter row's active states (called after a
  // section toggle or a filter click, without rebuilding the row).
  function updateCatbar(): void {
    if (!catbarEl) return;
    for (const btn of catbarEl.querySelectorAll<HTMLElement>('[data-cat-filter]')) {
      const on = !collapsedGroups.has(btn.dataset.catFilter!);
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', String(on));
    }
  }

  // Apply collapsedGroups to the already-rendered top-level library sections (so a
  // filter click doesn't rebuild the grids, losing scroll / live thumbnails).
  function applyLibraryCollapse(): void {
    for (const sec of libraryEl.querySelectorAll<HTMLElement>(':scope > .asset-picker-group[data-group]')) {
      const collapsed = collapsedGroups.has(sec.dataset.group!);
      sec.classList.toggle('is-collapsed', collapsed);
      sec.querySelector('.asset-picker-group-toggle')?.setAttribute('aria-expanded', String(!collapsed));
    }
  }

  // A group's body: the items not claimed by a sub-group as a grid, then each
  // non-empty sub-group as a nested collapsible section.
  function groupBodyHtml(g: LibGroup, items: AssetRef[]): string {
    const subs: string[] = [];
    let rest = items;
    for (const s of g.sub ?? []) {
      const inSub = rest.filter(c => (c.meta?.tags as string[] | undefined)?.includes(s.tag));
      if (inSub.length) {
        subs.push(sectionHtml(s, inSub.length, '', `<div class="asset-picker-grid">${inSub.map(card).join('')}</div>`));
        rest = rest.filter(c => !(c.meta?.tags as string[] | undefined)?.includes(s.tag));
      }
    }
    const restGrid = rest.length ? `<div class="asset-picker-grid">${rest.map(card).join('')}</div>` : '';
    return restGrid + subs.join('');
  }

  function renderLibrary(candidates: AssetRef[]): void {
    if (candidates.length === 0) {
      libraryEl.innerHTML = `<p class="asset-picker-empty" role="status">${opts.allowUpload ? t('No assets match. Upload one below.') : t('No assets match.')}</p>`;
      libraryGroupKeys = [];
      renderCatbar(); // nothing to filter → hide the row (esp. on a zero-result search)
      return;
    }
    // Bucket by category, preserving order within each bucket.
    const buckets = new Map<string, AssetRef[]>();
    for (const c of candidates) {
      const k = cat(c);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k)!.push(c);
    }
    const present = LIB_GROUPS.filter(g => buckets.get(g.key)?.length);
    libraryGroupKeys = present.map(g => g.key);
    // First render seeds the "one category open" default: everything collapses except
    // the current asset's category (or the first present one). After that the user's
    // own expand/collapse choices, held in collapsedGroups, are respected.
    if (!catFilterSeeded) {
      catFilterSeeded = true;
      const curRef = currentBaseId ? candidates.find(c => assetBaseId(c.id) === currentBaseId) : undefined;
      const openKey = (curRef && present.some(g => g.key === cat(curRef))) ? cat(curRef) : present[0]?.key;
      for (const g of present) if (g.key !== openKey) collapsedGroups.add(g.key);
    }
    // While a search query is active every section renders open, so matches are
    // never hidden behind a collapsed folder; the filter row is hidden meanwhile.
    const searching = searchInput.value.trim() !== '';
    // A group carries a colour strip in its header: the icon pairing strip when
    // it holds themable icons, or the photo treatment strip when it holds raster
    // photos. A group is one or the other, never both.
    const themableOf = (items: AssetRef[]) => iconThemes.length > 1 && items.some(isThemableRef);
    const treatableOf = (items: AssetRef[]) => photoTreatments.length > 0 && items.some(isTreatableRef);
    // Every picker gets the same section chrome - even a single-category one
    // (e.g. a raster-only field) - so a narrow slot's picker matches the full
    // catalog selector: collapsible folders, nested sub-groups (Headshots), and
    // the colour strip whenever themable icons / treatable photos are present.
    libraryEl.innerHTML = present.map(g => {
      const items = buckets.get(g.key)!;
      const strip = themableOf(items) ? themeStripHtml() : treatableOf(items) ? treatmentStripHtml() : '';
      return sectionHtml(g, items.length, strip, groupBodyHtml(g, items), searching ? false : collapsedGroups.has(g.key));
    }).join('');
    renderCatbar();
    ensureTreatmentDefs();
    retintThemableCards(); // re-applied after every innerHTML rebuild (search, tab return)
    retreatPhotoCards();
    refreshLottieThumbs();
    refreshAudioThumbs();
    refreshTextThumbs();
    refreshMotionThumbs();
    markIncompatibleTiles(); // fade-not-hide: dim tiles this slot can't accept
  }

  // Fade-not-hide (plans/162): a still-image family slot shows the whole visual
  // catalog; tiles it can't accept are dimmed + aria-disabled here (rejected on
  // click, skipped by keyboard nav) rather than hidden. A full-card opacity wash,
  // not a one-sided rail (house rule). No-op for an untyped `any` pick.
  function markIncompatibleTiles(): void {
    if (!opts.type) return;
    for (const el of root.querySelectorAll<HTMLElement>('[data-asset-id]')) {
      const id = el.dataset.assetId;
      const ref = id ? (candidateById.get(id) ?? userAssets.find(a => a.id === id)) : undefined;
      if (!ref) continue;
      const ok = isAcceptable(ref.type);
      const cardEl = el.closest<HTMLElement>('.asset-picker-card') ?? el;
      cardEl.classList.toggle('is-incompatible', !ok);
      if (!ok) { el.setAttribute('aria-disabled', 'true'); cardEl.setAttribute('aria-disabled', 'true'); }
      else { el.removeAttribute('aria-disabled'); cardEl.removeAttribute('aria-disabled'); }
    }
  }

  // ── Icon theme strip ────────────────────────────────────────────────────────
  // Markup for the colour-pairing strip. Rebuilt with the Icons group on every
  // renderLibrary (search / tab return); the active pairing lives in `activeTheme`
  // and clicks are handled by the delegated body listener, so no per-render wiring.
  function themeStripHtml(): string {
    return `<div class="asset-picker-themes" role="group" aria-label="${escapeHtml(t('Colour theme'))}">`
      + `<span class="asset-picker-themes-label">${t('Colours')}</span>`
      + iconThemes.map((t, i) => {
          const on = activeTheme ? t.id === activeTheme : i === 0;
          return `<button type="button" class="asset-picker-theme${on ? ' is-active' : ''}" data-theme-id="${escapeHtml(t.id)}" data-sfx="shimmer" data-voice="${escapeHtml(t.label ?? t.id)}" aria-pressed="${on}">
            <span class="asset-picker-theme-duo" style="background:${escapeHtml(t.previewBg ?? '#ffffff')}"><i style="background:${escapeHtml(t.c2)}"></i><i style="background:${escapeHtml(t.c1)}"></i></span>
            <span>${escapeHtml(t.label ?? t.id)}</span>
          </button>`;
        }).join('')
      + `</div>`;
  }

  // Live-preview the chosen pairing on every themable thumbnail. Restyle (class
  // contract kept) rather than bake - each thumb is its own <img> document, so
  // there is no cross-icon CSS collision here. SVG text is fetched once per
  // asset and finished data URLs are cached per pairing, so a rebuild (every
  // search keystroke re-renders the grid) just reassigns strings; a seq guard
  // drops stale passes when the user flips themes quickly.
  const iconSvgTextCache = new Map<string, Promise<string | null>>();  // asset id → Promise<string|null>
  const themedThumbCache = new Map<string, string>();  // `${asset id}:${theme id}` → data URL
  let retintSeq = 0;
  function retintThemableCards(): void {
    const def = activeTheme ? iconThemes.find(t => t.id === activeTheme) : null;
    const seq = ++retintSeq;
    // Scope to the whole library PANE (not just libraryEl) so themable icons pinned in
    // the Favourites section retint too - they share candidateById with the grid.
    for (const cardEl of libraryPane.querySelectorAll<HTMLElement>('[data-asset-id]')) {
      const ref = candidateById.get(cardEl.dataset.assetId!);
      if (!isThemableRef(ref)) continue;
      const img = cardEl.querySelector<HTMLImageElement>('img.asset-picker-thumb');
      if (!img) continue;
      if (!def) { img.src = ref.url; img.style.background = ''; continue; }
      const cached = themedThumbCache.get(`${ref.id}:${def.id}`);
      if (cached) { img.src = cached; img.style.background = def.previewBg ?? ''; continue; }
      let textP = iconSvgTextCache.get(ref.id);
      if (!textP) {
        textP = fetch(ref.url).then(r => (r.ok ? r.text() : null)).catch(() => null);
        iconSvgTextCache.set(ref.id, textP);
      }
      textP.then(text => {
        const restyled = text ? restyleIconTheme(text, def) : null;
        if (!restyled) return;
        const src = svgDataUrl(restyled);
        themedThumbCache.set(`${ref.id}:${def.id}`, src);
        if (seq !== retintSeq) return; // superseded by a newer theme choice
        img.src = src;
        img.style.background = def.previewBg ?? '';
      });
    }
  }

  // ── Photo treatment strip ────────────────────────────────────────────────────
  // Markup for the treatment strip, rebuilt with each photo group. A leading
  // "None" button clears the treatment; the rest are the catalog's treatments,
  // each with a swatch previewing its look (a grey ramp, or the duotone's
  // shadow→highlight gradient).
  function treatmentStripHtml(): string {
    const swatch = (t: PhotoTreatment): string =>
      t.kind === 'greyscale'
        ? 'linear-gradient(135deg,#2b2b2b,#e9e9e9)'
        : `linear-gradient(135deg,${[t.shadow, t.mid, t.highlight].filter(Boolean).join(',')})`;
    const btn = (id: string, label: string, swClass: string, swStyle: string, on: boolean): string =>
      `<button type="button" class="asset-picker-theme asset-picker-treat${on ? ' is-active' : ''}" data-treatment-id="${escapeHtml(id)}" aria-pressed="${on}">`
      + `<span class="asset-picker-treat-sw${swClass}"${swStyle ? ` style="${swStyle}"` : ''}></span><span>${escapeHtml(label)}</span></button>`;
    return `<div class="asset-picker-treatments" role="group" aria-label="${escapeHtml(t('Photo colour treatment'))}">`
      + `<span class="asset-picker-themes-label">${t('Colour')}</span>`
      + btn('', t('None'), ' is-none', '', !activeTreatment)
      + photoTreatments.map(t => btn(t.id, t.label ?? t.id, '', `background:${swatch(t)}`, t.id === activeTreatment)).join('')
      + `</div>`;
  }

  // Live-preview the chosen treatment on every photo thumbnail via a CSS filter
  // that points at an injected SVG <filter> def - cheap, no re-encode (the real
  // bake happens once, at resolve, when the photo is actually picked). Mirrors
  // retintThemableCards but for raster cards.
  function retreatPhotoCards(): void {
    const def = activeTreatment ? photoTreatments.find(t => t.id === activeTreatment) : null;
    for (const cardEl of libraryPane.querySelectorAll<HTMLElement>('[data-asset-id]')) {
      if (!isTreatableRef(candidateById.get(cardEl.dataset.assetId!))) continue;
      const img = cardEl.querySelector<HTMLImageElement>('img.asset-picker-thumb');
      if (img) img.style.filter = def ? `url(#${TREATMENT_FILTER_PREFIX}${def.id})` : '';
    }
  }

  // A hidden <svg><defs> of the treatment filters, injected once so the preview
  // CSS `filter: url(#…)` above can reference them. Rebuilt from the catalog's
  // treatments (ids are validated [a-z0-9-], so the fragment refs are safe).
  const TREATMENT_FILTER_PREFIX = 'lolly-pt-';
  function ensureTreatmentDefs(): void {
    if (!photoTreatments.length || root.querySelector('#lolly-pt-defs')) return;
    const defs = photoTreatments.map(t => treatmentFilterSvg(t, `${TREATMENT_FILTER_PREFIX}${t.id}`)).join('');
    const holder = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    holder.id = 'lolly-pt-defs';
    holder.setAttribute('width', '0');
    holder.setAttribute('height', '0');
    holder.setAttribute('aria-hidden', 'true');
    holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    holder.innerHTML = `<defs>${defs}</defs>`;
    root.appendChild(holder);
  }

  // ── Search matching (all four panes) ───────────────────────────────────────
  // One matcher instead of the old four per-tab `.includes()` copies (plans/99
  // M3, principle 1): fold both sides, AND across tokens via lib/search. Each
  // pane keeps its exact field set at the call site. `q` arrives trimmed +
  // lowercased from the search box; tokenize() folds it the rest of the way
  // (diacritics), so "café" finds "cafe" and the reverse. Empty query matches
  // everything - search acts as a filter, not a mode.
  let lastQ = '';
  let lastQTokens: string[] = [];
  const searchMatches = (q: string, ...fields: Array<string | null | undefined>): boolean => {
    if (!q) return true;
    // The pane render filters many items against ONE query - memoise its tokens.
    if (q !== lastQ) { lastQ = q; lastQTokens = tokenize(q); }
    return scoreHaystack(
      fields.filter((f): f is string => !!f).map(text => ({ text: fold(text), weight: 1 })),
      lastQTokens,
    ) > 0;
  };

  // Library candidates resolve async (host.assets.query); `restoreLibrary` filters
  // them and is safe to call before they land (shows the loading state until then).
  let libraryCandidates: AssetRef[] = [];
  let candidateById = new Map<string, AssetRef>();
  let libraryLoaded = false;
  // Type filter (plans/134 P5): the catalog's All/Image/Vector/Motion/Audio
  // buckets, offered only when the slot itself is untyped (a typed pick is
  // already narrowed at the query). Client-side over the loaded candidates.
  let libTypeFilter: PickerTypeFilter = 'all';
  const typeFiltered = (list: readonly AssetRef[]): AssetRef[] =>
    libTypeFilter === 'all' ? [...list] : list.filter(a => pickerMatchesType(a, libTypeFilter));
  function renderTypebar(): void {
    if (!typebarEl) return;
    if (opts.type) { typebarEl.hidden = true; return; }   // slot already narrows the type
    const present = PICKER_TYPE_FILTERS.filter(f => f.key === 'all' || libraryCandidates.some(a => pickerMatchesType(a, f.key)));
    if (present.length <= 2) { typebarEl.hidden = true; return; }   // one real bucket - nothing to filter
    typebarEl.hidden = false;
    typebarEl.innerHTML = present.map(f =>
      `<button type="button" class="asset-picker-typepill${libTypeFilter === f.key ? ' is-on' : ''}" data-typepill="${f.key}" aria-pressed="${libTypeFilter === f.key}">${escapeHtml(t(f.label))}</button>`).join('');
  }

  function restoreLibrary(q: string): void {
    if (!libraryLoaded) { libraryEl.innerHTML = `<div class="asset-picker-loading">${t('Loading…')}</div>`; return; }
    if (!q) { renderLibrary(typeFiltered(libraryCandidates)); return; }
    renderLibrary(typeFiltered(libraryCandidates).filter(c => searchMatches(q, String(c.meta?.name ?? c.id), c.id)));
  }

  // ── Favourites - a pinned, collapsible section at the top of the library pane ──
  // Unions the user's starred LIBRARY assets and starred USER images (keyed by base id,
  // so a themed icon starred once shows once). Read-only pins here - a favourite is
  // picked like any other card (delegated [data-asset-id] handler resolves it, incl.
  // user ids). Starring itself happens in the Catalog view. Rebuilt whenever the sources
  // or the favourites set change; unaffected by the search box (it's a fixed shortcut).
  /** The pinned "Recent" section (plans/134 P1): recently picked assets that
   *  this pick could still place, newest first, capped at 8. */
  function renderRecents(): void {
    if (!recentsEl) return;
    const order = readRecentAssets();
    if (!order.length) { recentsEl.hidden = true; recentsEl.innerHTML = ''; return; }
    const byBase = new Map<string, AssetRef>();
    for (const ref of [...libraryCandidates, ...userAssets]) {
      const base = assetBaseId(ref.id);
      if (!byBase.has(base)) byBase.set(base, ref);
    }
    const items = order.map(b => byBase.get(b)).filter((r): r is AssetRef => !!r).slice(0, 8);
    if (!items.length) { recentsEl.hidden = true; recentsEl.innerHTML = ''; return; }
    recentsEl.hidden = false;
    recentsEl.innerHTML = sectionHtml(
      { key: 'recents', label: t('Recent') },
      items.length, '',
      `<div class="asset-picker-grid">${items.map(card).join('')}</div>`,
    );
    refreshLottieThumbs();
    refreshAudioThumbs();
    refreshTextThumbs();
    refreshMotionThumbs();
    markIncompatibleTiles(); // fade-not-hide: dim tiles this slot can't accept
  }

  function renderFavourites(): void {
    renderRecents();
    if (!favEl) return;
    if (favSet.size === 0) { favEl.hidden = true; favEl.innerHTML = ''; return; }
    // Candidates the picker can actually pick, deduped by base id, in library-then-user
    // order. Hidden assets are already filtered out of both source lists upstream.
    const seen = new Set<string>();
    const favItems: AssetRef[] = [];
    for (const ref of [...libraryCandidates, ...userAssets]) {
      const base = assetBaseId(ref.id);
      if (!favSet.has(base) || seen.has(base)) continue;
      seen.add(base);
      favItems.push(ref);
    }
    if (favItems.length === 0) { favEl.hidden = true; favEl.innerHTML = ''; return; }
    favEl.hidden = false;
    favEl.innerHTML = sectionHtml(
      { key: 'favourites', label: '★ Favourites' },
      favItems.length, '',
      `<div class="asset-picker-grid">${favItems.map(card).join('')}</div>`,
    );
    retintThemableCards();
    retreatPhotoCards();
    refreshLottieThumbs();
    refreshAudioThumbs();
    refreshTextThumbs();
    refreshMotionThumbs();
    markIncompatibleTiles(); // fade-not-hide: dim tiles this slot can't accept
  }

  // ── Saved creations (previous single-tool sessions) ────────────────────────
  function renderSessions(q: string): void {
    if (!sessionsPane) return;
    if (sessions === null) { sessionsPane.innerHTML = `<div class="asset-picker-loading">${t('Loading…')}</div>`; return; }
    const list = q ? sessions.filter(s => searchMatches(q, s.toolName, s.label, s.toolId)) : sessions;
    if (list.length === 0) {
      sessionsPane.innerHTML = `<p class="asset-picker-empty">${sessions.length
        ? t('No saved creations match.')
        : t('No saved creations yet - save a tool you’ve made, then embed it here as an image.')}</p>`;
      return;
    }
    sessionsPane.innerHTML =
      `<div class="asset-picker-section-head">${t('Your saved creations')} <span class="asset-picker-count">${sessions.length}</span></div>` +
      `<div class="asset-picker-grid">${list.map(sessionCard).join('')}</div>`;
  }

  // ── Projects (browse the user's folders of saved creations + images) ────────
  // The items a folder holds that this picker can actually place: saved creations
  // whose tool still renders here, and user images that are loaded. Non-pickable
  // refs (a session tool that can't embed, images on a no-upload slot) are skipped.
  function pickableFolderItems(f: Folder): FolderItem[] {
    return f.items.filter(it => it.type === 'session'
      ? (sessions ?? []).some(s => s.slot === it.ref)
      : userAssets.some(a => a.id === it.ref));
  }

  function folderCard(f: Folder): string {
    const subs  = childFolders(folders, f.id).length;
    const items = pickableFolderItems(f).length;
    const bits: string[] = [];
    if (subs)  bits.push(subs === 1 ? t('1 folder') : t('{n} folders', { n: subs }));
    if (items) bits.push(items === 1 ? t('1 item') : t('{n} items', { n: items }));
    return `
      <button type="button" class="asset-picker-card asset-picker-folderitem" data-folder-open="${escapeHtml(f.id)}" title="${escapeHtml(f.name)}">
        <span class="asset-picker-thumb asset-picker-folder-thumb" aria-hidden="true">${folderGlyph}</span>
        <span class="asset-picker-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
        <span class="asset-picker-sessitem-when">${escapeHtml(bits.join(' · ') || t('Empty'))}</span>
      </button>`;
  }

  // An image inside a folder - a plain pick tile (no delete affordance; deletion
  // lives in the Your images list). Picking routes through the shared [data-asset-id] handler.
  function projectImageCard(ref: AssetRef): string {
    const name = String(ref.meta?.name ?? t('Image'));
    const thumb = ref.type === 'lottie'
      ? (lottieThumb(ref, 'asset-picker-thumb') ?? `<span class="asset-picker-thumb asset-picker-thumb-stub" aria-hidden="true">▶</span>`)
      : ref.type === 'video'
        ? videoThumb(ref.url, 'asset-picker-thumb')
        : ref.type === 'audio'
          ? audioThumb(ref, 'asset-picker-thumb')
          : `<img class="asset-picker-thumb" src="${escapeHtml(ref.url)}" alt="" loading="lazy" decoding="async">`;
    const upBtn = upscaleButton(ref, name);
    const cutBtn = matteButton(ref, name);
    const vidBtn = vidMatteButton(ref, name);
    const inner = `${thumb}
        <span class="asset-picker-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>`;
    // A raster folder image splits into wrapper + pick button (like a user card) so the
    // Upscale / Remove-background siblings are valid HTML; a video image does the same
    // for its Remove-background sibling. Everything else stays the single plain pick button.
    if (!upBtn && !cutBtn && !vidBtn) {
      return `
      <button type="button" class="asset-picker-card" data-asset-id="${escapeHtml(ref.id)}" title="${escapeHtml(name)}">
        ${inner}
        ${formatBadge(ref)}
      </button>`;
    }
    return `
      <div class="asset-picker-card asset-picker-card-actionable">
        <button type="button" class="asset-picker-card-pick" data-asset-id="${escapeHtml(ref.id)}" title="${escapeHtml(name)}">
          ${inner}
        </button>
        ${upBtn}
        ${cutBtn}
        ${vidBtn}
        ${formatBadge(ref)}
      </div>`;
  }

  function renderProjects(q: string): void {
    if (!projectsPane) return;
    if (!foldersLoaded) { projectsPane.innerHTML = `<div class="asset-picker-loading">${t('Loading…')}</div>`; return; }
    // A folder that vanished (deleted elsewhere / synced-away) drops us back to the top.
    if (projectFolder && !folders.some(f => f.id === projectFolder)) projectFolder = null;

    const path = projectFolder ? folderPath(folders, projectFolder) : [];
    const crumbs = `<nav class="asset-picker-crumbs" aria-label="${escapeHtml(t('Folder path'))}">`
      + `<button type="button" class="asset-picker-crumb" data-folder-open="">${t('Projects')}</button>`
      + path.map((f, i) => {
          const last = i === path.length - 1;
          return `<span class="asset-picker-crumb-sep" aria-hidden="true">›</span>`
            + (last
                ? `<span class="asset-picker-crumb is-current" aria-current="true">${escapeHtml(f.name)}</span>`
                : `<button type="button" class="asset-picker-crumb" data-folder-open="${escapeHtml(f.id)}">${escapeHtml(f.name)}</button>`);
        }).join('')
      + `</nav>`;

    if (!folders.length) {
      projectsPane.innerHTML = crumbs
        + `<p class="asset-picker-empty">${t('No projects yet - group your saved creations and images into folders to browse them here.')}</p>`;
      return;
    }

    const kids = childFolders(folders, projectFolder).filter(f => searchMatches(q, f.name));
    const cur = projectFolder ? folders.find(f => f.id === projectFolder) ?? null : null;
    const itemCards: string[] = [];
    if (cur) {
      for (const it of pickableFolderItems(cur)) {
        if (it.type === 'session') {
          const s = (sessions ?? []).find(x => x.slot === it.ref)!;
          if (!searchMatches(q, s.toolName, s.label)) continue;
          itemCards.push(sessionCard(s));
        } else {
          const a = userAssets.find(x => x.id === it.ref)!;
          if (!searchMatches(q, String(a.meta?.name ?? ''))) continue;
          itemCards.push(projectImageCard(a));
        }
      }
    }

    const parts: string[] = [];
    if (kids.length)      parts.push(`<div class="asset-picker-grid asset-picker-foldergrid">${kids.map(folderCard).join('')}</div>`);
    if (itemCards.length) parts.push(`<div class="asset-picker-grid">${itemCards.join('')}</div>`);
    projectsPane.innerHTML = crumbs + (parts.length
      ? parts.join('')
      : `<p class="asset-picker-empty">${q ? t('Nothing here matches.') : (cur ? t('This folder is empty.') : t('No folders yet.'))}</p>`);
    refreshAudioThumbs();
    refreshTextThumbs();
    refreshMotionThumbs();
  }

  // ── Tools (configure first, then insert) ───────────────────────────────────
  function renderTools(q: string): void {
    if (!toolsPane) return;
    const list = q ? embedTools.filter(t => searchMatches(q, t.name, t.description, t.id)) : embedTools;
    if (list.length === 0) { toolsPane.innerHTML = `<p class="asset-picker-empty">${t('No tools match.')}</p>`; return; }
    const head = collect ? t('Start a new creation from a tool') : t('Make an image from a tool');
    toolsPane.innerHTML =
      `<div class="asset-picker-section-head">${head} <span class="asset-picker-count">${embedTools.length}</span></div>` +
      `<div class="asset-picker-grid asset-picker-toolgrid">${list.map(t => toolCard(t, !!collect)).join('')}</div>`;
  }

  // Take over the body with the tool-render card / a status message (back returns
  // to the active pane). Used by the paste flow, saved-session embeds, and the
  // tools fallback when no input editor is available.
  function showTakeover(html: string): void {
    root.querySelectorAll<HTMLElement>('.asset-picker-pane').forEach(p => { p.hidden = true; });
    if (currentEl) currentEl.hidden = true;
    setFooter(false);
    toolcardHost.hidden = false;
    toolcardHost.innerHTML = html;
  }
  function dismissTakeover(): void {
    searchInput.value = '';
    setTab(activeTab);
  }

  // Build the "render this Lolly tool/session as your image" card: detected-tool
  // header, format + size controls, a live preview, and a commit button. "Use this
  // render" resolves the picker with a tool-sourced AssetRef whose id is the
  // canonical embed URL, so it persists + re-renders exactly like a library asset.
  // `editUrl` (when the host provided opts.editTool) adds an "Edit inputs…" escape
  // hatch into the full input editor.
  function showToolCard(desc: ToolUrlDescription, url: string, { editUrl }: { editUrl?: string } = {}): void {
    const allowed = formatsForType(desc.formats, opts.type);
    const fmtOptions = allowed.map(f =>
      `<option value="${escapeHtml(f)}"${f === desc.format ? ' selected' : ''}>${escapeHtml(f.toUpperCase())}</option>`
    ).join('');
    const canEdit = Boolean(editUrl && opts.editTool);
    showTakeover(`
      <div class="asset-picker-toolcard">
        <div class="asset-picker-toolcard-head">
          <button type="button" class="asset-picker-toolcard-back" aria-label="${escapeHtml(t('Back to list'))}">←</button>
          <span class="asset-picker-toolcard-spark" aria-hidden="true">✦</span>
          <span>${t('Render the <strong>{name}</strong> tool as your image', { name: desc.name })}</span>
        </div>
        <div class="asset-picker-toolcard-controls">
          <label>${t('Format')} <select class="tc-format field-select field-select--auto" aria-label="${escapeHtml(t('Render format'))}">${fmtOptions}</select></label>
          <label>${t('Width')} <input type="number" class="tc-w field-input" min="1" inputmode="numeric" placeholder="${escapeHtml(t('auto'))}" value="${desc.width ?? ''}"></label>
          <label>${t('Height')} <input type="number" class="tc-h field-input" min="1" inputmode="numeric" placeholder="${escapeHtml(t('auto'))}" value="${desc.height ?? ''}"></label>
        </div>
        <div class="asset-picker-toolcard-preview"><div class="asset-picker-loading">${t('Rendering…')}</div></div>
        <label class="asset-picker-toolcard-freeze"><input type="checkbox" class="tc-freeze field-check"> ${t('Freeze as a static image')}</label>
        <p class="asset-picker-toolcard-freeze-help">${t("Won't update when the source tool changes, but doesn't count against nesting depth.")}</p>
        <div class="asset-picker-toolcard-actions">
          ${canEdit ? `<button type="button" class="tc-edit">${t('Edit inputs…')}</button>` : ''}
          <button type="button" class="tc-use" disabled>${t('Use this render')}</button>
        </div>
      </div>`);
    const cardEl    = toolcardHost.querySelector('.asset-picker-toolcard')!;
    const fmtSel    = cardEl.querySelector<HTMLSelectElement>('.tc-format')!;
    const wEl       = cardEl.querySelector<HTMLInputElement>('.tc-w')!;
    const hEl       = cardEl.querySelector<HTMLInputElement>('.tc-h')!;
    const previewEl = cardEl.querySelector<HTMLElement>('.asset-picker-toolcard-preview')!;
    const useBtn    = cardEl.querySelector<HTMLButtonElement>('.tc-use')!;
    const freezeEl  = cardEl.querySelector<HTMLInputElement>('.tc-freeze')!;

    cardEl.querySelector('.asset-picker-toolcard-back')?.addEventListener('click', dismissTakeover);
    if (canEdit) {
      cardEl.querySelector('.tc-edit')?.addEventListener('click', async () => {
        const ref = await opts.editTool!(editUrl!);
        // Through finish(), not close(): the freeze toggle applies to BOTH commit
        // paths, so an edited render still bakes when the box is ticked.
        if (ref) finish(ref);
      });
    }

    // Motion formats this card can commit (from describeUrl). A motion pick is
    // encoded as a live clip, which is SLOW (real-time frame capture), so the preview
    // always shows a cheap STILL poster and the clip is rendered only on commit.
    const motionSet = new Set((desc.motion ?? []).map(f => f.toLowerCase()));
    const isMotion = (f: string): boolean => motionSet.has(f.toLowerCase());
    const stillFmt = allowed.find(f => !isMotion(f)) ?? 'png'; // still stand-in for the poster
    const size = (): { width?: number; height?: number } => ({
      width:  parseInt(wEl.value, 10) || undefined,
      height: parseInt(hEl.value, 10) || undefined,
    });

    let posterRef: AssetRef | null = null;   // the still shown in the card (a still pick commits this as-is)
    let renderSeq = 0;      // drop a stale render when controls change again
    // A child whose preview ever took longer than this stops auto-rendering on
    // control changes - the user triggers each render instead (click-to-render),
    // so a heavy child (a 3D scene, a big PDF) can't make the card feel hung.
    const SLOW_RENDER_MS = 1000;
    let slowTool = false;
    const renderingHtml =
      `<button type="button" class="tc-render is-rendering" disabled><span class="tc-render-ring" aria-hidden="true"></span>${t('Rendering…')}</button>`;
    const renderPreview = async (): Promise<void> => {
      const seq = ++renderSeq;
      posterRef = null;
      useBtn.disabled = true;
      previewEl.innerHTML = slowTool ? renderingHtml : `<div class="asset-picker-loading">${t('Rendering…')}</div>`;
      // Crossing the threshold mid-render upgrades the plain loading text to the
      // animated button in place and flips the card to click-to-render from then on.
      const slowTimer = setTimeout(() => {
        if (seq !== renderSeq || slowTool) return;
        slowTool = true;
        previewEl.innerHTML = renderingHtml;
      }, SLOW_RENDER_MS);
      // The poster is always a still: the selected format when it's an image, else a
      // still stand-in for a motion pick (encoding the real clip per keystroke is too slow).
      const posterFmt = isMotion(fmtSel.value) ? stillFmt : fmtSel.value;
      const ref = await host.compose.renderUrl(url, { format: posterFmt as ExportFormat, ...size() }).catch(() => null);
      clearTimeout(slowTimer);
      if (seq !== renderSeq) return; // a newer change supersedes this render
      if (!ref) { previewEl.innerHTML = `<p class="asset-picker-error">${t("Couldn't render this link.")}</p>`; return; }
      posterRef = ref;
      const note = isMotion(fmtSel.value)
        ? `<p class="asset-picker-toolcard-note" style="margin:.4rem 0 0;font-size:.8rem;opacity:.7;">▶ ${t('Placed as a moving {format} - the clip renders when you add it.', { format: fmtSel.value.toUpperCase() })}</p>`
        : '';
      previewEl.innerHTML = `<img class="asset-picker-toolcard-img" src="${escapeHtml(ref.url)}" alt="${escapeHtml(tRaw('Preview of the {name} render', { name: desc.name }))}">${note}`;
      useBtn.disabled = false;
    };

    // Idle click-to-render state (slow tools only). Entering it also invalidates
    // any in-flight render - the controls just changed, so its poster is stale.
    const showRenderButton = (): void => {
      renderSeq++;
      posterRef = null;
      useBtn.disabled = true;
      previewEl.innerHTML = `<button type="button" class="tc-render">${t('Render preview')}</button>`;
      previewEl.querySelector('.tc-render')!.addEventListener('click', () => { void renderPreview(); });
    };

    // Resolve the picker with the committed ref - frozen (baked into a static
    // data: asset that never live-re-renders and consumes no nesting depth) when
    // the toggle is on. A render the engine refuses to bake (too large / not
    // self-contained) is placed LIVE instead, with a brief inline note so the
    // fallback is visible before the picker closes.
    // In collect mode a committed render is ADDED to the folder (dialog stays open, back
    // to the list + toast); in slot mode it resolves the picker.
    const deliver = (ref: AssetRef): void => {
      if (!collect) { close(ref); return; }
      void collect.onAsset(ref).then(res => { dismissTakeover(); collectToast(res); });
    };
    const finish = (ref: AssetRef): void => {
      if (!freezeEl.checked) { deliver(ref); return; }
      try { deliver(bakeAssetRef(ref)); }
      catch (e) {
        host.log?.('warn', `freeze failed (${(e as { code?: string }).code ?? (e as Error).message}) - placing live`);
        // Freeze the card while the note shows - a back/edit click here would
        // race the delayed commit below.
        cardEl.querySelectorAll<HTMLButtonElement>('button').forEach(b => { b.disabled = true; });
        previewEl.insertAdjacentHTML('beforeend',
          `<p class="asset-picker-toolcard-note" style="margin:.4rem 0 0;font-size:.8rem;opacity:.7;">${t('Placed live - this render is too large to freeze.')}</p>`);
        announce(t('Placed live - this render is too large to freeze.'));
        setTimeout(() => deliver(ref), 1500);
      }
    };

    // Commit: a still pick uses the already-rendered poster; a motion pick encodes the
    // real clip now (a few seconds) before resolving the picker.
    const commit = async (): Promise<void> => {
      const fmt = fmtSel.value;
      if (!isMotion(fmt)) { if (posterRef) finish(posterRef); return; }
      const label = useBtn.textContent;
      useBtn.disabled = true;
      useBtn.classList.add('is-rendering');
      useBtn.textContent = t('Rendering motion…');
      const ref = await host.compose.renderUrl(url, { format: fmt as ExportFormat, ...size() }).catch(() => null);
      useBtn.classList.remove('is-rendering');
      if (ref) { finish(ref); return; }
      useBtn.textContent = label;
      useBtn.disabled = false;
      previewEl.innerHTML = `<p class="asset-picker-error">${t("Couldn't render the motion clip.")}</p>`;
    };

    let debounce: ReturnType<typeof setTimeout> | undefined;
    const onSize = (): void => {
      clearTimeout(debounce);
      if (slowTool) { showRenderButton(); return; }
      debounce = setTimeout(renderPreview, 350);
    };
    fmtSel.addEventListener('change', () => { if (slowTool) showRenderButton(); else void renderPreview(); });
    wEl.addEventListener('input', onSize);
    hEl.addEventListener('input', onSize);
    useBtn.addEventListener('click', commit);
    renderPreview();
  }

  // A pasted URL that points STRAIGHT AT AN IMAGE FILE (…/logo.png, …/photo.svg,
  // a data: URI) becomes the asset itself - fetched, ingested through
  // storeUserUpload (same validation/provenance as an upload), and picked
  // (Andy, 2026-08-28: asset inputs accept URLs, not only files). Best-effort:
  // whether the fetch SUCCEEDS is platform policy (the web CSP admits self +
  // data: and refuses arbitrary origins; Tauri admits more), and any failure
  // returns false so the page-capture / can't-open fallback keeps its turn.
  async function tryDirectUrlAsset(url: string): Promise<boolean> {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) return false;
      const blob = await res.blob();
      const mime = (blob.type || '').toLowerCase();
      if (!(mime.startsWith('image/'))) return false;   // pages and non-images → capture fallback
      const base = /^data:/i.test(url) ? `pasted-${Date.now()}` : (url.split('/').pop()?.split(/[?#]/)[0] || `url-${Date.now()}`);
      const name = /\.[a-z0-9]{2,5}$/i.test(base) ? base : `${base}.${mime === 'image/svg+xml' ? 'svg' : mime.slice(6).replace('jpeg', 'jpg')}`;
      const file = new File([blob], name, { type: blob.type || 'image/png' });
      const ref = await storeUserUpload(host, file, { sourceHint: 'url' });
      if (collect) { dismissTakeover(); collectToast(await collect.onAsset(ref)); return true; }
      close(ref);
      return true;
    } catch { return false; }
  }

  // A pasted https URL that ISN'T a Lolly link. Where the shell can capture pages
  // (extension / Tauri) and a raster screenshot would serve this slot, offer to
  // screenshot it; on a Chromium browser WITHOUT capture, point at the extension
  // (the same install affordance the capture tools use); otherwise keep the plain
  // "can't open" message.
  function showUrlFallback(url: string): void {
    if (canCaptureUrl) { showUrlCaptureCard(url); return; }
    const offerExtension = captureCouldServe && isChromium();
    showTakeover(`
      <p class="asset-picker-empty">${t("That isn't a Lolly tool link this app can open.")}${offerExtension
        ? `<br>${t('Add the free Lolly screenshot extension and any web page can drop in here as an image - install it, then reload.')}`
        : ''}</p>
      ${offerExtension ? `<div class="asset-picker-toolcard-actions" style="justify-content:center">
        ${/* nosemgrep: lolly-href-escape-is-not-scheme-validation - docsAppHref() returns a build-time `#/docs/…` route from a literal slug */ ''}
        <a class="tc-back" href="${escapeHtml(docsAppHref('create/extension'))}" target="_blank" rel="noopener">${t('Get the extension')}</a>
      </div>` : ''}`);
  }

  // The "Screenshot this page" card. The capture bridge does the real work (extension
  // DevTools / Tauri webview); the shot is stored through storeUserUpload - the same
  // ingest as an upload/webcam frame, so it lands in "Your images" with identical
  // metadata/provenance handling - then fills the slot (or the collect folder).
  function showUrlCaptureCard(url: string): void {
    showTakeover(`
      <div class="asset-picker-toolcard">
        <div class="asset-picker-toolcard-head">
          <button type="button" class="asset-picker-toolcard-back" aria-label="${escapeHtml(t('Back to list'))}">←</button>
          ${icon('monitor', { size: 16 })}
          <span>${t('Not a Lolly link - screenshot this page as your image?')}</span>
        </div>
        <p class="asset-picker-capture-url">${escapeHtml(url)}</p>
        <p class="asset-picker-error cap-error" hidden></p>
        <div class="asset-picker-toolcard-actions">
          <button type="button" class="tc-use cap-shoot">${t('Screenshot this page')}</button>
        </div>
      </div>`);
    toolcardHost.querySelector('.asset-picker-toolcard-back')?.addEventListener('click', dismissTakeover);
    const goBtn = toolcardHost.querySelector<HTMLButtonElement>('.cap-shoot')!;
    const errEl = toolcardHost.querySelector<HTMLElement>('.cap-error')!;
    goBtn.addEventListener('click', async () => {
      goBtn.disabled = true;
      goBtn.classList.add('is-rendering');
      goBtn.textContent = t('Capturing page…');
      errEl.hidden = true;
      try {
        // Viewport-shaped (the url-shot default) - the slot's true box isn't known here.
        const shot = await host.capture!.page({ url, width: 1280, height: 800 });
        const blob = await (await fetch(shot.url)).blob();
        const file = new File([blob], `screenshot-${Date.now()}.png`, { type: blob.type || 'image/png' });
        const ref = await storeUserUpload(host, file);
        if (collect) { dismissTakeover(); collectToast(await collect.onAsset(ref)); return; }
        close(ref);
      } catch (e) {
        host.log('error', 'URL screenshot failed', { url, error: String(e) });
        goBtn.disabled = false;
        goBtn.classList.remove('is-rendering');
        goBtn.textContent = t('Screenshot this page');
        errEl.textContent = tRaw('Couldn’t capture that page: {message}', { message: (e as Error).message });
        errEl.hidden = false;
      }
    });
  }

  // Open a saved single-tool session as an image: reconstruct its canonical embed
  // URL from the stored values (the same createRuntime → serializeUrlState → buildEmbedUrl
  // recipe the in-place editor uses) and hand it to the render card. Pre-configured,
  // so it goes straight to preview/size - with an Edit-inputs escape hatch.
  async function embedSession(slot: string): Promise<void> {
    const entry = (sessions ?? []).find(s => s.slot === slot);
    if (!entry) return;
    showTakeover(`<div class="asset-picker-loading">${t('Opening “{name}”…', { name: entry.toolName })}</div>`);
    try {
      const data = await host.state.load(slot);
      if (!data) throw new Error('empty session');
      const tool = await getTool(entry.toolId);
      const runtime = await createRuntime(tool, host, data as Record<string, InputValue>);
      // keepUserIds: this embed identity re-renders ON THIS DEVICE, where a user/
      // upload resolves - the pre-plan-171 behaviour. Off-device it degrades to the
      // same silent blank it always did (the id is device-local either way).
      const query = serializeUrlState(runtime.getModel(), { keepUserIds: true });
      const url = buildEmbedUrl({ toolId: entry.toolId, format: imageFormatSeed(data.__export_format), query });
      const desc = url ? await host.compose._describeUrl(url) : null;
      if (!url || !desc) throw new Error('not renderable');
      showToolCard(desc, url, { editUrl: url });
    } catch (e) {
      host.log('warn', 'Embed saved session failed', { slot, error: String(e) });
      showTakeover(`<p class="asset-picker-error">${t("Couldn't open this saved creation.")}</p><div class="asset-picker-toolcard-actions"><button type="button" class="tc-back">← ${t('Back')}</button></div>`);
      toolcardHost.querySelector('.tc-back')?.addEventListener('click', dismissTakeover);
    }
  }

  // Open a tool with default inputs. If the host gave us an input editor (top-level /
  // block asset slots do), configure it FIRST then insert; otherwise fall back to the
  // inline format/size render card on the tool's defaults.
  async function embedTool(toolId: string): Promise<void> {
    const tool = toolById.get(toolId);
    const url = buildEmbedUrl({ toolId, format: 'svg', query: '' });
    if (!url) return;
    if (opts.editTool) {
      const ref = await opts.editTool(url);
      if (ref) close(ref);
      return; // cancelled → stay on the Tools tab
    }
    showTakeover(`<div class="asset-picker-loading">${t('Opening {name}…', { name: tool?.name ?? toolId })}</div>`);
    const desc = await host.compose._describeUrl(url).catch(() => null);
    if (desc) showToolCard(desc, url, { editUrl: url });
    else {
      showTakeover(`<p class="asset-picker-error">${t("Couldn't open this tool.")}</p><div class="asset-picker-toolcard-actions"><button type="button" class="tc-back">← ${t('Back')}</button></div>`);
      toolcardHost.querySelector('.tc-back')?.addEventListener('click', dismissTakeover);
    }
  }

  // Load the user's saved images (filtered to the requested type) in parallel with
  // the library - they don't depend on each other.
  if (showUserAssets) {
    Promise.all([
      host.assets._listUserAssets(),
      foldersReady, // shared with the Projects tab; sets `folders`
      profileReady,
    ])
      .then(([list]) => {
        // An `image` slot accepts raster OR vector (SVG); every other type is exact.
        // An `image` slot whose caller declared `motion` (the tool has an onFrame
        // hook, so the live frame loop can PLAY a video through the effect - see
        // tool-inputs.ts) also accepts the user's video uploads. Lottie stays out
        // even then: the frame loop has no lottie lane, and a pick that can only
        // ever render "Could not read this image" is worse than absence.
        //
        // An UNTYPED pick used to accept everything, which tiled the engine-data
        // assets that share this rail as broken images: an installed font, and
        // since 1.73 an ICC profile - with a delete button that removed the bytes
        // behind the Colour Lab's back, leaving a registered gamut and picker tab
        // for a file that was gone. A caller that names a data type still gets it;
        // it is only "everything" that means "everything with a picture".
        // Fade-not-hide: a VISUAL-family slot keeps every visual upload (the
        // non-acceptable ones are dimmed by markIncompatibleTiles, not filtered
        // out), so "Your images" agrees with the broadened library. A non-visual
        // typed slot keeps its exact-type filter; untyped keeps isPlaceableAsset.
        const keepUpload = (t: string): boolean => visualSlot
          ? VISUAL_TYPES.has(t)
          : (opts.type ? isAcceptable(t) : isPlaceableAsset({ type: t }));
        userAssets = list.filter(a => keepUpload(a.type)).filter(a => !hiddenSet.has(assetBaseId(a.id)));
        renderUserAssets();
        markIncompatibleTiles();
        renderFavourites();
        // Images just arrived - refresh Projects so folder item tiles + counts fill in.
        if (activeTab === 'projects') renderProjects(searchInput.value.trim().toLowerCase());
      })
      .catch(e => host.log('warn', 'Failed to list user images', { error: String(e) }));
  }

  // The folder tree may resolve before (or without) the user-image / session lists;
  // paint the Projects tab as soon as it's ready so folders show without waiting.
  foldersReady.then(() => {
    if (activeTab === 'projects') renderProjects(searchInput.value.trim().toLowerCase());
  });

  // Load saved sessions in parallel too (only when composing is possible). Restrict
  // to single-tool sessions whose tool still ships AND can render an image.
  if (allowToolUrl) {
    host.state.list()
      .then(list => {
        sessions = (list ?? [])
          .filter(e => e.slot && !e.slot.startsWith('__batch__:') && !isHiddenSlot(e.slot)) // single-tool, not trashed
          // Collect mode files the SESSION itself (kept editable), so any single-tool
          // session whose tool still ships qualifies - it needn't render to an image.
          .filter(e => e.toolId && (collect ? toolById.has(e.toolId) : isEmbeddable(toolById.get(e.toolId), needsSvg)))
          .map(e => {
            const t = toolById.get(e.toolId);
            return {
              slot: e.slot, toolId: e.toolId, label: e.label,
              toolName: t?.name ?? e.toolId, toolIcon: t?.icon ?? null,
              thumb: e.thumb ?? null, updatedAt: e.updatedAt,
            };
          })
          .sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')));
        const q = searchInput.value.trim().toLowerCase();
        if (activeTab === 'sessions') renderSessions(q);
        else if (activeTab === 'projects') renderProjects(q); // session tiles + counts fill in
      })
      .catch(e => {
        host.log('warn', 'Failed to list saved sessions', { error: String(e) });
        sessions = [];
        if (activeTab === 'sessions') renderSessions('');
        else if (activeTab === 'projects') renderProjects(searchInput.value.trim().toLowerCase());
      });
  }

  try {
    // Only visual assets are pickable images - palette / tokens / font entries are
    // engine data (JSON), never something a user places in a slot, so keep them out
    // of the library (a `type`-scoped pick already excludes them; this covers `any`).
    // Lottie counts as visual: it thumbnails as a static poster and plays live once
    // placed. It only surfaces for untyped/`any`/`lottie` picks - an `image` slot is
    // already narrowed to raster/vector upstream by query()'s typeMatches().
    // …with ONE exception: an explicit `type: 'audio'` pick (Sequence Studio's music
    // bed) is asking for the catalog's audio assets by name, so widen the set for
    // exactly that request. query()'s typeMatches has already narrowed the result to
    // `audio`, and this stays keyed on opts.type - an untyped / `any` / `image` pick
    // is unchanged, so audio never leaks into a slot that didn't ask for it. (The
    // user-uploads path filters too - see its own typeOk, which for an untyped
    // pick asks the same lib/asset-kinds.ts question.)
    // opts widens AssetPickerOpts with a web-only `type: 'image'` value; query only
    // reads the catalog-facing AssetQuery fields, so narrow at the boundary.
    // For a TYPED slot, TRUST query() - its typeMatches already narrowed to exactly
    // the acceptable types (incl. image→+video when opts.motion, and audio/text/data
    // for those slots). Re-filtering through VISUAL_TYPES here is what used to drop
    // catalog video from motion slots and empty out text/data picks (plans/162). The
    // VISUAL_TYPES guard stays only for an UNTYPED / `any` pick, to keep engine-data
    // (fonts/ICC/tokens) and audio out of a "pick anything with a picture" slot -
    // a documented behaviour (unchanged).
    // Fade-not-hide (plans/162): a VISUAL-family slot fetches the WHOLE visual
    // catalog (drop the type narrowing) so incompatible items are present to dim;
    // a non-visual TYPED slot (audio/text/data) still trusts query()'s narrowing;
    // an untyped `any` pick keeps the VISUAL_TYPES guard as before.
    const queryOpts = visualSlot ? ({ ...opts, type: undefined } as AssetPickerOpts) : (opts as AssetPickerOpts);
    const raw = await host.assets.query(queryOpts);
    const queried = (visualSlot || !opts.type) ? raw.filter(a => VISUAL_TYPES.has(a.type)) : raw;
    // Drop the user's hidden assets before anything renders (profileReady populates
    // hiddenSet; it's fast and usually already resolved by the time the query lands).
    await profileReady;
    const candidates = queried.filter(a => !hiddenSet.has(assetBaseId(a.id)));
    libraryCandidates = candidates;
    candidateById = new Map(candidates.map((c): [string, AssetRef] => [c.id, c]));
    libraryLoaded = true;

    // Colour pairings for themable icons - only worth mounting when this
    // library actually contains some and the bridge can supply pairings.
    if (candidates.some(isThemableRef) && typeof host.assets._iconThemes === 'function') {
      iconThemes = await host.assets._iconThemes().catch(() => []);
      if (activeTheme && !iconThemes.some(t => t.id === activeTheme)) activeTheme = null;
      // renderLibrary renders the strip inside the Icons group when iconThemes.length > 1.
    }

    // Colour treatments for raster photos - mounted only when this library holds
    // some and the bridge can supply them (same discipline as icon themes).
    if (candidates.some(isTreatableRef) && typeof host.assets._photoTreatments === 'function') {
      photoTreatments = await host.assets._photoTreatments().catch(() => []);
      if (activeTreatment && !photoTreatments.some(t => t.id === activeTreatment)) activeTreatment = null;
    }

    renderTypebar();
    renderLibrary(typeFiltered(candidates));
    renderFavourites();

    // Bring the current asset into view - but NEVER steal the caret (2026-08-20
    // audit): the search field starts focused (trapFocus's initialFocus) and
    // ArrowDown already drops into the grid, so yanking focus onto a card here
    // lost mid-type keystrokes. Only land focus on a card when the user isn't in
    // the search field. Library pane only - collect mode landed focus on Tools.
    if (activeTab === 'library') {
      const libCards = [...libraryEl.querySelectorAll<HTMLElement>('[data-asset-id]')];
      const target = libCards.find(c => c.dataset.assetId === currentBaseId) || libCards[0];
      if (searchInput && document.activeElement === searchInput) {
        try { target?.scrollIntoView({ block: 'nearest' }); } catch { /* jsdom: scrollIntoView unimplemented */ }
      } else {
        target?.focus({ preventScroll: true });
      }
    }

    // A Lolly tool URL pasted into the search box flips the picker into a "render
    // this tool" card; anything else filters the active pane. The seq guard drops a
    // stale describeUrl (async tool load) when the user keeps typing.
    let detectSeq = 0;
    let searchDebounce: ReturnType<typeof setTimeout>;
    searchInput?.addEventListener('input', async () => {
      const raw = searchInput.value.trim();
      if (allowToolUrl && /^https?:\/\//i.test(raw)) {
        const seq = ++detectSeq;
        showTakeover(`<div class="asset-picker-loading">${t('Checking link…')}</div>`);
        const desc = await host.compose._describeUrl(raw).catch(() => null);
        if (seq !== detectSeq) return; // superseded by a newer keystroke
        if (desc) { showToolCard(desc, raw, { editUrl: raw }); return; }
        // Not a Lolly link - maybe it's a direct image file (…/logo.png).
        if (await tryDirectUrlAsset(raw)) return;
        if (seq !== detectSeq) return; // the fetch attempt took a while - re-check
        showUrlFallback(raw);
        return;
      }
      detectSeq++; // invalidate any in-flight detection now that it's not a URL
      const q = raw.toLowerCase();
      // Resuming typing after a paste/embed takeover returns to the active pane - 
      // without stealing focus out of the search field (so don't go via setTab).
      if (!toolcardHost.hidden) {
        toolcardHost.hidden = true;
        toolcardHost.innerHTML = '';
        if (currentEl) currentEl.hidden = false;
        const pane = root.querySelector<HTMLElement>(`.asset-picker-pane[data-pane="${activeTab}"]`);
        if (pane) pane.hidden = false;
        setFooter(true);
      }
      // Debounce only the filter dispatch (rebuilds the whole pane DOM) so fast typing
      // doesn't rebuild per keystroke; the shared search debounce (lib/search/match.ts)
      // keeps this in step with every other search field. q is captured at schedule
      // time. The URL detection + pane-restore above stay immediate.
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        if (activeTab === 'library') restoreLibrary(q);
        else if (activeTab === 'uploads') renderUserAssets();
        else if (activeTab === 'sessions') renderSessions(q);
        else if (activeTab === 'projects') renderProjects(q);
        else if (activeTab === 'tools') renderTools(q);
        syncTabCounts(q);
      }, SEARCH_DEBOUNCE_MS);
    });
  } catch (e) {
    libraryEl.innerHTML = `<p class="asset-picker-error">${t('Failed to load: {message}', { message: (e as Error).message })}</p>`;
  }
}



// A muted, looping <video> thumbnail, PLAYED ONLY ON INTENT - hover/focus on a mouse, the
// most-centered tile on touch (lib/preview-media.ts owns that one policy; the
// refreshMotionThumbs arm wires this grid into it). It used to be
// `autoplay preload="metadata"` with no visibility gate at all, so opening the picker
// fetched a header for every clip in the library and played every one of them, on screen or
// not. Class-scoped CSS (.asset-picker-thumb / .cat-thumb) sizes <video> the same as <img>,
// so no per-element rule is needed.
function videoThumb(url: string, className: string): string {
  return motionVideoThumb(url, className);
}

// A looping Lottie thumbnail: an on-screen-gated player (autoplayLottieThumbs, wired by the
// picker) mounts over the still poster while the tile is on screen - the poster background, or
// a ▶ for a posterless user upload, is the resting frame. Returns null when no json url is
// resolvable, so the caller keeps its own stub. A library lottie's url is the poster and the
// json lives on meta.animationUrl; a user upload's url IS the json.
function lottieThumb(ref: AssetRef, className: string): string | null {
  const json = ref.source === 'user' ? ref.url : (typeof ref.meta?.animationUrl === 'string' ? ref.meta.animationUrl : '');
  if (!json) return null;
  const poster = ref.source !== 'user' && typeof ref.meta?.posterUrl === 'string' ? ref.meta.posterUrl : '';
  const style = poster ? ` style="background-image:url('${escapeHtml(poster)}')"` : '';
  return `<span class="${className} asset-picker-thumb-motion" data-lottie-src="${escapeHtml(json)}" data-lottie-fit="contain"${style} aria-hidden="true">${poster ? '' : '▶'}</span>`;
}

// An audio thumbnail: the honest glyph now, a REAL waveform once peaks exist.
//
// An <img src="…mp3"> can never load, so every audio tile used to render the broken-image
// icon - and in the lolly-start profile that is 20 of 23 assets, i.e. nearly the whole
// picker. What ships in the markup is `audioThumbPlaceholder` (a glyph, never a fabricated
// waveform); `mountAudioThumbs` swaps in `audioThumbSvg` drawn from measured peaks when
// they arrive. The shape is derived from the asset id so a given track always looks the
// same and a grid of 52 doesn't read as 52 identical tiles - the id picks the FORM only,
// never the data.
//
// The wrapper span carries the id (the observer's handle) and reuses
// .asset-picker-thumb-motion, whose `> svg { width:100%; height:100% }` rule already sizes
// an inline SVG into the 100px thumb box - the same job it does for a Lottie player.
function audioThumb(ref: AssetRef, className: string): string {
  const label = String(ref.meta?.name ?? ref.id);
  return `<span class="${className} asset-picker-thumb-motion asset-picker-thumb-audio" data-audio-thumb="${escapeHtml(ref.id)}" data-audio-fp="${escapeHtml(peaksFingerprint(ref))}">`
    + audioThumbPlaceholder({ label })
    + `</span>`;
}

/**
 * Upgrade every `[data-audio-thumb]` tile under `root` to a real waveform, decoding only
 * what the user actually looks at.
 *
 * Two gates, because decoding is the expensive part and a catalog holds 52 tracks:
 *   - ON SCREEN - an IntersectionObserver, like autoplayLottieThumbs. This is the gate
 *     audio-peaks CANNOT provide: its own queue, once a tile has asked, will eventually
 *     decode everything asked for, so a fast scroll past 52 tiles would still decode 52
 *     songs - just later. Leaving the viewport pulls a tile back OUT of the queue.
 *   - BOUNDED PARALLELISM - MAX_CONCURRENT_DERIVES workers drain that queue, matching
 *     audio-peaks' own ceiling so a grid fills in visibly without ever holding more than
 *     that many decoded files. Cached peaks skip the queue entirely - no decode, nothing
 *     to bound.
 *
 * `destroy()` is mandatory before a re-render or on close: it disconnects the observer and
 * flips `live`, so a decode still in flight resolves into nothing instead of painting into
 * a torn-down grid.
 *
 * Exported because the catalog grid needs exactly this behaviour, and it already pulls this
 * module in (lib/upload-dropzone.ts imports storeUserUpload from here), so sharing it costs
 * no extra chunk - whereas a second copy would be a second thing to keep correct.
 */
export function mountAudioThumbs(
  root: Element,
  host: unknown,
  lookup: (id: string) => AssetRef | undefined,
  isCurrent: () => boolean,
): { destroy(): void } {
  let live = true;
  const queue: HTMLElement[] = [];
  const done = new WeakSet<HTMLElement>();
  let workers = 0;

  // The brand's colour pool, resolved ONCE per mount and shared by every tile - a
  // per-tile resolve would re-read the tokens doc dozens of times for one grid. Starts
  // empty so the first paints are simply uncoloured (inheriting currentColor, exactly
  // as before) rather than deferred; the fill lands well within a scroll.
  let pool: string[] = [];
  let covers: Map<string, AudioCover> = new Map();
  /** Tiles this mount has already painted, so a late palette can colour them instead of
   *  leaving the grid half grey. Weak refs: a tile dropped by a re-render must not be
   *  held alive by this list. */
  const painted = new Set<WeakRef<HTMLElement>>();

  const repaintPainted = (): void => {
    for (const ref of painted) {
      const el = ref.deref();
      if (!el?.isConnected) { painted.delete(ref); continue; }
      const id = el.dataset.audioThumb ?? '';
      const p = id ? memoPeaks(id) : null;
      if (p) paint(el, p);
    }
  };

  /** Which tile surface we are actually on, MEASURED rather than named - the theme
   *  attribute has three values and a `brand` theme can be either. */
  const measuredTheme = (): ThumbTheme => {
    try {
      const bg = getComputedStyle(root as Element).backgroundColor
        || getComputedStyle(document.body).backgroundColor;
      const m = /rgba?\(([^)]+)\)/.exec(bg);
      if (m) {
        const [r, g, b] = m[1]!.split(',').map(v => Number.parseFloat(v));
        if (Number.isFinite(r!) && Number.isFinite(g!) && Number.isFinite(b!)) {
          // Rec.601 luma is ample for a light/dark decision.
          return (0.299 * r! + 0.587 * g! + 0.114 * b!) < 128 ? 'dark' : 'light';
        }
      }
    } catch { /* fall through to the attribute */ }
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  };

  void (async () => {
    // The pool is theme-dependent: a colour is judged against the surface it will
    // actually sit on, so the light and dark pools legitimately differ.
    // The app has THREE themes - light, dark and `brand` - so `=== 'dark'` was wrong: it
    // classified a brand theme (usually dark) as light, then chose colours legible on
    // WHITE, i.e. near-black maroons on a dark tile. Measure the real surface instead of
    // inferring it from a name; a future theme then needs no change here.
    const theme = measuredTheme();
    // `host` is `unknown` here on purpose - this helper is called from three views with
    // three different host shapes. Both callees take a narrow structural slice and
    // feature-detect what they read, so the assertion asserts nothing they do not check.
    const h = host as Parameters<typeof livePalette>[0] & Parameters<typeof audioThumbPool>[1];
    try { pool = audioThumbPool(await livePalette(h), h, theme); } catch { pool = []; }
    try { covers = loadAudioCovers(await (h as { profile?: { get(): Promise<unknown> } }).profile?.get() as never); } catch { covers = new Map(); }
    // The pool arrives AFTER the first tiles have painted, and a tile painted without it
    // silently inherits `--muted-foreground` - the grey tiles sitting among coloured ones.
    // Repaint what already landed rather than leaving a half-coloured grid.
    repaintPainted();
  })();

  const paint = (el: HTMLElement, peaks: Float32Array | number[]): void => {
    if (!live || !isCurrent() || !el.isConnected) return;
    const id = el.dataset.audioThumb ?? '';
    // Colour is the SECOND identity axis: shape alone gives five looks, and catalog
    // music is loudness-maximised enough that two same-shape tiles read alike at 100px.
    // An empty pool (no brand colours, or none legible here) just means no ink.
    // ONE read path: a user's cover wins, the generated look renders everywhere else.
    // `covers` is empty unless the profile carries overrides, so the overwhelmingly
    // common case is untouched.
    const look = resolveAudioLook(id, pool, covers);
    if (look.ink) el.style.setProperty('--audio-thumb-ink', look.ink.hex);
    // A MilkDrop cover is the one look that cannot be drawn here - it needs a GL context
    // and a grid cannot hold one per tile. Its BAKE is fetched instead; until that lands
    // (or if it never does - no WebGL2, an evicted cache, a fresh device) the tile shows
    // the asset's generated waveform, which is a real cover rather than a blank box.
    el.innerHTML = audioThumbSvg(peaks, {
      shape: look.shape,
      label: String(lookup(id)?.meta?.name ?? id),
    });
    painted.add(new WeakRef(el));
    if (look.viz) void paintBakedCover(el, id, look.viz);
  };

  /** Swap in a MilkDrop cover's baked image, if one has been rendered for this asset,
   *  preset and brand. A pure cache read - never renders, so a grid can never trigger a
   *  GL mount. Missing simply means the waveform underneath stays. */
  const paintBakedCover = async (el: HTMLElement, id: string, presetId: string): Promise<void> => {
    try {
      const { cachedBake, bakeKey, brandKeyFor } = await import('../lib/audio-cover-bake.ts');
      const blob = await cachedBake(bakeKey(id, presetId, brandKeyFor(pool)));
      if (!blob || !live || !isCurrent() || !el.isConnected) return;
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.alt = '';
      img.decoding = 'async';
      img.className = 'audio-cover-baked';
      // Revoke on load AND on error: an object URL leaked per tile adds up across a grid
      // the user scrolls through repeatedly.
      img.onload = img.onerror = () => URL.revokeObjectURL(url);
      img.src = url;
      el.replaceChildren(img);
    } catch { /* no bake, no change - the waveform stands */ }
  };

  const drain = async (): Promise<void> => {
    if (workers >= MAX_CONCURRENT_DERIVES) return;
    workers++;
    try {
      while (live) {
        // Take from the back: the tile the user has just scrolled to matters more than one
        // they passed on the way there.
        const el = queue.pop();
        if (!el) break;
        if (!el.isConnected || done.has(el)) continue;
        const id = el.dataset.audioThumb;
        const ref = id ? lookup(id) : undefined;
        if (!id || !ref) continue;
        done.add(el);
        try {
          const res = await derivePeaks(host, ref, id);
          if (res) paint(el, res.peaks);
        } catch { /* no peaks: the honest glyph stays, which is the correct answer */ }
      }
    } finally {
      workers--;
    }
  };

  const consider = (el: HTMLElement): void => {
    if (done.has(el)) return;
    const id = el.dataset.audioThumb;
    if (!id) return;
    void cachedPeaks(id, el.dataset.audioFp ?? '').then((hit) => {
      if (!live || done.has(el)) return;
      if (hit) { done.add(el); paint(el, hit.peaks); return; }
      if (!queue.includes(el)) queue.push(el);
      void drain();
    }).catch(() => { /* a stored-peaks read failure just means "derive it" */ });
  };

  const els = Array.from(root.querySelectorAll<HTMLElement>('[data-audio-thumb]'));
  if (typeof IntersectionObserver !== 'function') {
    // No observer (jsdom, ancient browsers): still never decode a whole grid - read the
    // cache for every tile, but leave uncached ones on the glyph rather than eagerly
    // decoding 52 songs nobody asked for.
    for (const el of els) {
      const id = el.dataset.audioThumb;
      if (!id) continue;
      void cachedPeaks(id, el.dataset.audioFp ?? '').then((hit) => { if (hit && live) { done.add(el); paint(el, hit.peaks); } }).catch(() => {});
    }
    return { destroy() { live = false; } };
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const el = e.target as HTMLElement;
      if (e.isIntersecting) consider(el);
      else {
        const i = queue.indexOf(el);
        if (i >= 0) queue.splice(i, 1);   // scrolled away before its turn - don't decode it
      }
    }
  }, { rootMargin: '200px' });
  for (const el of els) io.observe(el);
  return {
    destroy() {
      live = false;
      queue.length = 0;
      io.disconnect();
    },
  };
}

// The hover/focus-revealed "Upscale" affordance for a still-raster card - a SIBLING
// of the pick button (never nested; nested buttons are invalid HTML and break the
// delegated click handler, same reasoning as the user card's delete button), carrying
// data-upscale-id for the body delegation. Empty string for anything that shouldn't
// offer it: the host has no on-device upscaler (upscaleEnabled), or the ref isn't a
// still raster - vector/video/lottie/audio, or an animated raster (gif/apng/animated
// webp) whose motion a single-frame upscale would silently flatten.
function upscaleButton(ref: AssetRef, name: string): string {
  if (!upscaleEnabled || ref.type !== 'raster' || ref.meta?.animated) return '';
  return `<button type="button" class="asset-picker-card-upscale" data-upscale-id="${escapeHtml(ref.id)}" title="${escapeHtml(t('Upscale'))}" aria-label="${escapeHtml(tRaw('Upscale {name}', { name }))}">${icon('aiSpark', { size: 14 })}</button>`;
}

// The hover/focus-revealed "Remove background" affordance - same rules as
// upscaleButton (a sibling, still-raster only, hidden for animated rasters whose
// per-frame alpha a single cut-out can't represent), gated on a staged matte model.
function matteButton(ref: AssetRef, name: string): string {
  if (!matteEnabled || ref.type !== 'raster' || ref.meta?.animated) return '';
  return `<button type="button" class="asset-picker-card-matte" data-matte-id="${escapeHtml(ref.id)}" title="${escapeHtml(t('Remove background'))}" aria-label="${escapeHtml(tRaw('Remove background from {name}', { name }))}">${icon('scissors', { size: 14 })}</button>`;
}

// The VIDEO sibling of matteButton (WP-G): a hover/focus-revealed "Remove background"
// on a VIDEO card that opens the shared video-job dialog (op 'matte') to make a
// transparent alternative asset on-device. Same escaped idiom and it reuses the
// .asset-picker-card-matte styling, so it adds no new raw-HTML sink and no new CSS.
// Gated on videoMatteEnabled (video decode + a staged matte model); a placeholder /
// dataless stub has no bytes to process, so it opts out.
function vidMatteButton(ref: AssetRef, name: string): string {
  if (!videoMatteEnabled || ref.type !== 'video' || ref.meta?._placeholder) return '';
  return `<button type="button" class="asset-picker-card-matte" data-vidmatte-id="${escapeHtml(ref.id)}" title="${escapeHtml(t('Remove background'))}" aria-label="${escapeHtml(tRaw('Remove background from {name}', { name }))}">${icon('scissors', { size: 14 })}</button>`;
}

// ── Recents (plans/134 P1) ───────────────────────────────────────────────────
// Most-recently PICKED asset base ids, device-local. Rendered as a pinned
// section above Favourites; recorded on every successful pick / collect add.
const RECENTS_KEY = 'lolly:recentAssets';
function readRecentAssets(): string[] {
  try { const v = JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []; }
  catch { return []; }
}
function recordRecentAsset(id: string): void {
  try {
    const base = assetBaseId(id);
    localStorage.setItem(RECENTS_KEY, JSON.stringify([base, ...readRecentAssets().filter(x => x !== base)].slice(0, 24)));
  } catch { /* storage off */ }
}
// Last-used tab per pick type (plans/134 P1) - a default, exactly like initialTab.
const TABMEM_KEY = 'lolly:pickerTab';
function readTabMemory(kind: string): string | null {
  try { return (JSON.parse(localStorage.getItem(TABMEM_KEY) || '{}') as Record<string, string>)[kind] ?? null; }
  catch { return null; }
}
function recordTabMemory(kind: string, tab: string): void {
  try {
    const m = JSON.parse(localStorage.getItem(TABMEM_KEY) || '{}') as Record<string, string>;
    m[kind] = tab;
    localStorage.setItem(TABMEM_KEY, JSON.stringify(m));
  } catch { /* storage off */ }
}

function card(ref: AssetRef): string {
  const isPlaceholder = ref.meta?._placeholder;
  const name = ref.meta?.name ?? ref.id;
  // A user-uploaded lottie's url is JSON (no still poster), so an <img> would 404 - show
  // a play glyph, matching userCard. (Catalog lotties resolve to a poster url upstream.)
  // A video plays itself in a muted looping <video>; audio draws its own waveform
  // (audioThumb - an <img> at an .mp3 is the broken-image icon); everything else is an
  // <img> (gif/apng/animated-webp animate natively there).
  const thumb = isPlaceholder
    ? `<div class="asset-picker-thumb asset-picker-thumb-stub">${escapeHtml(ref.type)}</div>`
    : ref.type === 'lottie'
      ? (lottieThumb(ref, 'asset-picker-thumb') ?? `<span class="asset-picker-thumb asset-picker-thumb-stub" aria-hidden="true">▶</span>`)
      : ref.type === 'video'
        ? videoThumb(ref.url, 'asset-picker-thumb')
        : ref.type === 'audio'
          ? audioThumb(ref, 'asset-picker-thumb')
          : `<img class="asset-picker-thumb" src="${escapeHtml(ref.url)}" alt="" loading="lazy" decoding="async">`;
  const upBtn = upscaleButton(ref, String(name));
  const cutBtn = matteButton(ref, String(name));
  const vidBtn = vidMatteButton(ref, String(name));
  // Audio audition (plans/134 P4): a ▶ sibling that previews without picking.
  const audBtn = ref.type === 'audio' && !isPlaceholder
    ? `<button type="button" class="asset-picker-audition" data-audition-src="${escapeHtml(ref.url)}" aria-pressed="false" aria-label="${escapeHtml(t('Play preview'))}" title="${escapeHtml(t('Play preview'))}">▶</button>`
    : '';
  // Dimensions on the tile (plans/134 P4) - captured at ingest, finally surfaced.
  const dims = ref.width && ref.height ? `${Math.round(+ref.width)}×${Math.round(+ref.height)}` : '';
  const tip = dims ? `${name} · ${dims} px` : String(name);
  const inner = `${thumb}
      <span class="asset-picker-name" title="${escapeHtml(tip)}">${escapeHtml(name)}</span>
      <span class="asset-picker-id">${escapeHtml(ref.id)}${dims ? ` <span class="asset-picker-dims">· ${escapeHtml(dims)}</span>` : ''}</span>`;
  // A raster library card splits into wrapper + pick button (mirroring the user card)
  // so the Upscale / Remove-background siblings are valid HTML; a video card does the
  // same for its Remove-background sibling (and an audio card for its audition ▶).
  // Everything with no action stays the exact single plain pick button it was before.
  if (!upBtn && !cutBtn && !vidBtn && !audBtn) {
    return `
    <button type="button" class="asset-picker-card" data-asset-id="${escapeHtml(ref.id)}" draggable="true">
      ${inner}
      ${formatBadge(ref)}
    </button>
  `;
  }
  return `
    <div class="asset-picker-card asset-picker-card-actionable">
      <button type="button" class="asset-picker-card-pick" data-asset-id="${escapeHtml(ref.id)}" draggable="true">
        ${inner}
      </button>
      ${upBtn}
      ${cutBtn}
      ${vidBtn}
      ${audBtn}
      ${formatBadge(ref)}
    </div>
  `;
}

// A tool the user can render to an image. Preview-forward like the gallery: show the
// tool's rendered preview thumbnail, falling back to its inline icon. The `preview` is
// a build artifact (catalog/previews/ - committed, but absent on a fresh checkout or
// after index drift) that can still 404 - so the icon is always rendered too, revealed
// by a capture-phase error handler (see render). The index ships the icon as trusted
// inline SVG (built from tools/<id>/icon.svg) - inlined so it themes via currentColor.
function toolCard(t: PickerTool, quickAdd = false): string {
  const hasPreview = Boolean(t.preview);
  // The preview slot is a fixed 84px-tall box (picker.css). A card.html banner renders in
  // a sandboxed iframe fitted to that height at the tool's aspect (so a square ad isn't
  // stretched to the tile width); svg/png stay <img> with the slot's object-fit.
  // Keep the slot's fixed 84px height (from the class) and derive width from the tool's
  // aspect, so an animated banner tile is the same height as its <img> neighbours.
  const iframeSize = (t.width && t.height)
    ? `aspect-ratio:${t.width} / ${t.height};width:auto;margin-inline:auto`
    : 'width:100%;height:100%';
  // A `<div>` wrapper (not a bare <button>) when the quick-add affordance is present:
  // the "+ Add" control is a SIBLING of the open-primary, never nested (nested buttons
  // are invalid HTML and break the delegated handler - same reasoning as userCard).
  const openBtn = `<button type="button" class="asset-picker-card asset-picker-toolitem${hasPreview ? '' : ' no-preview'}${quickAdd ? ' asset-picker-toolitem--collect' : ''}" data-tool-id="${escapeHtml(t.id)}" title="${escapeHtml(t.description ?? t.name)}">
      ${hasPreview ? previewMedia(t.preview!, 'asset-picker-toolitem-preview', iframeSize, false, t.anim) : ''}
      <span class="asset-picker-toolitem-icon" aria-hidden="true">${t.icon ?? ''}</span>
      <span class="asset-picker-name">${escapeHtml(t.name)}</span>
    </button>`;
  if (!quickAdd) return openBtn;
  return `<div class="asset-picker-toolcell">${openBtn}<button type="button" class="asset-picker-toolquick" data-quickadd-tool="${escapeHtml(t.id)}" title="${escapeHtml('Add to this folder with default settings - without opening the editor')}" aria-label="${escapeHtml(`Add ${t.name} to this folder without opening`)}">+ Add</button></div>`;
}

// A previous saved creation. Its thumbnail is a PNG data-URL (raster tools) or raw SVG
// markup (vector tools); SVG is rendered via a data-URL <img> so any embedded script in
// an imported session can't execute. No thumb → the tool's icon as a stub.
function sessionCard(s: PickerSession): string {
  const name = s.toolName ?? s.toolId;
  return `
    <button type="button" class="asset-picker-card asset-picker-sessitem" data-session-slot="${escapeHtml(s.slot)}" title="${escapeHtml(name)}">
      ${sessionThumb(s.thumb, s.toolIcon)}
      <span class="asset-picker-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
      <span class="asset-picker-sessitem-when">${escapeHtml(relTimeAt(s.updatedAt, Date.now(), t))}</span>
    </button>
  `;
}

// One encoding for every SVG-text-as-<img> use (session thumbs, themed icon
// thumbnails) so quirks fixes land in one place.
function svgDataUrl(svgText: string): string {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svgText);
}

function sessionThumb(thumb: string | null, iconSvg: string | null): string {
  if (typeof thumb === 'string' && thumb) {
    if (thumb.startsWith('data:')) {
      return `<img class="asset-picker-thumb" src="${escapeHtml(thumb)}" alt="" loading="lazy" decoding="async">`;
    }
    if (/^\s*<(\?xml|svg)/i.test(thumb)) {
      return `<img class="asset-picker-thumb" src="${escapeHtml(svgDataUrl(thumb))}" alt="" loading="lazy" decoding="async">`;
    }
  }
  return `<span class="asset-picker-thumb asset-picker-thumb-stub asset-picker-thumb-icon" aria-hidden="true">${iconSvg ?? ''}</span>`;
}

// m:ss for a clip length in milliseconds, rolling over to h:mm:ss past an hour (the
// audio cap allows a ~60-minute upload, and "62:30" reads as broken or as 62 seconds).
// Rounds to the nearest second - the badge has no room for sub-second precision, and
// neither ffprobe-style tools nor a user glancing at a thumbnail need it.
function fmtDur(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor(totalSec / 60) % 60;
  const s = totalSec % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

function formatBadge(ref: AssetRef): string {
  // Generative-AI provenance badge - a sparkle-circle top-left (the format badge owns
  // bottom-right). Authored on catalog entries; auto-detected on uploads via C2PA;
  // user-declared through the catalog's Origins control. When nothing is DECLARED
  // but the ingest analysis left signals, the "AI?" chip takes the same corner -
  // the risk belongs at the moment an ingredient is chosen (plans/126 WP-B).
  const ai = assetAiKind(ref);
  const aiBadge = ai ? genAiPill(ai, true) : aiSignalsChip(ref);
  // Playback length, shown in the same corner badge as the format - video, lottie
  // and audio only, and only when a duration actually resolved at ingest time.
  const durMs = typeof ref.meta?.durationMs === 'number' && Number.isFinite(ref.meta.durationMs) && ref.meta.durationMs > 0
    ? ref.meta.durationMs : undefined;
  const durSuffix = durMs != null ? ` · ${fmtDur(durMs)}` : '';
  // A lottie card thumbnails as its static poster - badge the motion, not the
  // misleading underlying file format.
  if (ref.type === 'lottie') return `<span class="asset-picker-fmt">▶ LOTTIE${durSuffix}</span>${aiBadge}`;
  // Video and animated rasters (gif/apng/animated-webp) get a play glyph so their
  // motion reads at a glance (a still preview frame can look identical to a photo).
  if (ref.type === 'video') return `<span class="asset-picker-fmt">▶ ${escapeHtml(String(ref.format ?? 'video').toUpperCase())}${durSuffix}</span>${aiBadge}`;
  if (ref.meta?.animated && ref.format) return `<span class="asset-picker-fmt">▶ ${escapeHtml(String(ref.format).toUpperCase())}${durSuffix}</span>${aiBadge}`;
  return (ref.format ? `<span class="asset-picker-fmt">${escapeHtml(String(ref.format).toUpperCase())}${durSuffix}</span>` : '') + aiBadge;
}

// A user image: a pick button plus a delete affordance (siblings, not nested - 
// nested buttons are invalid HTML and break the delegated click handler).
function userCard(ref: AssetRef): string {
  const name = ref.meta?.name ?? t('Image');
  // A user-uploaded lottie's url is the JSON itself, so it plays as a looping motion marker
  // (autoplayLottieThumbs mounts it on screen); the ▶ stub is only the pre-mount resting frame.
  // An uploaded track shows its measured waveform once mountAudioThumbs has peaks for it.
  const thumb = ref.type === 'lottie'
    ? (lottieThumb(ref, 'asset-picker-thumb') ?? `<span class="asset-picker-thumb asset-picker-thumb-stub" aria-hidden="true">▶</span>`)
    : ref.type === 'video'
      ? videoThumb(ref.url, 'asset-picker-thumb')
      : ref.type === 'audio'
        ? audioThumb(ref, 'asset-picker-thumb')
        : ref.type === 'text' || ref.type === 'data'
          ? (ref.type === 'text'
            ? `<span class="asset-picker-thumb asset-picker-thumb-stub" data-text-thumb="${escapeHtml(ref.id)}" aria-hidden="true">¶</span>`
            : `<span class="asset-picker-thumb asset-picker-thumb-stub" aria-hidden="true">▦</span>`)
          : `<img class="asset-picker-thumb" src="${escapeHtml(ref.url)}" alt="" loading="lazy" decoding="async">`;
  return `
    <div class="asset-picker-card asset-picker-card-user">
      <button type="button" class="asset-picker-card-pick" data-asset-id="${escapeHtml(ref.id)}" draggable="true">
        ${thumb}
        <span class="asset-picker-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
      </button>
      <button type="button" class="asset-picker-card-delete" data-delete-id="${escapeHtml(ref.id)}" title="${escapeHtml(t('Delete'))}" aria-label="${escapeHtml(tRaw('Delete {name}', { name: String(name) }))}">×</button>
      ${upscaleButton(ref, String(name))}
      ${matteButton(ref, String(name))}
      ${vidMatteButton(ref, String(name))}
      ${formatBadge(ref)}
    </div>
  `;
}

// Strip anything executable or external from an uploaded SVG before we persist
// it. DOMPurify's SVG profile removes <script>, on*= handlers, <foreignObject>
// scripts and external entity/resource refs while keeping the drawable markup.
// The result (even if empty for a non-SVG masquerading as one) is what we store,
// so script bytes never reach disk; we only keep the original as a last resort
// if DOMPurify itself is unavailable (it isn't in a browser).
/**
 * Make an uploaded SVG scale by its `viewBox`: strip the root `width`/`height` so it renders
 * at the display size (crisp at any zoom, in any container) instead of pinning a fixed
 * intrinsic size - an icon authored at `width="10.58"` was otherwise a ~11px bitmap that any
 * larger render just magnified. If there's no `viewBox` but numeric dimensions exist, we
 * synthesise one first so the art is never left sizeless (which collapses to the 300×150
 * default). An SVG with neither a viewBox nor derivable dimensions is returned untouched.
 * Returns the (best-effort) intrinsic aspect for the stored record's metadata.
 */
function normalizeSvg(svgText: string): { svg: string; width?: number; height?: number } {
  try {
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    const svg = doc.documentElement;
    if (!svg || svg.tagName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) return { svg: svgText };
    // Plain number, optionally with an absolute unit - rejects `%`, `calc()`, `em`, etc.
    const num = (v: string | null): number | null => {
      const m = v && /^\s*(-?[\d.]+)\s*(px|pt|pc|mm|cm|in|q)?\s*$/i.exec(v);
      return m ? parseFloat(m[1]!) : null;
    };
    let w = num(svg.getAttribute('width'));
    let h = num(svg.getAttribute('height'));
    const vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    const hasViewBox = vb.length === 4 && vb.every((n) => Number.isFinite(n));
    if (!hasViewBox) {
      if (w && h && w > 0 && h > 0) svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      else return { svg: svgText, width: w ?? undefined, height: h ?? undefined }; // can't make it scalable safely
    }
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    if (!(w && h) && hasViewBox) { w = vb[2]!; h = vb[3]!; } // fall back to the viewBox extent for metadata
    return { svg: new XMLSerializer().serializeToString(svg), width: w ?? undefined, height: h ?? undefined };
  } catch {
    return { svg: svgText };
  }
}

async function sanitizeSvgFile(file: Blob): Promise<{ blob: Blob; width?: number; height?: number }> {
  const SVG_MIME = 'image/svg+xml';
  let text = '';
  try {
    text = await file.text();
    // Sanitise to a DOM NODE, then serialise with XMLSerializer - NOT DOMPurify's own
    // string output. DOMPurify's default HTML serialiser turns a literal U+00A0
    // (non-breaking space, common in a tool-exported licence/caption line) into the HTML
    // named entity `&nbsp;`, which is undefined in XML; normalizeSvg's strict
    // `image/svg+xml` re-parse below then fails ("Entity 'nbsp' not defined") and the
    // whole SVG stores blank. XMLSerializer keeps U+00A0 a literal character, so the
    // markup stays well-formed XML. (Switching DOMPurify's parser to
    // application/xhtml+xml also avoids the entity, but its strict XML parse silently
    // drops content from some real SVGs - measured: it blanked a clip-path-heavy colour
    // atlas - so the DOM+XMLSerializer round-trip under the default HTML parser is the
    // combination that renders every file.)
    const dom = DOMPurify.sanitize(text, { USE_PROFILES: { svg: true, svgFilters: true }, RETURN_DOM: true }) as unknown as ParentNode;
    const svgEl = dom.querySelector('svg');
    const clean = svgEl ? new XMLSerializer().serializeToString(svgEl) : '';
    // DOMPurify can strip a document that isn't a real SVG down to nothing; storing that
    // empty result is a blank asset, so only take the sanitised output when it still has
    // an <svg> root, otherwise fall through to the raw text below.
    if (/<svg[\s>]/i.test(clean)) {
      const { svg, width, height } = normalizeSvg(clean);
      return { blob: new Blob([svg], { type: SVG_MIME }), width, height };
    }
  } catch { /* fall through */ }
  // Fallback for a valid SVG that DOMPurify threw on or emptied: re-wrap the ORIGINAL
  // text with the SVG mime so it still renders. The previous `return { blob: file }`
  // kept the source blob's blank/octet-stream mime - and an <img>/object-URL refuses to
  // render SVG bytes served as octet-stream, which left every such upload a broken image
  // (only the ones DOMPurify passed cleanly showed up). Scripts in an SVG are inert under
  // <img>, which is how assets render, so the un-sanitised fallback is no worse than the
  // blob it replaces - it just renders.
  const raw = text || await file.text().catch(() => '');
  if (/<svg[\s>]/i.test(raw)) {
    const { svg, width, height } = normalizeSvg(raw);
    return { blob: new Blob([svg], { type: SVG_MIME }), width, height };
  }
  return { blob: file }; // genuinely not an SVG - hand back the bytes untouched
}

/**
 * Webcam capture → Promise<AssetRef | null>.
 *
 * A live <video> preview of the user's camera with a Capture button; the captured
 * frame becomes a raster user asset via the SAME storeUserUpload path as an upload
 * (downscale + on-device store), so the rest of the app treats it identically. This
 * is a pure shell affordance - no engine/bridge/runtime involvement - which is why
 * "webcam as a still image" needs no architectural change. The camera stream is torn
 * down on every exit path (capture, cancel, Escape, backdrop, error) so no track
 * outlives the dialog. Pixels never leave the device.
 */
function openWebcamCapture(host: PickerHost): Promise<AssetRef | null> {
  return new Promise((resolve) => {
    let stream: MediaStream | null = null;
    let trap: FocusTrap | undefined;
    const overlay = document.createElement('div');
    overlay.className = 'webcam-capture-overlay';
    overlay.innerHTML = `
      <div class="webcam-capture-backdrop" aria-hidden="true"></div>
      <div class="webcam-capture-panel" role="dialog" aria-modal="true" aria-label="${escapeHtml(t('Take a photo'))}">
        <header class="webcam-capture-head">
          <span>${t('Take a photo')}</span>
          <button type="button" class="webcam-capture-close" aria-label="${escapeHtml(t('Close'))}">&times;</button>
        </header>
        <div class="webcam-capture-stage">
          <video class="webcam-capture-video" autoplay playsinline muted></video>
          <div class="webcam-capture-status">${t('Starting camera…')}</div>
        </div>
        <footer class="webcam-capture-actions">
          <button type="button" class="webcam-capture-cancel">${t('Cancel')}</button>
          <button type="button" class="webcam-capture-shoot" disabled>${t('Capture')}</button>
        </footer>
      </div>`;
    document.body.appendChild(overlay);

    const videoEl  = overlay.querySelector<HTMLVideoElement>('.webcam-capture-video')!;
    const statusEl = overlay.querySelector<HTMLElement>('.webcam-capture-status')!;
    const shootBtn = overlay.querySelector<HTMLButtonElement>('.webcam-capture-shoot')!;
    const opener   = document.activeElement;

    const cleanup = (): void => {
      trap?.release();
      if (stream) stream.getTracks().forEach(t => { try { t.stop(); } catch { /* already stopped */ } });
      stream = null;
      document.removeEventListener('keydown', onKey);
      NAV_EVENTS.forEach(ev => window.removeEventListener(ev, onNav));
      overlay.remove();
      if (opener instanceof HTMLElement) opener.focus();
    };
    const done = (val: AssetRef | null): void => { cleanup(); resolve(val); };
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.preventDefault(); done(null); } };
    document.addEventListener('keydown', onKey);
    // A route change cancels the sheet like Escape/backdrop - camera torn down, the
    // trap's inert released (the picker beneath nav-closes on the same events).
    const onNav = (): void => done(null);
    NAV_EVENTS.forEach(ev => window.addEventListener(ev, onNav));
    overlay.querySelector('.webcam-capture-backdrop')?.addEventListener('click', () => done(null));
    overlay.querySelector('.webcam-capture-close')?.addEventListener('click', () => done(null));
    overlay.querySelector('.webcam-capture-cancel')?.addEventListener('click', () => done(null));
    // Contain focus over the (already-modal) picker; Escape is handled above. Nested
    // traps stack - this inerts the picker beneath while the camera sheet is open.
    trap = trapFocus(overlay, { initialFocus: overlay.querySelector<HTMLElement>('.webcam-capture-cancel') });

    const showError = (msg: string): void => {
      statusEl.hidden = false;
      statusEl.textContent = msg;
      statusEl.classList.add('webcam-capture-error');
    };

    shootBtn.addEventListener('click', async () => {
      const w = videoEl.videoWidth, h = videoEl.videoHeight;
      if (!w || !h) return;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')!.drawImage(videoEl, 0, 0, w, h);
      const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'));
      if (!blob) { showError(t('Couldn’t capture the frame.')); return; }
      const file = new File([blob], `webcam-${Date.now()}.png`, { type: 'image/png' });
      try {
        const ref = await storeUserUpload(host, file);
        done(ref);
      } catch (e) {
        host.log?.('error', 'Webcam capture store failed', { error: String(e) });
        showError(t('Couldn’t save the photo.'));
      }
    });

    // Kick off the camera; leave the dialog open on failure showing why.
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        videoEl.srcObject = stream;
        await videoEl.play().catch(() => {});
        statusEl.hidden = true;
        shootBtn.disabled = false;
        shootBtn.focus();
      } catch (e) {
        host.log?.('warn', 'Webcam start failed', { error: String(e) });
        showError((e as Error | null)?.name === 'NotAllowedError'
          ? t('Camera permission was declined. Allow camera access, then try again.')
          : t('Couldn’t start the camera on this device.'));
      }
    })();
  });
}

// A .lottie is a ZIP (dotLottie): manifest.json + animations/<id>.json (+ optional
// images/). lottie-web only understands raw Bodymovin JSON, so unzip, pull the first
// animation out, and inline any zip-embedded images as data URIs so the stored JSON is
// self-contained. fflate (the shell's zip lib) is dynamic-imported - only paid for when
// someone actually uploads a .lottie. Returns the animation JSON as text.
async function dotLottieToJson(file: File): Promise<string> {
  const strFromU8 = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);
  const budget = archiveBudgetFor(file);
  let entries: Record<string, Uint8Array>;
  try {
    entries = Object.fromEntries(readUploadZip(await readUploadArchiveBytes(file), budget).map(e => [e.name, e.bytes]));
  } catch {
    throw new Error(t('That .lottie file couldn’t be opened (not a valid dotLottie archive).'));
  }
  const names = Object.keys(entries);
  let animPath: string | undefined;
  if (entries['manifest.json']) {
    try {
      const manifest = JSON.parse(strFromU8(entries['manifest.json'])) as { animations?: Array<{ id?: string }> };
      const id = manifest.animations?.[0]?.id;
      if (id) animPath = names.find(n => n === `animations/${id}.json`) ?? names.find(n => n.endsWith(`/${id}.json`));
    } catch { /* fall through to a filename scan */ }
  }
  animPath ??= names.find(n => /^animations\/.+\.json$/i.test(n)) ?? names.find(n => /\.json$/i.test(n) && n !== 'manifest.json');
  if (!animPath) throw new Error(t('That .lottie file has no animation inside.'));
  const MAX_JSON_BYTES = 64 * 1024 * 1024;
  if (entries[animPath]!.length > MAX_JSON_BYTES) throw new Error(t('That animation exceeds the 64 MB JSON limit.'));
  const data = JSON.parse(strFromU8(entries[animPath]!)) as { assets?: Array<Record<string, unknown>> };
  let expandedSize = entries[animPath]!.length;
  // Inline embedded images (assets with e:0 that reference a file inside the zip) so
  // the animation renders once stored - otherwise those image refs would 404.
  if (Array.isArray(data.assets)) {
    if (data.assets.length > 1000) throw new Error(t('That animation has too many image references.'));
    for (const a of data.assets) {
      if (!a || typeof a.p !== 'string' || a.e === 1) continue;
      const dir = typeof a.u === 'string' ? a.u.replace(/^\//, '') : '';
      const bytes = entries[dir + a.p] ?? entries['images/' + a.p] ?? entries[a.p];
      if (!bytes) continue;
      const added = Math.ceil(bytes.length / 3) * 4 + 128;
      expandedSize += added;
      if (expandedSize > MAX_JSON_BYTES) throw new Error(t('That animation exceeds the 64 MB expanded JSON limit.'));
      if (added > budget.bytes) throw new Error(t('That animation has exhausted the archive expansion limit.'));
      budget.bytes -= added;
      const ext = a.p.toLowerCase();
      const mime = ext.endsWith('.png') ? 'image/png'
        : ext.endsWith('.svg') ? 'image/svg+xml'
        : /\.jpe?g$/.test(ext) ? 'image/jpeg'
        : ext.endsWith('.webp') ? 'image/webp'
        : ext.endsWith('.gif') ? 'image/gif' : 'application/octet-stream';
      a.u = '';
      a.p = `data:${mime};base64,${u8ToBase64(bytes)}`;
      a.e = 1;
    }
  }
  return JSON.stringify(data);
}

// Base64 a byte array in chunks - String.fromCharCode(...bigArray) overflows the call
// stack on large images, so feed it fixed-size slices.
function u8ToBase64(u8: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < u8.length; i += CHUNK) bin += String.fromCharCode(...u8.subarray(i, i + CHUNK));
  return btoa(bin);
}

// Verbatim uploads - animated rasters (gif/apng/animated-webp) and video - bypass
// downscaleRaster's implicit shrink (re-encoding would flatten the animation), so
// they need an EXPLICIT byte ceiling here or one large clip/gif could blow the
// IndexedDB quota. "Very small video" by design; a friendly error asks the user to
// trim/compress rather than letting the store throw QuotaExceededError mid-write.
const MAX_VIDEO_BYTES = 15 * 1024 * 1024;         // 15 MB
const MAX_ANIMATED_RASTER_BYTES = 20 * 1024 * 1024; // 20 MB
// Audio is stored verbatim too (no re-encode), so it needs its own ceiling. A little
// roomier than video - a few minutes of compressed music (opus/mp3/m4a) sits well
// under this; an uncompressed wav/flac can blow past it, and the friendly error asks
// the user to compress rather than the store throwing QuotaExceededError mid-write.
const MAX_AUDIO_BYTES = 30 * 1024 * 1024;         // 30 MB
const MAX_DATA_BYTES = 16 * 1024 * 1024;          // 16 MB - a spreadsheet/CSV data asset
// The most CHARACTERS the ingest-time AI-writing analysis reads. The full file is
// still stored verbatim; the cap only bounds the analysed slice, so a huge log or
// bundle can't stall the upload behind a synchronous scan.
const MAX_AI_SIGNAL_CHARS = 256 * 1024;
// Extensions the TEXT path claims (the classifier below + its format stamp). Source
// code and markup ride the same verbatim type:'text' path as .txt/.md - see the
// isText comment in storeUserUpload. .json (Lottie), .csv/.tsv (data) and .svg/.svgz
// (vector) are claimed earlier in the chain and stay off this list; '.ts' is here but
// yields to a real MPEG transport stream (the byte probe in storeUserUpload).
const TEXT_EXT_RE = /\.(txt|md|markdown|text|js|jsx|mjs|cjs|ts|tsx|py|rb|go|rs|java|c|h|hpp|cc|cpp|cs|swift|kt|kts|php|pl|lua|sql|r|scala|sh|bash|zsh|fish|yaml|yml|toml|ini|cfg|conf|css|scss|less|html|htm|xml|vue|svelte|astro)$/i;
// Credential preservation reads the ORIGINAL bytes whole (the only branch that
// does - rasters otherwise stream through createImageBitmap without a JS-heap
// copy). Skip the scan for outsized originals rather than buffer them: a real
// credentialed asset is nowhere near this, and preservation is best-effort.
const MAX_CREDENTIAL_SCAN_BYTES = 64 * 1024 * 1024; // 64 MB
// Only a genuinely HUGE raster - a heavy file, or well past 2× the resize target on its
// longest edge - prompts the keep/resize decision. A merely-large "good size" image is
// stored verbatim without asking (see storeUserUpload's raster branch).
const HUGE_UPLOAD_BYTES = 40 * 1024 * 1024;         // 40 MB

function assertVerbatimSize(file: File, max: number, kind: string): void {
  if (file.size > max) {
    throw Object.assign(
      new Error(tRaw('This {kind} is {size} MB - over the {max} MB limit. Trim or compress it and try again.', {
        kind, size: (file.size / 1e6).toFixed(1), max: Math.round(max / 1e6),
      })),
      { code: 'FILE_TOO_LARGE' },
    );
  }
}

// The stored format string for a video, robust to a blank/wrong OS-supplied MIME.
function videoFormatOf(file: File): string {
  const t = file.type.toLowerCase(), n = file.name.toLowerCase();
  if (/webm/.test(t) || n.endsWith('.webm')) return 'webm';
  if (/quicktime/.test(t) || n.endsWith('.mov')) return 'mov';
  if (/mp4|m4v/.test(t) || /\.(mp4|m4v)$/.test(n)) return 'mp4';
  const ext = extFromMime(file.type);
  return ext === 'bin' ? 'mp4' : ext;
}

// The stored format string for an audio track. Prefer the extension (the OS-supplied
// MIME for audio is often blank or generic), falling back to a MIME sniff. .oga → ogg.

// How long a metadata probe may block an upload. An ingest probe is a nicety (it
// only feeds a badge and the timeline's default clip length), so it must never be
// the reason a file takes noticeably long to store.
const MEDIA_PROBE_MS = 1500;

// Probe a video's or audio file's real playback length in ms. Loads only METADATA
// into a detached element on a blob URL - never the whole file into memory twice,
// and (for audio) never a decode: decodeAudioData would expand a 30 MB Opus podcast
// to gigabytes of Float32 PCM (2 ch × 48 kHz × 7500 s × 4 B ≈ 2.9 GB) to learn one
// number, which is an OOM tab crash on mobile. A MediaRecorder-produced WebM reports
// duration=Infinity until it's seeked to the end - the same force-seek workaround
// export.ts uses for its composited-body duration probe (see stitchTakes's
// `play.currentTime = 1e7` + `ontimeupdate` wait), attempted only when the metadata
// load actually succeeded (an undecodable container would otherwise burn the whole
// seek budget on an element that will never load). Never throws; resolves undefined
// on any failure so a bad probe can't block the upload - element construction
// included. Always revokes the object URL and detaches the element on every path.
async function probeMediaDurationMs(file: Blob, kind: 'video' | 'audio'): Promise<number | undefined> {
  let url: string | undefined;
  let el: HTMLMediaElement | undefined;
  try {
    el = document.createElement(kind);
    url = URL.createObjectURL(file);
    el.preload = 'metadata';
    el.muted = true;
    if (kind === 'video') (el as HTMLVideoElement).playsInline = true;
    el.src = url;
    const loaded = await new Promise<boolean>((res) => {
      const cap = setTimeout(() => res(false), MEDIA_PROBE_MS);
      el!.onloadedmetadata = () => { clearTimeout(cap); res(true); };
      el!.onerror = () => { clearTimeout(cap); res(false); };
    });
    if (loaded && (!Number.isFinite(el.duration) || el.duration === 0)) {
      await new Promise<void>((res) => {
        const to = setTimeout(res, MEDIA_PROBE_MS);
        el!.ontimeupdate = () => {
          if (Number.isFinite(el!.duration)) { clearTimeout(to); el!.ontimeupdate = null; res(); }
        };
        try { el!.currentTime = 1e7; } catch { clearTimeout(to); res(); }
      });
    }
    return Number.isFinite(el.duration) && el.duration > 0 ? Math.round(el.duration * 1000) : undefined;
  } catch {
    return undefined;
  } finally {
    if (url) URL.revokeObjectURL(url);
    if (el) { el.removeAttribute('src'); el.load(); }
  }
}

/** The first existing upload whose bytes are identical to `file`, or null.
 *  Size-gates before hashing: the new file is hashed once, and only same-size
 *  candidates are read back and hashed. Object URLs resolve from memory (the
 *  bridge holds the blobs), so the walk costs no network. */
async function findIdenticalUpload(host: PickerHost, file: File): Promise<AssetRef | null> {
  if (!crypto?.subtle || file.size === 0 || file.size > 256 * 1024 * 1024) return null;
  const uploads = await host.assets._listUserAssets();
  let want: string | null = null;
  const hex = (buf: ArrayBuffer): string => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  for (const a of uploads) {
    if (a.meta?._placeholder || !a.url) continue;
    try {
      const b = await (await fetch(a.url)).blob();
      if (b.size !== file.size) continue;
      want ??= hex(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()));
      if (hex(await crypto.subtle.digest('SHA-256', await b.arrayBuffer())) === want) return a;
    } catch { /* unreadable candidate - not a duplicate we can prove */ }
  }
  return null;
}

export async function storeUserUpload(
  host: PickerHost,
  file: File,
  o: {
    skipDupCheck?: boolean;
    sourceHint?: string;
    /**
     * One store among many in a PROGRAMMATIC import (a deck's pictures, a PDF's
     * paths and rasters). Two things change, both because a modal opened over a
     * running import is fatal to it - the Back-button history entry it pushes fires
     * a popstate on close, the router re-mounts the tool, and the view that was
     * mid-import is gone (a whole 28-page import dropped on the floor, 2026-09-02):
     *   • bytes already in the library are REUSED silently instead of raising the
     *     "Use existing / Keep both" prompt - a deck puts the same logo on every
     *     slide, so asking would mean one modal per repeat anyway;
     *   • the library's milestone nudge (20 / 100 / 500 images) is left for the next
     *     interactive upload to raise.
     */
    batch?: boolean;
  } = {},
): Promise<AssetRef> {
  // Read the file as a blob, stash it in the user-assets IDB store, return
  // a `user/...` AssetRef. The bridge's assets.get() resolves these via the
  // same lookup path as library assets - uniform from the tool's POV.
  const id = `user/upload/${Date.now()}-${file.name.replace(/[^a-z0-9.-]/gi, '_')}`;
  // A Lottie is JSON, not an image - accepted for motion, stored verbatim (no
  // raster resize, which would choke on non-image bytes). Both the raw Bodymovin
  // JSON and dotLottie (.lottie, a zip) land here; the latter is unwrapped to JSON.
  const isDotLottie = /\.lottie$/i.test(file.name);
  const isLottie = isDotLottie || /\.json$/i.test(file.name) || file.type.includes('json');
  // Detect SVG by extension too, not just MIME: a dragged-in .svg (or one the OS gives a
  // blank/wrong type) would otherwise fall through to the raster path and get rasterized
  // into a tiny bitmap. As a vector it's sanitised + normalised to a viewBox-only SVG that
  // scales crisply everywhere (sanitizeSvgFile below).
  const isVector = !isLottie && (file.type.includes('svg') || /\.svg$/i.test(file.name));
  // A short video (webm/mp4/mov) - kept for motion. Stored verbatim (no raster
  // re-encode, which can't handle a video container at all). `let` because the byte
  // backstop below can promote a mislabelled clip to video.
  let isVideo = !isLottie && !isVector && (/^video\//i.test(file.type) || /\.(mp4|m4v|mov|webm)$/i.test(file.name));
  // Music the browser can't decode from an <audio> element, handled before the
  // verbatim-audio test below. MIDI is CONVERTED on the way in: a Standard MIDI File
  // becomes a tiny ZzFXM song (engine midiToZzfxm) stored as a format:'zzfxm' asset - 
  // the same synthesised-on-device path as the catalog's generated tracks, so it
  // plays and previews everywhere. A .mid commonly arrives as audio/midi, which would
  // otherwise pass the generic audio test, so it's detected first (ext, MIME, or the
  // 'MThd' header magic) and excluded from isAudio.
  const head4 = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  // Layered bitmaps (Photoshop '8BPS' / GIMP 'gimp xcf ') reaching THIS funnel
  // (an asset picker, a dropToAdd zone - the front-door drop router offers the
  // layered journeys itself) store as their FLATTENED composite, so a PSD works
  // anywhere an image does. Delegated to psd-import.ts's lazy chunk, which
  // re-enters this function with an ordinary PNG.
  if (head4[0] === 0x38 && head4[1] === 0x42 && head4[2] === 0x50 && head4[3] === 0x53
    || /\.(psd|psb|xcf)$/i.test(file.name)) {
    const headStr = new TextDecoder('latin1').decode(new Uint8Array(await file.slice(0, 9).arrayBuffer()));
    const isPsdMagic = head4[0] === 0x38 && head4[1] === 0x42 && head4[2] === 0x50 && head4[3] === 0x53;
    if (isPsdMagic || headStr === 'gimp xcf ') {
      const { ingestLayeredFileFlattened } = await import('./psd-import.ts');
      return ingestLayeredFileFlattened(host, file);
    }
  }
  // BMP → decode to RGBA, PNG-pack, and re-enter as an ordinary raster: the same
  // "normalise to a supported still, then fall through" move as the PSD/XCF block
  // above. isBmp gates on 'BM' + a full header; decodeBmp validates the rest and
  // throws BmpUnsupportedError on a compressed/paletted variant (the callers of
  // storeUserUpload already try/catch + announce the message).
  if ((head4[0] === 0x42 && head4[1] === 0x4d) || /\.bmp$/i.test(file.name)) {
    const raw = new Uint8Array(await file.arrayBuffer());
    if (isBmp(raw)) {
      const { rgba, width, height } = decodeBmp(raw);
      const png = packPng(rgba, { width, height, channels: 4 });
      const base = file.name.replace(/\.bmp$/i, '') || 'image';
      return storeUserUpload(host, new File([png as BlobPart], `${base}.png`, { type: 'image/png' }));
    }
  }
  // A .zip of assets unpacks and re-enters per entry (plans/132 WP-K item 3) - the
  // bulk Download-zip's inverse. Gated on the .zip EXTENSION plus the PK magic so
  // the zip-shaped formats with their own journeys (.lottie, .xlsx, .pptx) never
  // land here. Per-entry failures skip (a mixed zip imports what it can); the
  // duplicate check is skipped per entry so a re-imported archive never asks
  // fifty questions - identical entries simply store as copies.
  if (/\.zip$/i.test(file.name) && head4[0] === 0x50 && head4[1] === 0x4b) {
    const budget = archiveBudgetFor(file);
    const entries = readArchiveMembers(await readUploadArchiveBytes(file), file.name, budget);
    const MEDIA_RE = /\.(png|jpe?g|webp|apng|gif|avif|heic|heif|bmp|ico|svg|svgz|mp4|m4v|webm|mov|mp3|wav|ogg|oga|opus|m4a|aac|flac|mid|midi|json|lottie|pdf|txt|md|markdown|csv|tsv|xlsx)$/i;
    const CAP = 200;
    let last: AssetRef | null = null;
    let n = 0;
    let skipped = 0;
    for (const { name: path, bytes } of entries) {
      const nm = path.split('/').pop() || '';
      if (!nm || nm.startsWith('.') || path.includes('__MACOSX') || !bytes.length || !MEDIA_RE.test(nm)) continue;
      if (n >= CAP) { skipped++; continue; }
      try {
        last = await storeUserUpload(host, archiveMemberFile(bytes, nm, budget), { skipDupCheck: true });
        n++;
      } catch { skipped++; }
    }
    if (!last) throw new Error(t('Nothing usable found in that zip.'));
    announce(skipped
      ? tRaw('{n} files imported from the zip; {skipped} skipped.', { n, skipped })
      : tRaw('{n} files imported from the zip.', { n }));
    return last;
  }
  // Duplicate detection (plans/132 WP-K item 1): byte-identical to an existing
  // upload -> offer "use existing" before spending the full ingest. Size-gated
  // candidate walk (hashing only size-matches keeps this near-free); best-effort
  // by contract - any failure just proceeds with a normal ingest. The replace
  // flow opts out: replacing an asset with its own bytes is the user's call.
  if (!o.skipDupCheck) {
    const dup = await findIdenticalUpload(host, file).catch(() => null);
    if (dup && o.batch) return host.assets.get(dup.id);
    if (dup) {
      const picked = await choiceDialog({
        title: t('Already in your library'),
        message: tRaw('“{name}” is byte-identical to “{existing}” in your uploads. Use the existing one, or keep both?', {
          name: file.name, existing: String(dup.meta?.name ?? dup.id),
        }),
        choices: [{ id: 'use', label: t('Use existing'), primary: true }, { id: 'both', label: t('Keep both') }],
      });
      if (picked === 'use') return host.assets.get(dup.id);
      // 'both' or Escape -> the non-destructive path: a normal ingest.
    }
  }
  // ICO/CUR → decode the largest image. A PNG-payload entry (png===true) hands its
  // raw bytes straight to the native raster path (re-enter as .png); a BMP-payload
  // entry comes back as RGBA and is PNG-packed like the BMP branch. isIco fully
  // validates the ICONDIR, so a false 00 00 01 00 prefix falls through.
  if (/\.(ico|cur)$/i.test(file.name)
    || (head4[0] === 0 && head4[1] === 0 && (head4[2] === 1 || head4[2] === 2) && head4[3] === 0)) {
    const raw = new Uint8Array(await file.arrayBuffer());
    if (isIco(raw)) {
      const img = decodeIco(raw);
      const png = img.png ? img.bytes : packPng(img.rgba, { width: img.width, height: img.height, channels: 4 });
      const base = file.name.replace(/\.(ico|cur)$/i, '') || 'icon';
      return storeUserUpload(host, new File([png as BlobPart], `${base}.png`, { type: 'image/png' }));
    }
  }
  // .svgz (gzip(SVG)) → gunzip, then re-enter as a plain .svg so the vector path
  // (sanitise + viewBox-normalise) handles it. MUST run before the isVector chain:
  // an OS labelling .svgz as image/svg+xml would otherwise feed gzip bytes to
  // sanitizeSvgFile. Only an SVG payload is accepted; other gzip content falls through.
  if ((head4[0] === 0x1f && head4[1] === 0x8b && head4[2] === 0x08) || /\.svgz$/i.test(file.name)) {
    const raw = new Uint8Array(await file.arrayBuffer());
    if (raw[0] === 0x1f && raw[1] === 0x8b && raw[2] === 0x08) {
      const svg = gunzip(raw);                                    // throws on a corrupt stream
      if (/<svg[\s>]/i.test(new TextDecoder().decode(svg.subarray(0, 4096)))) {
        const base = file.name.replace(/\.svgz$/i, '') || 'image';
        return storeUserUpload(host, new File([svg as BlobPart], `${base}.svg`, { type: 'image/svg+xml' }));
      }
    }
  }
  // '.ts' is two formats: TypeScript source and an MPEG transport stream - and
  // Chromium's mime map stamps a dragged .ts as video/mp2t, which would ride a
  // SOURCE FILE onto the video path on MIME alone (isVideo's extension list has no
  // 'ts'; only the MIME test can claim one). The bytes settle it: a real transport
  // stream repeats its 0x47 sync byte at every 188-byte packet boundary (probed at
  // offsets 0 and 188), which source code never does. A video-stamped .ts without
  // the sync pattern - and without mp4/webm container magic, so a renamed real clip
  // keeps video's claim - is released to the text path below. A real stream keeps
  // today's routing (video when the MIME says so, the raster fall-through when
  // blank) and is never stored as text.
  let tsStream = false;
  if (/\.ts$/i.test(file.name)) {
    const probe = new Uint8Array(await file.slice(0, 189).arrayBuffer());
    tsStream = probe[0] === 0x47 && probe[188] === 0x47;
    if (isVideo && !tsStream && !sniffVideoContainer(probe)) isVideo = false;
  }
  const isMidi = !isLottie && !isVector && !isVideo
    && (/\.midi?$/i.test(file.name) || /^audio\/(x-)?midi?$/i.test(file.type)
        || (head4[0] === 0x4d && head4[1] === 0x54 && head4[2] === 0x68 && head4[3] === 0x64)); // 'MThd'
  // Tracker modules (.mod/.xm/.it/.s3m/…) are tiny sample-based songs no browser
  // <audio> can decode - but libopenmpt (WASM) renders them to PCM for the player and
  // video exports (mod-render.ts), so they're stored VERBATIM as a format:'mod'
  // type:'audio' asset (the decoder sniffs the real format from the bytes; the tiny
  // original is kept, not a bloated transcode). Detected before isAudio because a .mod
  // can arrive as audio/x-mod, which would otherwise match the generic audio test.
  const isModule = !isLottie && !isVector && !isVideo && !isMidi
    && (/\.(mod|xm|it|s3m|stm|mtm)$/i.test(file.name) || /audio\/(x-)?(mod|it|s3m|xm)/i.test(file.type));
  // The user's own music (opus/mp3/wav/ogg/m4a/aac/flac) - stored verbatim as a
  // type:'audio' asset (a canvas re-encode can't touch audio bytes). Detected by
  // MIME or extension; .oga/.ogg both map to ogg. Checked after video so a container
  // MIME collision (audio/mp4 vs video/mp4) can't misroute - .m4a carries audio/mp4
  // but its extension isn't a video one, so the isVideo test above already excluded it.
  const isAudio = !isLottie && !isVector && !isVideo && !isMidi && !isModule
    && (/^audio\//i.test(file.type) || /\.(mp3|wav|ogg|oga|opus|m4a|aac|flac)$/i.test(file.name));

  // A tabular DATA file (.xlsx/.csv/.tsv) - stored VERBATIM as a type:'data' asset so a
  // spreadsheet lives in the catalogue and drops into a tool's data input later (plan 87,
  // the "Add data → From your library" source). Kept as-is (no raster/text processing);
  // .json is deliberately NOT claimed here - it is ambiguous with a Lottie animation and
  // stays on the Lottie path. Detected after every media test so a real media file wins.
  const isData = !isLottie && !isVector && !isVideo && !isMidi && !isModule && !isAudio
    && /\.(xlsx|csv|tsv)$/i.test(file.name);

  // A TEXT file - plain text, markdown, source CODE and markup (TEXT_EXT_RE, plus any
  // text/* MIME and the common code MIMEs) - stored VERBATIM as a type:'text' asset so
  // a poem, note, script or stylesheet lives in the catalogue with its REAL extension,
  // can be read/analysed (text-signal analysis runs at ingest below and again in the
  // verify view; OCR is not needed - the bytes ARE the text) or dropped into a text
  // input. Without this it fell through to the raster branch and became a dimensionless
  // "BIN" image (extFromMime returns 'bin' for text/plain and empty MIMEs). .json stays
  // on the Lottie path; .csv/.tsv stay data; .svg/.svgz stay vector - the !is* chain
  // ahead of this line is what keeps those claims. Detected after every media + data
  // test so a real one always wins; !tsStream keeps an MPEG transport stream off the
  // text path (see the '.ts' probe above).
  const isText = !isLottie && !isVector && !isVideo && !isMidi && !isModule && !isAudio && !isData && !tsStream
    && (TEXT_EXT_RE.test(file.name) || /^text\//i.test(file.type)
        || /^application\/(javascript|typescript|x-sh|xml|x-yaml|toml)$/i.test(file.type));

  // Classify animated rasters (gif/apng/animated-webp) and catch mislabelled video - 
  // both from the HEADER BYTES, since an animated raster shares its MIME with the
  // still form and an OS can hand over a blank/wrong type or extension. The magic
  // bytes are the source of truth (that is the whole reason to byte-sniff); MIME/name
  // only widen which files we bother to read. (Audio is verbatim - nothing to sniff.)
  let animatedKind: 'gif' | 'apng' | 'webp' | null = null;
  if (!isLottie && !isVector && !isAudio && !isMidi && !isModule && !isData && !isText) {
    const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
    // Byte-level video backstop: a real mp4/webm handed over with a wrong extension
    // AND a blank/non-video MIME would otherwise fall to downscaleRaster and be
    // rejected as an unreadable image. Its container magic (ftyp / EBML) is at the head.
    if (!isVideo && sniffVideoContainer(head)) isVideo = true;
    if (!isVideo) {
      const magicGif  = head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46;                       // "GIF"
      const magicPng  = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;   // PNG
      const magicWebp = head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46;   // "RIFF" (WebP)
      const animatable = magicGif || magicPng || magicWebp
        || /gif|png|webp/i.test(file.type) || /\.(gif|png|apng|webp)$/i.test(file.name);
      if (animatable) {
        // Read up to the verbatim cap: a GIF's 2nd frame or an APNG's acTL can sit far
        // past a short peek (behind a large first frame or an ICC/metadata chunk), and a
        // short read would misclassify it as still and flatten it. Files above the cap
        // are rejected by assertVerbatimSize anyway, so they can't be stored verbatim.
        const len = Math.min(file.size, MAX_ANIMATED_RASTER_BYTES);
        const bytes = len <= head.length ? head : new Uint8Array(await file.slice(0, len).arrayBuffer());
        animatedKind = sniffAnimatedRaster(bytes, { mime: file.type, name: file.name });
      }
    }
  }

  let blob: Blob = file;
  let format = extFromMime(file.type);
  let width: number | undefined, height: number | undefined;
  let animated = false;
  // Playback length, ms - video/lottie/audio only, resolved at ingest so the picker
  // badge never has to re-probe a stored blob. `fps` accompanies a lottie's duration
  // (its own frame rate, not a video/audio concept). Absent (not 0) on failure.
  let durationMs: number | undefined, fps: number | undefined;
  // A text asset's AI-writing note (meta.aiSignals - the conventional shape in
  // host-v1.ts), computed in the isText branch while the bytes are in hand so the
  // asset carries it from birth. Absent on any other type, and on analyser failure.
  let aiSignals: Record<string, unknown> | undefined;

  if (isLottie) {
    const text = isDotLottie ? await dotLottieToJson(file) : await file.text();
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new Error(t('That file isn’t valid JSON, so it can’t be a Lottie animation.'));
    }
    // A Lottie/Bodymovin document has a `layers` array, or the version + timing
    // fields (`v` plus `op`/`fr`). Guard so a random .json can't masquerade as one.
    const data = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
    const looksLottie = !!data && (Array.isArray(data.layers) || ('v' in data && ('op' in data || 'fr' in data)));
    if (!looksLottie) throw new Error(t('That JSON doesn’t look like a Lottie animation.'));
    blob = new Blob([text], { type: 'application/json' });
    format = 'json';
    if (typeof data!.w === 'number') width = data!.w;
    if (typeof data!.h === 'number') height = data!.h;
    // op/ip are frame numbers, fr is frames-per-second - a Bodymovin/Lottie standard.
    const op = data!.op, ip = data!.ip, fr = data!.fr;
    if (typeof op === 'number' && typeof ip === 'number' && typeof fr === 'number'
        && Number.isFinite(op) && Number.isFinite(ip) && Number.isFinite(fr) && fr > 0) {
      const ms = Math.round((op - ip) / fr * 1000);
      if (ms > 0) { durationMs = ms; fps = fr; }
    }
  } else if (isVector) {
    // Vectors are resolution-independent - no raster resize. But an uploaded SVG
    // can carry <script>, on*= handlers or external refs, so sanitize on ingest
    // (belt-and-suspenders - assets render via <img>/object-URL, where scripts
    // are already inert). sanitizeSvgFile also normalises to a viewBox-only SVG so
    // it scales crisply everywhere, and hands back the intrinsic aspect for metadata.
    const cleaned = await sanitizeSvgFile(file);
    blob = cleaned.blob;
    // Every other branch sets `format`; this one must too. The default above is
    // extFromMime(file.type), which returns 'bin' for a blank/octet-stream MIME - and an
    // SVG dragged in (or exploded from a zip, or named .bin) routinely has no svg MIME,
    // so it was stored as a "BIN" vector: the badge said BIN and renameExt produced a
    // ".bin" filename, even though the bytes are a sanitised SVG (the id kept .svg).
    format = 'svg';
    ({ width, height } = cleaned);
    // Fallback for an SVG with no viewBox/dimensions to derive from (left un-normalised).
    if (width == null || height == null) {
      ({ width, height } = await readDimensions(blob).catch(() => ({}) as { width?: number; height?: number }));
    }
  } else if (isVideo) {
    // Verbatim: keep the original container bytes (a canvas re-encode can't carry
    // video). Bounded by an explicit cap since downscaleRaster's implicit shrink is
    // skipped. Dimensions come from a <video>, not <img> (naturalWidth is 0 for video).
    assertVerbatimSize(file, MAX_VIDEO_BYTES, t('video'));
    format = videoFormatOf(file);
    // readVideoDimensions already loads the metadata and hands back `duration`, so the
    // common case costs ONE metadata load; the extra probe is only for the
    // Infinity/0 MediaRecorder-webm case it was written for.
    let duration: number | undefined;
    ({ width, height, duration } = await readVideoDimensions(file));
    durationMs = duration != null && duration > 0
      ? Math.round(duration * 1000)
      : await probeMediaDurationMs(file, 'video');
  } else if (isMidi) {
    // Convert the SMF to a ZzFXM song on device and store the JSON (a few KB) as a
    // format:'zzfxm' audio asset - the browser can't play raw MIDI, but it renders
    // ZzFXM to PCM (zzfxm.ts) for the player and the catalog preview. A file with no
    // notes / an unsupported time division throws with a user-ready message.
    assertVerbatimSize(file, MAX_AUDIO_BYTES, t('MIDI file'));
    try {
      const song = midiToZzfxm(new Uint8Array(await file.arrayBuffer()), { name: file.name.replace(/\.midi?$/i, '') });
      blob = new Blob([JSON.stringify(song)], { type: 'application/json' });
    } catch {
      const e: Error & { code?: string } = new Error(t('Couldn’t read that MIDI file - it may be empty, corrupt, or use an unsupported format.'));
      e.code = 'unsupported-format';
      throw e;
    }
    format = 'zzfxm';
  } else if (isModule) {
    // Verbatim: a tracker module is already tiny (sample-based song data) and no
    // canvas/audio re-encode applies - libopenmpt decodes the original bytes on demand
    // (mod-render.ts). Stored as format:'mod' so the player and video exporter route it
    // through the WASM decoder. No dimensions - audio has none.
    assertVerbatimSize(file, MAX_AUDIO_BYTES, t('audio track'));
    // Keep the real tracker extension (mod/xm/s3m/it/…) so the badge and filename stay
    // honest; libopenmpt sniffs the actual format from the bytes regardless. A
    // MIME-only detection (audio/x-mod, no known extension) defaults to 'mod'.
    format = file.name.toLowerCase().match(/\.(mod|xm|it|s3m|stm|mtm)$/)?.[1] ?? 'mod';
  } else if (isAudio) {
    // Verbatim: keep the original encoded bytes (there is no raster/canvas path for
    // audio). Bounded by an explicit cap since downscaleRaster's implicit shrink is
    // skipped. No dimensions - audio has none.
    assertVerbatimSize(file, MAX_AUDIO_BYTES, t('audio track'));
    format = audioFormatOf(file);
    durationMs = await probeMediaDurationMs(file, 'audio');
  } else if (isData) {
    // Verbatim: a spreadsheet/CSV is kept byte-for-byte (an .xlsx is a zip - a canvas
    // path would destroy it). It becomes a type:'data' catalogue asset the "Add data →
    // From your library" source reads back through readXlsx/parseDataRows. No dimensions.
    assertVerbatimSize(file, MAX_DATA_BYTES, t('data file'));
    format = /\.xlsx$/i.test(file.name) ? 'xlsx' : /\.tsv$/i.test(file.name) ? 'tsv' : 'csv';
  } else if (isText) {
    // Verbatim: text, markdown, code and markup are kept byte-for-byte. Format is the
    // REAL extension so the badge reads TXT/MD/PY/CSS and renameExt keeps the right
    // suffix - never the 'bin' the raster fall-through used to stamp. No dimensions
    // (text has none).
    assertVerbatimSize(file, MAX_DATA_BYTES, t('text file'));
    const ext = file.name.toLowerCase().match(TEXT_EXT_RE)?.[1];
    format = ext === 'markdown' ? 'md' : ext === 'text' ? 'txt' : (ext ?? 'txt');
    // AI-writing signals, analysed NOW while the bytes are in hand so the confidence
    // note is persisted on the asset from birth - keyed to LEXICON_VERSION, so a note
    // from a stale lexicon is recomputed downstream, never trusted. The analysed slice
    // is capped (the stored bytes are not); the analyser detects prose/markdown/code
    // itself. Best-effort by contract: an analyser error must NEVER block an upload -
    // it is logged and the asset stores without the note.
    try {
      const body = new TextDecoder('utf-8', { fatal: false })
        .decode(await file.arrayBuffer())
        .slice(0, MAX_AI_SIGNAL_CHARS);
      const r = analyzeTextSignals(body, { source: 'digital' });
      aiSignals = {
        v: LEXICON_VERSION,
        band: r.band,
        score: r.score,
        source: 'digital',
        ...(r.styleGuess ? { family: r.styleGuess.family, confidence: r.styleGuess.confidence } : {}),
      };
    } catch (e) {
      host.log('warn', 'Text-signal analysis failed at ingest', { error: String(e) });
    }
  } else if (animatedKind) {
    // Verbatim: re-encoding an animated gif/apng/webp through a canvas flattens it
    // to a single frame, so store the original bytes. It stays type:'raster' - it
    // animates natively in <img> and can fill any image slot - but is marked
    // `animated` so the UI badges the motion (and export knows it flattens to a still).
    assertVerbatimSize(file, MAX_ANIMATED_RASTER_BYTES, t('animation'));
    animated = true;
    format = animatedKind;
    ({ width, height } = await readDimensions(file).catch(() => ({}) as { width?: number; height?: number }));
  } else {
    // Raster. A good-size image is stored VERBATIM (a silent re-encode would break a C2PA hard
    // binding, so a credentialed AI render / signed photo always keeps its bytes; other images
    // keep theirs too). The "strip metadata on upload" flag (default OFF) governs OTHER metadata:
    // ON → scrub EXIF/XMP/GPS (in place for png/jpeg, preserving any C2PA store; via re-encode
    // for other formats). OFF → keep the bytes exactly. ONLY when an image is genuinely HUGE do
    // we prompt + advise (Keep original / Resize) - giving the user the choice rather than
    // silently shrinking; resizing a credentialed original re-signs it as a c2pa.resized
    // derivative so its provenance still validates to its best extent.
    const raw = new Uint8Array(await file.arrayBuffer());
    // Scan for a credential structurally (no size cap - a large signed image can still
    // preserve its chain on resize; `raw` is already read, so this parse is ~free).
    const ex = extractC2paStore(raw);
    // Opt-in privacy flag (default OFF - we keep uploads as they arrive unless asked).
    const stripMeta = isFlagOn(await host.profile.get(), STRIP_UPLOAD_META_FLAG);
    if (ex) format = ex.format;
    const dims = await readDimensions(file).catch(() => ({}) as { width?: number; height?: number });
    const longest = Math.max(dims.width ?? 0, dims.height ?? 0);
    const isHuge = file.size > HUGE_UPLOAD_BYTES || longest > MAX_LONGEST_EDGE * 2;
    // Keep the exact bytes - but honour the privacy flag: strip-on png/jpeg drops EXIF/XMP/GPS
    // IN PLACE (no quality loss, C2PA store preserved so a credential still verifies).
    const keepBytes = async (): Promise<void> => {
      let out: Uint8Array = raw;
      if (stripMeta && (format === 'png' || format === 'jpeg')) {
        try {
          out = stripMetadata(raw, format);
        } catch {
          // The in-place strip couldn't verify a clean result. A privacy opt-in must
          // never fall back to storing the original with its metadata intact, so
          // re-encode instead - a guaranteed scrub, same as the not-strippable branch.
          await reencode();
          return;
        }
      }
      blob = new Blob([out as BlobPart], { type: file.type || undefined });
      width = dims.width; height = dims.height;
    };
    // Downscale + re-encode to WebP (the space-saver; also the only way to scrub metadata from a
    // format stripMetadata can't touch). Re-signs a CREDENTIALED original as a c2pa.resized
    // derivative - the original rides in as a preserved ingredient - so a good credential still
    // validates to its best extent instead of just breaking.
    const reencode = async (): Promise<void> => {
      const resized = await downscaleRaster(file);
      ({ format, width, height } = resized);
      blob = resized.blob;
      if (ex) {
        try {
          const { stampDerivedC2pa } = await import('../bridge/export.ts');
          const ingredient = prepareC2paIngredientFromStore(ex.store, ex.format);
          blob = await stampDerivedC2pa(host, resized.blob, format, {
            title: file.name,
            tool: 'Upload',
            actions: [{ action: 'c2pa.resized', description: `Resized to ${width}×${height}px (from ${dims.width ?? '?'}×${dims.height ?? '?'}px) when added to your library` }],
            ...(ingredient ? { ingredients: [ingredient] } : {}),
            dimensions: `${width}×${height}`,
          });
        } catch { /* re-sign failed - ship the resized bytes; the record still preserves the original credential below */ }
      }
    };
    const canStripInPlace = format === 'png' || format === 'jpeg';
    if (ex && file.size <= MAX_CREDENTIAL_SCAN_BYTES) {
      // Credentialed AND it fits → ALWAYS verbatim; the C2PA hard binding stays intact + validates.
      await keepBytes();
    } else if (stripMeta && !canStripInPlace) {
      // Privacy strip is ON but this format can't be scrubbed in place → re-encode (the
      // only way to drop its metadata). Checked BEFORE the size prompt: "Keep original"
      // there must never silently override an explicit strip-metadata opt-in.
      await reencode();
    } else if (isHuge) {
      // Genuinely huge → let the USER decide (the size warning + a bypass) rather than silently
      // shrinking. Escape/Cancel keeps the original (non-destructive). "Keep original" stores it
      // verbatim (device quota still applies); "Resize" re-encodes (re-signing a credentialed
      // original as a c2pa.resized derivative).
      const r = computeResize(dims.width ?? 0, dims.height ?? 0);
      const dimsPart = longest ? ` (${dims.width}×${dims.height}px)` : '';
      const resizePart = r.width ? ` to ${r.width}×${r.height}px` : '';
      const picked = await choiceDialog({
        title: t('Very large image'),
        message: tRaw('“{name}” is {size}{dims}. Keep the original - best for a Content Credential - or resize it{resize} to save space?', {
          name: file.name, size: fmtBytes(file.size), dims: dimsPart, resize: resizePart,
        }),
        choices: [{ id: 'resize', label: t('Resize') }, { id: 'keep', label: t('Keep original'), primary: true }],
      });
      if (picked === 'resize') await reencode();
      else await keepBytes();
    } else {
      // Good size → keep the exact bytes. keepBytes() still scrubs EXIF/XMP/GPS in place for
      // png/jpeg when the privacy flag is on (no quality loss, C2PA store preserved).
      await keepBytes();
    }

    // Depth honesty (plans/61-deeprichpixels.md Phase A): every editing/export
    // surface downstream of ingest is 8 bits per channel today, so a deeper
    // source (a 16-bit PNG/TIFF) is flattened the first time it is drawn - even
    // a verbatim-kept file. Same class of notice as profileHint's "no profile,
    // read as sRGB" caveat: say what happened, once, at ingest. Fire-and-forget
    // so the sniff can never delay or fail the upload it reports on.
    void depthHint(raw).then((d) => {
      if (d.bitsPerChannel != null && d.bitsPerChannel > 8) {
        const msg = t('{n}-bit source. Lolly currently edits at 8 bits per channel; deep editing is planned.', { n: String(d.bitsPerChannel) });
        announce(msg);
        host.log('info', msg);
      }
    }).catch(() => { /* depthHint never throws by contract; belt and braces */ });
  }

  // The depth of what we are actually STORING - the twin of the catalog label
  // scripts/checksum-assets.ts writes, so a user's own image carries the same
  // written origin a pack asset does (plans/61-deeprichpixels.md section 10 item 6).
  //
  // Deliberately sniffed from `blob`, not from `raw` above: those two answer
  // different questions and only one of them is honest here. `raw` is the
  // SOURCE, which is what the notice above reports ("16-bit source, flattened");
  // `blob` is the bytes on the device, and a re-encoded upload really is 8-bit
  // WebP now. Labelling the stored file with the source's depth would be the
  // export-side lie the plan's governing principle forbids. Best-effort and
  // never fatal: unknown stays absent.
  let storedDepth: number | null = null;
  if (!isLottie && !isAudio && !isMidi && !isVector && !isVideo) {
    try { storedDepth = (await depthHint(blob)).bitsPerChannel; } catch { storedDepth = null; }
  }

  // Bare-metadata provenance for the STORED image/video bytes, read at ingest
  // so an uncredentialed generator output still tells its story from birth
  // (the verify view reads the same fields; this persists them on the record).
  // Two registers, never conflated:
  //  - fm.ai is the IPTC DigitalSourceType sidecar generators WRITE - a genuine
  //    declaration, so it sets the same aiGenerated flag a C2PA credential or
  //    the user's own declare-AI-origins action does;
  //  - fm.producer is a packaging fingerprint - evidence, not a declaration, so
  //    it stores as meta.makerLikely and only ever surfaces as a hedged signal.
  // Best-effort by contract: a parse error must never block an upload.
  let bareAi: 'full' | 'partial' | undefined;
  let makerLikely: { vendor: string; hint: string } | undefined;
  if (!isLottie && !isAudio && !isMidi && !isVector && !isData && !isText && blob.size <= MAX_CREDENTIAL_SCAN_BYTES) {
    try {
      const fm = extractFileMetadata(new Uint8Array(await blob.arrayBuffer()));
      if (fm.ai) bareAi = fm.ai.kind === 'composite' ? 'partial' : 'full';
      else if (fm.producer?.signature === 'ai-download') makerLikely = { vendor: fm.producer.vendor, hint: fm.producer.hint };
    } catch { /* nothing readable - the upload proceeds unlabelled */ }
  }

  // Content Credentials for the STORED bytes - the raw C2PA manifest store only (no
  // pixels/EXIF), so `host.assets.credential(id)` can serve it as an export ingredient.
  // Prefer the stored blob's own credential: a verbatim/stripped copy keeps the original's
  // (the binding survives), and a resized upload was re-signed as a derivative that embeds a
  // fresh one. Fall back to the ORIGINAL file when a plain re-encode dropped it - SVG
  // sanitisation strips the in-file manifest, so the record still carries the original's
  // chain. Lottie/audio/MIDI carry nothing to scan. Best-effort - absent = nothing to preserve.
  let credential: Uint8Array | undefined, credentialFormat: string | undefined;
  if (!isLottie && !isAudio && !isMidi) {
    try {
      const fromBlob = blob.size <= MAX_CREDENTIAL_SCAN_BYTES ? extractC2paStore(new Uint8Array(await blob.arrayBuffer())) : null;
      const src = fromBlob ?? (file.size <= MAX_CREDENTIAL_SCAN_BYTES ? extractC2paStore(new Uint8Array(await file.arrayBuffer())) : null);
      if (src) { credential = src.store; credentialFormat = src.format; }
    } catch { /* nothing to preserve */ }
  }

  // The ingest provenance snapshot (plans/144 Wave 5 O4): the import moment,
  // captured once with the SOURCE file's own facts - the root of the asset's
  // chain even after later derivations re-encode the pixels. Read from the
  // ORIGINAL bytes, not the stored blob, because the downscale strips what
  // this exists to remember. IDB-only, never exported, deleted with the asset.
  let provenance: Record<string, unknown> | undefined;
  if (!isLottie && !isAudio && !isMidi && file.size <= MAX_CREDENTIAL_SCAN_BYTES) {
    try {
      const sm = extractFileMetadata(new Uint8Array(await file.arrayBuffer()));
      const pick = (...labels: string[]): string | undefined => {
        for (const l of labels) {
          const f = sm.fields.find((x) => x.label === l);
          if (f?.value) return f.value;
        }
        return undefined;
      };
      const digest: Record<string, string> = {};
      const author = pick('Artist', 'Author', 'Creator', 'By-line');
      if (author) digest.author = author;
      const copyright = pick('Copyright', 'Rights');
      if (copyright) digest.copyright = copyright;
      const captureDate = pick('Taken', 'Creation Time');
      if (captureDate) digest.captureDate = captureDate;
      const software = pick('Software', 'Created with');
      if (software) digest.software = software;
      const camera = pick('Camera');
      if (camera) digest.camera = camera;
      const keywords = pick('Keywords');
      if (keywords) digest.keywords = keywords;
      provenance = {
        originalFilename: file.name,
        importedAt: new Date().toISOString(),
        sourceHint: o.sourceHint ?? 'picker',
        ...(Object.keys(digest).length ? { metaDigest: digest } : {}),
        credentialPresent: !!credential,
      };
    } catch { /* the upload proceeds without a snapshot */ }
  }

  const record: UserAssetRecordInput = {
    id,
    type: isLottie ? 'lottie' : isVector ? 'vector' : isVideo ? 'video' : (isAudio || isMidi || isModule) ? 'audio' : isData ? 'data' : isText ? 'text' : 'raster',
    format,
    blob,
    width,
    height,
    version: '1.0.0',
    ...(credential && credentialFormat ? { credential, credentialFormat } : {}),
    // Rasters get re-encoded (usually to WebP), so the original extension can
    // lie - a "photo.jpg" now holds WebP bytes. Show a name whose extension
    // matches what we actually stored so the filename and format badge agree.
    // (Verbatim animated/video/audio keep their real bytes, so the name stays true.)
    // Audio - verbatim uploads AND MIDI-converted songs - carries `tags` so it can
    // surface as focus music: `neurospicy` is the focus-set tag, `audio` groups it
    // with the music beds. (The player lists ANY user audio regardless, but the tags
    // keep grouping/search consistent with catalog audio.)
    meta: {
      name: renameExt(file.name, format),
      ...(animated ? { animated: true } : {}),
      ...(isAudio || isMidi || isModule ? { tags: ['audio', 'neurospicy'] } : {}),
      // Playback length - video (probed, incl. the MediaRecorder-webm force-seek
      // workaround), lottie (derived from op/ip/fr), or pure-audio (decodeAudioData).
      // Never 0/bogus: only ever set when resolved to a finite positive value.
      ...(durationMs != null ? { durationMs } : {}),
      ...(fps != null ? { fps } : {}),
      // Bits per channel of the stored bytes, when the container states it.
      // Absent = unknown, never assumed 8.
      ...(storedDepth != null ? { depth: storedDepth } : {}),
      // A text asset's AI-writing note, analysed at ingest (see the isText branch).
      // A signal for the user's own confidence in an ingredient, never a verdict.
      ...(aiSignals ? { aiSignals } : {}),
      // A maker-pipeline fingerprint (see the bare-metadata sniff above): the
      // file is packaged the way a known AI product packages downloads. A
      // signal the chips render hedged, never a verdict.
      ...(makerLikely ? { makerLikely } : {}),
      // The import-moment snapshot (plans/144 Wave 5 O4) - see above.
      ...(provenance ? { provenance } : {}),
    },
    ...(bareAi ? { aiGenerated: bareAi } : {}),
  };

  // Reach into the underlying IDB the bridge owns. The bridge exposes a
  // narrow upload helper rather than full DB access - keeps surface tight.
  await host.assets._uploadUserAsset(record);

  // A new audio track should appear in the Neurospicy player right away - drop its
  // cached track list; a mounted player rebuilds via the 'lolly:neuro-tracks' event.
  if (record.type === 'audio') invalidateNeurospicyTracks();

  // Friendly, one-shot nudge as the library crosses a milestone (20/100/500).
  // Fire-and-forget: it must never delay or fail the upload it follows.
  if (!o.batch) void maybeNudgeAssetMilestone(host);

  // Re-resolve via the public API so we get a proper AssetRef with object URL.
  return host.assets.get(id);
}

/**
 * Replace the FILE behind one existing upload, KEEPING its id - so every saved session,
 * tool, template and project folder that references `targetId` redrives with the new bytes on
 * next mount (the runtime re-resolves asset refs by id). Baked refs and version-pinned frozen
 * bytes are the intended exceptions: their bytes were snapshotted and are not re-read.
 *
 * The new file goes through the SAME full ingest as a fresh upload (format sniff, dimensions,
 * resize, and its OWN C2PA / AI provenance - extracted from the NEW file, never inherited from
 * the replaced asset, which would launder a different image's disclosure; this is the one place
 * a replace deliberately diverges from commitTrim, whose derivative-of-the-same-image edit DOES
 * carry the credential forward). To reuse all of that ingest without threading a target-id
 * override through storeUserUpload's format-normalising recursion, we ingest to a throwaway id,
 * then re-key the resulting record onto `targetId` with a bumped `version` (so the
 * `user:<id>:<format>:<version>` object-URL cache changes and the grid + sessions stop painting
 * the old bytes) and drop the throwaway. The display name is kept from the replaced asset (its
 * extension re-matched to the new bytes, the honesty renameExt keeps); the id never changes - it
 * is a permanent contract.
 */
type ReplaceHost = PickerHost & {
  assets: PickerHost['assets'] & {
    _exportUserAssets(): Promise<Array<UserAssetRecordInput & { id: string; type?: string; version?: string; checksum?: string }>>;
  };
};

// raster + vector are both "still image" kinds - a replace may swap between them - but turning
// an image slot into a video/audio/lottie/data one would silently break every consumer.
function assetKindOf(type?: string): string {
  return type === 'raster' || type === 'vector' ? 'image' : (type ?? 'other');
}

export async function replaceUserUpload(host: ReplaceHost, targetId: string, file: File): Promise<AssetRef> {
  // Full ingest of the NEW bytes to a throwaway id. Its provenance is the new file's own.
  // skipDupCheck: replacing an asset with bytes identical to something in the
  // library is a deliberate act - the duplicate dialog would only second-guess it.
  const fresh = await storeUserUpload(host, file, { skipDupCheck: true });
  const bail = async (msg: string, code?: string): Promise<never> => {
    await host.assets._deleteUserAsset(fresh.id).catch(() => {});
    throw Object.assign(new Error(msg), code ? { code } : {});
  };
  const recs = await host.assets._exportUserAssets();
  const freshRec = recs.find((r) => r.id === fresh.id);
  if (!freshRec) return bail('replace: the freshly-ingested record could not be read back');
  const oldRec = recs.find((r) => r.id === targetId);

  // Guard the destructive cases: a document (PDF/PPTX/.ai) lands as an unreadable format:'bin'
  // raster, and swapping an image slot for a video/audio/lottie would break every consumer.
  // Refuse (and drop the throwaway) rather than overwrite the kept id with junk - the id is a
  // permanent contract every session already points at.
  if (freshRec.format === 'bin') {
    return bail(t('That file can’t be used as an image. Try a PNG, JPG, SVG or WebP.'), 'REPLACE_KIND_MISMATCH');
  }
  if (oldRec?.type && assetKindOf(freshRec.type) !== assetKindOf(oldRec.type)) {
    return bail(t('You can only replace this with the same kind of file (for example, an image with an image).'), 'REPLACE_KIND_MISMATCH');
  }

  const oldName = oldRec?.meta?.name;
  const { id: _throwaway, checksum: _staleChecksum, ...carried } = freshRec;

  // Drop the throwaway FIRST: leaving it until after the target write makes the target's quota
  // check double-count the new bytes (a net-zero replace could spuriously fail near quota) and,
  // on a failed write, strands it as a visible duplicate. The blob handle captured in `carried`
  // stays readable after the row is deleted (a structured-clone snapshot), so the re-key works.
  await host.assets._deleteUserAsset(fresh.id).catch(() => {});

  await host.assets._uploadUserAsset({
    ...carried,
    id: targetId,
    // Bump so the user:<id>:<format>:<version> cache key changes and every ref redrives.
    version: String(Date.now()),
    // Replace swaps BYTES only - keep the asset's existing display name verbatim (Rename is the
    // separate verb for the name; mangling a user label like "Headshot v2.1" via renameExt would
    // be wrong). The format badge tracks `format`, not the label's extension.
    meta: { ...carried.meta, ...(oldName != null ? { name: String(oldName) } : {}) },
  });

  // A fresh AssetRef for the replaced id (new version ⇒ new object URL).
  return (await host.assets.get(targetId)) ?? { ...fresh, id: targetId };
}

/**
 * Persist a freshly-captured asset - the Record tool's camera take, or a screencap
 * screenshot (png, v1.54) - as a durable user asset, so a SAVED session restores it
 * after a reload: a blob: URL dies on navigation and a bare `recording.mp4` id can't
 * be re-resolved.
 *
 * Deliberately NOT storeUserUpload: a full-length take can exceed that path's
 * 15 MB verbatim cap, and these are always a finished container we produced (no
 * raster/animation sniffing needed). The only guard is _uploadUserAsset's
 * device-quota check. The `user/recording/*` id namespace marks these as
 * tool-generated so a re-capture can retire the PREVIOUS one (prevId) without
 * touching an asset the user picked from their own library - it reads as
 * "tool-generated capture", which a screenshot is, so stills share it rather than
 * forking a parallel namespace the manage-uploads UI would have to learn.
 * `meta.bytes` rides along so the save/exit dialog can show the stored size
 * without a re-read.
 *
 * A still also stores its pixel dimensions: the AssetRef carries them to the tool,
 * whose crop maths needs the shot's true size (it has no other way to learn it - a
 * hook is DOM-free and can't measure an image).
 *
 * `credential` (the C2PA manifest store extracted from the just-signed asset) is
 * persisted on the record so host.assets.credential(id) serves it - `user/`
 * lookups read the stored store, not the bytes - letting the capture chain as an
 * ingredient when composited, exactly like a credentialed upload.
 *
 * `opts.audio` marks an AUDIO-ONLY take (the timeline panel's record-in-place
 * voiceover): the container is still webm/mp4, but the asset's TYPE is 'audio', so
 * every consumer that dispatches on type - the picker's filters, a tool hook asking
 * "is this box a sound?" - reads it as a sound rather than a silent video.
 *
 * `opts.durationMs` is the take's MEASURED length. It matters far more than it looks:
 * an audio asset has no element a caller can ask for `.duration`, so the timeline's
 * media clamp (trim, "fit to media", promote's default length) has nothing to work
 * with unless the length is stored here. It must come from the caller's own elapsed
 * measurement - a fresh MediaRecorder blob routinely reports duration Infinity/0, the
 * same lesson `data-clip-ms` records on the video side - so this function takes the
 * number rather than probing the bytes. Ignored when it is not a finite positive.
 */
export async function storeRecordingAsset(
  host: PickerHost, blob: Blob, ext: 'mp4' | 'webm' | 'png', prevId?: string,
  credential?: { store: Uint8Array; format: string },
  opts?: { audio?: boolean; durationMs?: number },
): Promise<AssetRef> {
  const isStill = ext === 'png';
  const isAudio = !isStill && opts?.audio === true;
  const id = `user/recording/${Date.now()}.${ext}`;
  // Measuring is best-effort: a shot that won't decode is still worth keeping (the
  // tool falls back to the rendered size), so never fail the capture over dimensions.
  const dims = isStill ? await readDimensions(blob).catch(() => ({} as { width?: number; height?: number })) : {};
  const durationMs = Number(opts?.durationMs);
  await host.assets._uploadUserAsset({
    id, type: isStill ? 'raster' : isAudio ? 'audio' : 'video', format: ext, blob, version: '1.0.0',
    ...(dims.width && dims.height ? { width: dims.width, height: dims.height } : {}),
    ...(credential ? { credential: credential.store, credentialFormat: credential.format } : {}),
    meta: {
      name: isStill ? `Screenshot.${ext}` : isAudio ? `Voiceover.${ext}` : `Recording.${ext}`,
      bytes: blob.size,
      ...(Number.isFinite(durationMs) && durationMs > 0 ? { durationMs: Math.round(durationMs) } : {}),
    },
  });
  if (prevId && prevId.startsWith('user/recording/') && prevId !== id) {
    try { await host.assets._deleteUserAsset(prevId); } catch { /* orphan take is harmless */ }
  }
  return host.assets.get(id);
}

function readDimensions(file: Blob): Promise<{ width?: number; height?: number }> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return resolve({});
    let settled = false;
    const url = URL.createObjectURL(file);
    const img = new Image();
    // A cap mirrors readVideoDimensions: <img> normally fires load or error, but a
    // valid-container-yet-undecodable file could fire neither and wedge the awaiting
    // upload forever (and leak the object URL). Resolve empty dims after the cap.
    const cap = setTimeout(() => { if (!settled) { settled = true; URL.revokeObjectURL(url); resolve({}); } }, 5000);
    img.onload = () => {
      if (settled) return;
      settled = true; clearTimeout(cap); URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = (e) => {
      if (settled) return;
      settled = true; clearTimeout(cap); URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}


// Swap a filename's extension for `ext` (e.g. "photo.jpg" -> "photo.webp").
// Appends if there was no extension; collapses an already-matching one.
function renameExt(name: string, ext: string): string {
  return String(name ?? '').replace(/\.[^./\\]+$/, '') + '.' + ext;
}
