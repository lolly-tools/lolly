// SPDX-License-Identifier: MPL-2.0
/**
 * Tool view - mounts one tool.
 *
 * Lifecycle:
 *   1. loadTool() fetches manifest + template + hooks from the catalog
 *   2. createRuntime() spins up the engine with the host bridge
 *   3. We render input controls from runtime.getModel() and the template
 *      output from runtime.getHydrated()
 *   4. Input changes → runtime.setInput() → subscribed callback re-renders
 *   5. Action buttons call runtime.export() / host.clipboard / host.state
 */

// View-scoped stylesheets - Vite emits these as async CSS chunks loaded WITH this
// lazy view, instead of render-blocking the gallery/catalog landing (see app.css).
import '../styles/parts/tool.css';
import { presentApis } from '@lolly-tools/core';
import '../styles/parts/editor.css';
// The Design editor's three chrome columns (plan 179 M1-M3). Their modules import no CSS
// of their own - so they stay mountable in a node test - and ride this lazy tool chunk.
import '../styles/parts/design-topbar.css';
import '../styles/parts/design-navigator.css';
import '../styles/parts/design-inspector.css';
import '../styles/parts/design-guides.css';
import '../styles/parts/document.css';
import '../styles/parts/deck-editor.css';
import '../styles/parts/tool-chrome.css';
import {
  loadTool,
  parseUrlState,
  annotateTemplate,
  toCssPx,
  normalizeTableValue,
  encodeTableCompact,
  DEFAULT_CMYK_CONDITION,
  isTokenValue,
  packQuery,
  expandQuery,
  hasPackedState,
  isPackAvailable,
  PACK_PARAM,
  hasEncryptedState,
  unpackEncrypted,
  ENC_PARAM,
  C2PA_FORMATS,
  isBakedRef,
  assetIdForUrl,
  blocksForUrl,
  HDR_DEFAULTS,
  serializeHdr,
  compileDocument,
  inspectDocument,
  measureDocument,
  diffDocuments,
} from '@lolly/engine';
import { modelToValues } from '../../../../engine/src/inputs.js';
import { createInteractiveToolRuntime as createRuntime } from '../lib/mount-runtime.ts';
import type { HdrSettings, DepthSetting, VideoUrlSettings } from '@lolly/engine';
import { hasVideoParams, VIDEO_CODEC_STRINGS } from '@lolly/engine';
// The one declaration of the export bar's audio selection shape (mix-in bed
// incl.) - see bridge/audio-envelope.ts; ExportOpts references it too.
import type { ExportAudio } from '../bridge/audio-envelope.ts';
import { promptDialog } from '../components/confirm-dialog.ts';
import { mountModal } from '../components/modal.ts';
import { instanceFetch, instancePath } from '../lib/instance.ts';
import { attachCollabPlumbing } from '../lib/collab-plumbing.ts';
// The acquisition seam only (plan 100 section 5) - a registry with no runtime imports of
// its own. The presence stack it gates (session, pill, rings, cursors) is reached
// through one `import()` inside the guarded block below, so a build that ships no
// transport never fetches that chunk: a collab is lazy chrome that must cost a
// single-player build nothing (collab-pill.ts's own rule; the neuro-dock/
// music-player pattern).
import { acquireCollabSession } from '../lib/collab-session-source.ts';
// The three one-shot hand-offs a live collab arms BEFORE this view is entered
// (lib/collab-live-mount.ts, plan 100 section 6.2a/section 11.17). Statically imported, and that
// costs a single-player build NOTHING extra: `main.ts` already imports this module on
// the boot path for `installLiveCollabMount()`, so it is in the entry chunk either way
// - unlike the presence composition, which stays behind the guard's `import()`. All
// three are inert (a comparison and a null) for every mount that is not a collab.
import {
  carryMountState,
  takeCarriedMountState,
  takeEphemeralState,
  willRemountForCollab,
} from '../lib/collab-live-mount.ts';
// The fourth such hand-off, and the smallest: which TEAM session this mount was opened
// from, when it was opened from one (org/team-session-origin.ts, plans/100 section 7). A leaf
// with no imports of its own - module state, no network, no DOM - so a build with no
// control plane pays two function calls and nothing else.
import { consumeTeamSessionOrigin, releaseTeamSessionOrigin } from '../org/team-session-origin.ts';
import type { ToolCollab } from './tool-collab.ts';
import { migrateBlockRowIds, stripHiddenRowIds } from '../lib/row-id.ts';
import { parseEditorState, coerceUiState } from '../lib/editor-state.ts';
import { installDocumentSurface } from '../lib/document-surface.ts';
import { MountLifecycle } from '../lib/mount-lifecycle.ts';
import {
  prepareToolDesignSystemContext,
  type ToolDesignSystemRegistry,
} from './tool-design-system-context.ts';
import { fpsTick, startFrameFps, stopFrameFps } from '../lib/frame-fps.ts';
import { getToolIntegrity } from '../catalog/integrity.ts';
import { isToolInstalled, installedFetchFile } from '../lib/installed-tools.ts';
import { takeAutomationExportPassword } from '../lib/automation-export-secret.ts';
import {
  DESIGN_INTENT_OPTIONS,
  designNarrationEnabled,
  designOutcome,
  designTimelineEnabled,
  inferDesignIntent,
  type DesignIntent,
} from './design-workspace.ts';

import { escape } from '../utils.ts';
import { createHistory, cloneValue, describeRowChange } from './tool-history.ts';
import { backPillHtml, backHomeHtml, mountBackPill } from '../components/back-pill.ts';
import { mountHomeFab } from '../components/home-fab.ts';
import {
  hasGuide,
  guideButtonHtml,
  showToolGuide,
  autoOpenToolGuide,
} from '../components/tool-guide.ts';
import { jellyActive } from '../lib/jelly.ts';
import { toolSupport, capabilityLabel, canBatchTool, singleFileInputId } from '../capabilities.ts';
import { collectBulkFiles } from '../lib/bulk-files.ts';
import { docsAppHref, currentLang, t, tRaw } from '../i18n.ts';
import { announce } from '../a11y.ts';
import { setupRecordControl } from './record-control.ts';
import { livePalette } from '../lib/live-palette.ts';
import { urlProfileValue } from '../lib/press-profile-embed.ts';
import {
  setSwatches,
  colorFieldHtml,
  wireColorField,
  fixedContainingBlockOrigin,
} from '../components/color-field.ts';
import { askLollyIntent } from './picker.ts';
import { applyBrandVars } from '../brand-vars.ts';
import { createThemeToggle } from '../components/theme-toggle.ts';
import { createSoundToggle } from '../components/sound-toggle.ts';
import { createProfileControl } from '../components/profile-menu.ts';
import { scopeCss, scopeTemplateStyles } from '../lib/scope-css.ts';
import { setupMobileSheet, flickDirection } from '../lib/mobile-sheet.ts';
import { wireExportPanelFloat } from '../lib/export-panel-float.ts';
import { loadExportPrefs, mergeExportPrefs } from '../lib/export-prefs.ts';
import {
  edgeDockCollapsed,
  isDocked,
  onDockChange,
  releaseDock,
} from '../lib/edge-dock.ts';
import { runTemplateScripts, waitForQuiescence } from '../lib/render-lifecycle.ts';
import { playSfx } from '../lib/sfx.ts';
import { createShutter } from '../lib/shutter.ts';
import { exportSizeDriver } from './export-size.ts';
import { exportFormatDriver } from './export-format.ts';
import { neutralizeEmbeds, hydrateEmbeds } from '../bridge/embed.ts';
import { createNetAPI } from '../bridge/net.ts';
import { attachCanvasCommit } from '../lib/canvas-commit.ts';
import {
  mountTableCellEditing,
  markdownSafeUrl,
  type TableEditOpts,
} from '../lib/table-canvas-edit.ts';
import { mountFilmstrip, type Filmstrip, type FilmstripSide } from '../lib/page-filmstrip.ts';
import { openShareDialog, type ShareDialogLolly } from '../components/share-dialog.ts';
// Above AUTO_PACK_MIN the address bar and Share dialog switch to the packed `z=` form
// (when shorter); the cost model owns that threshold so nothing drifts from syncUrl.
import {
  encodeModelParam,
  AUTO_PACK_MIN,
  costUrlState,
  BROWSER_TARGET,
  type ShareFidelity,
} from '../lib/url-budget.ts';
import { createUrlGauge, type UrlGauge } from '../lib/url-budget-gauge.ts';
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';
import {
  buildLollyFile,
  creatorFromProfile,
  LOLLY_MIME,
  LOLLY_EXT,
  type LollyLibraryAsset,
  type LollyToolBundle,
  type LollyToolTrust,
} from '../lib/lolly-pack.ts';
import type { BeamAssetRecord } from '../lib/beam-pack.ts';
import { ENGINE_VERSION, sha256Hex } from '@lolly/engine';
import '../styles/vendor-flatpickr.css'; // flatpickr base CSS in the `vendor` cascade layer (see that file)

// Type-only imports (erased at build). The `@lolly/engine` barrel re-exports
// values but not these type-only names, so they come straight from the engine
// internals - resolved by the bundler through the `.js` specifier convention.
import type {
  HostV1,
  AssetRef,
  ComposeAPI,
  ClipboardAPI,
  StateAPI,
  Profile,
} from '@lolly-tools/core/host-v1';
import type {
  InputModelItem,
  InputValue,
} from '../../../../engine/src/inputs.js';
import type { LoadedTool, ToolManifest, ToolRenderSpec } from '../../../../engine/src/loader.js';
import type { Runtime } from '../../../../engine/src/runtime.js';
import type { Unit } from '../../../../engine/src/units.js';

// The input + actions subsystems live in sibling modules (verbatim split of this
// file). They only `import type` back from here, so these value imports don't cycle.
import { icon } from '../lib/icons.ts';
import { navigateTo } from '../nav.ts';
import { asRow } from './tool-types.ts';
import {
  resolveCanvasFastCfg,
  geometryFastPathPlan,
  boundEndpointIds,
  type FastPathCfg,
} from './canvas-scene.ts';
import type { Box } from './free-canvas-math.ts';
import { migrateCarouselToFrames } from './free-canvas-math.ts';
import { encodeBlocksCompact } from '../lib/blocks-url.ts';
import { setupStageNav, type StageNav } from './tool-stage-nav.ts';
import { isTextEditingTarget } from '../lib/typing-target.ts';
import {
  syncInputs,
  openEmbedEditor,
  scrollToControl,
  focusSidebarBlock,
  fileToRef,
  fmtBytes,
  makeBlocksDropper,
  _sliderDragging,
  asStr,
  stopSlotPreview,
} from './tool-inputs.ts';
import {
  createLiveControls,
  registerLiveControls,
  mountSidebarLiveControls,
} from './live-controls.ts';
import { mountCaptureSignin } from './capture-signin.ts';
import { armViewEnter } from '../view-enter.ts';
import {
  renderActions,
  captureThumbnail,
  extFor,
  isCmykFmt,
  isPrintFmt,
  printEnabled,
  marksToCsv,
  c2paDefaultOn,
  readBleed,
  readMarks,
  exportTargetNode,
} from './tool-actions.ts';

import { setupCanvasFileDrop, setupCanvasBlocksDrop } from './tool-canvas-drop.ts';
export type { ExportUnscaled } from './tool-action-helpers.ts';
// ── Shell-side type aliases (all erased at build; no runtime effect) ──────────

/** The view root; the router reads back a `_cleanup` teardown hook off it. */
type ViewEl = HTMLElement & { _cleanup?: () => void };

/** `render.transcribe` - the manifest's speech-to-text declaration (v1.150). */
type TranscribeSpec = NonNullable<ToolRenderSpec['transcribe']>;

/**
 * The declaration a mounted tool's Transcribe affordance acts on, or null when
 * it must not mount: no declaration, a shell without on-device speech (the
 * CLI), or a spec naming inputs the manifest does not declare (a typo - the
 * button would write nowhere). A module-scope helper rather than an IIFE in
 * mountTool: the team-origin contract test forbids bare returns between the
 * origin consume and the teardown hook (tool-team-origin.test.ts).
 */
function resolveTranscribeSpec(
  tool: { manifest: ToolManifest },
  host: WebToolHost
): TranscribeSpec | null {
  const spec = (tool.manifest.render as { transcribe?: TranscribeSpec } | undefined)?.transcribe;
  if (!spec?.source || !spec.target) return null;
  let available = false;
  try {
    available = host.speech?.transcribeAvailable?.() === true;
  } catch {
    /* stays false */
  }
  if (!available) return null;
  const ids = new Set((tool.manifest.inputs ?? []).map((i) => i.id));
  return ids.has(spec.source) && ids.has(spec.target) ? spec : null;
}

/** Content Credentials device-identity status (a web-only host helper). */
export interface IdentityStatus {
  enrolled?: boolean;
  expired?: boolean;
  notAfter?: string;
  daysLeft?: number;
  identity?: { email?: string } | null;
}

/** The picker's "detected tool" description (compose._describeUrl). */
export interface EmbedDescribe {
  name: string;
  formats: string[];
  format: string;
  width?: number;
  height?: number;
  unit?: string;
  dpi?: number;
}

/**
 * The web shell's host as this view consumes it: the tool-facing HostV1 plus the
 * web-only helpers tool.js reaches for directly - clipboard.writeHtml, state.save's
 * thumbnail arg, identity (Content Credentials device cert) and compose._describeUrl
 * (the embed editor). WebHost in bridge/index.ts isn't exported, so we describe just
 * the members used here (each is a real member of the assembled bridge).
 */
export type WebToolHost = HostV1 & {
  clipboard: ClipboardAPI & { writeHtml(html: string): Promise<void> };
  state: StateAPI & { save(slot: string, data: object, thumb?: string | null): Promise<void> };
  identity?: { status(): Promise<IdentityStatus> };
  compose?: ComposeAPI & { _describeUrl(url: string): Promise<EmbedDescribe | null> };
  designSystems?: ToolDesignSystemRegistry;
};

/**
 * The runtime plus the un-historied setter mountTool bolts on so renderActions'
 * programmatic px-sync can set inputs without the change landing in undo history.
 */
export type ToolRuntime = Runtime & { setInputNoHistory?: Runtime['setInput'] };

/** The header (or editor-rail) ↶/↷ pair the history helpers drive. */
interface HistoryControls {
  sync(canUndo: boolean, canRedo: boolean): void;
}

/** The sidebar/actions panel element with the document-level dismissers renderInputs parks on it. */
export interface PanelEl extends HTMLElement {
  _colorPopoverDismiss?: (e: MouseEvent) => void;
  _blockMenuDismiss?: (e: MouseEvent) => void;
  _helpTipDismiss?: (e: MouseEvent) => void;
  /** The audio-slot waveform enhancer parked by renderInputs - holds an
   *  IntersectionObserver and in-flight decodes, so it is destroyed and rebuilt on
   *  every re-render and released by _inputsDispose. */
  _audioThumbs?: { destroy(): void };
  /** Aggregate disposer renderInputs maintains: removes the document-level capture
   *  dismissers above and destroys the panel's flatpickr instances. The ONE call
   *  every consumer's teardown makes (tool view, embed editor, multi-edit). */
  _inputsDispose?: () => void;
}
/** A flatpickr-enhanced input carries its instance for teardown. */
export interface FlatpickrHost extends HTMLInputElement {
  _flatpickr?: { destroy(): void; altInput?: HTMLInputElement };
}

/** The print-mark toggle map carried on the export bar and in the `marks` param. */
export interface PrintMarks {
  crop: boolean;
  registration: boolean;
  bleed: boolean;
  colorBars: boolean;
  provenance: boolean;
}

/** Export defaults restored from the URL / a saved session (see mountTool). */
export interface ExportDefaults {
  filename?: string;
  format?: string;
  width?: number;
  height?: number;
  unit?: string;
  dpi?: number;
  profile?: string;
  password?: string;
  bleed?: string;
  marks?: PrintMarks | null;
  nostage?: boolean;
  c2pa?: { on: boolean; days?: number | null };
  /** Pixel-watermark setting from ?imprint= - on by default (like c2pa) for
   *  raster exports; false only for an explicit `imprint=0`/`off` link. */
  imprint?: boolean;
  /** Generator-metadata toggle from ?meta=off - strips the source-attribution field
   *  from formats with no C2PA container (EPS/DXF/EMF; EXR/Radiance via the primitive).
   *  On by default; false only for an explicit opt-out. */
  metadata?: boolean;
  /** Opt-in durable Content Credential (neural TrustMark embed) from ?durable=1.
   *  OFF by default - a heavier per-export neural encode + one-time model fetch.
   *  Raster formats only. */
  durable?: boolean;
  /** Opt-in HDR (Rec.2100 PQ) raster export from ?hdr=1. OFF by default; raster only. */
  hdr?: boolean;
  /** HDR author dials to seed the export-panel sliders (from a tuned `hdr=` value). */
  hdrTune?: HdrSettings;
  /** Requested export bit depth from ?depth= (8/16/float/auto). 'auto' (the
   *  default) is left undefined here - only a real request is carried. A REQUEST,
   *  not a promise: depth follows provenance at the consumer. */
  depth?: DepthSetting;
  /** Video export controls from ?fps=/?seconds=/?wait=/?codec=/?vq= - the URL form of
   *  the panel's Frame rate, Duration, Start after, Codec and Quality. A `seconds`
   *  given here is a deliberate length (the panel treats it as user-set). Undefined
   *  when the link carried none of the five. */
  video?: VideoUrlSettings;
  /** The deck state address from ?s= (plan 112): a 1-based slide position, a frame id,
   *  or either with an `.N` build suffix. A STILL export of a framed document renders
   *  only that slide (`?s=2&format=png` is a per-slide image link); the engine's
   *  frame-address.ts resolves it, so the CLI's `--s=` selects the same page. Undefined
   *  ⇒ the whole per-slide fan-out, unchanged. */
  slide?: string;
}

/**
 * mountTool's strip-scale → export → reapply wrapper (injected into renderActions).
 *
 * `fn` is handed a `report` sink: pass it through as the export's own onProgress
 * and the shutter's status block shows real percent instead of a bare clock. A
 * zero-arg `() => runtime.export(...)` stays assignable, so the fast paths that
 * have nothing to report need no change. Optional because a test stub standing in
 * for this wrapper won't supply one - always call it as `report?.(…)`.
 *
 * `onCancel` turns the status block's escape hatch into a real Cancel: the caller
 * owns the AbortController whose signal it passed into the export opts, and this
 * only hands the abort to the button. Omit it and the button stays Hide.
 */
/** What renderActions hands back for programmatic triggering (`?copy`, Save & leave…). */
export interface ActionsApi {
  copy?: (fmtOverride?: string) => Promise<{ method: string } | void>;
  preview?: () => Promise<void>;
  save?: (btn?: HTMLElement | null, opts?: { folderId?: string | null }) => Promise<boolean>;
  setDims?: (dims?: { width?: number; height?: number; unit?: string; dpi?: number }) => void;
  setFormat?: (fmt: string) => void;
  /** Narrow the export format bar to a mode/effect select option's `formats`
   *  (see exportFormatDriver). Keeps the current pick when it survives. */
  setFormats?: (allowed: string[]) => void;
  /** Refresh the Design outcome summary and focused format list after a template
   * or outcome switch, without rebuilding the export sheet. */
  setExperience?: (experience: ExportExperience) => void;
  stopAudioPreview?: () => void;
  /** The exact record a Save would write - input values plus the `__` markers (tool
   *  identity and the export bar's format/size/unit/DPI/profile/bleed/marks). Read by
   *  the beam (`views/tool-collab.ts`), which builds its own values off the live model
   *  and takes only the `__export_*` half: those markers live in this panel's DOM and
   *  nowhere else, so a session sent without them reopens at tool defaults. */
  sessionState?: () => Record<string, unknown>;
  /** The saved-session slot this panel writes to: the resumed session's slot, or
   *  the one the first save minted, or null before any save. Read by the Save
   *  dialog to preselect the project the session is ALREADY filed in (plans/142 W1). */
  getSlot?: () => string | null;
  /** Tear down the cost-authoring slot: unsubscribe the registry-change listener
   *  and run the hydrated extension's disposer. Called from mountTool's cleanup. */
  dispose?: () => void;
}

/** Optional outcome guidance layered over the generic export pipeline. */
export interface ExportExperience {
  recommendedFormats?: readonly string[];
  summary?: string;
  downloadLabel?: string;
}

/** Session-only metadata that belongs beside `__export_*`, never in tool inputs. */
export interface ActionsExperience {
  current?: () => ExportExperience;
  sessionMeta?: () => Record<string, unknown>;
}

/** A shared monotonic bar-write guard (a holder object so shrinkUrl can share it). */
interface BarSeq {
  v: number;
}

/** The lottie-mount module, loaded lazily and kept for reaping. */
type LottieModule = typeof import('./lottie-mount.ts');
/** The video-mount module, loaded lazily the first paint that emits a keyed <video>. */
type VideoModule = typeof import('./video-mount.ts');
/** The animated-SVG enhancer, loaded lazily the first paint that emits a [data-anim-src]
 *  marker (fetch + DOMPurify are its own chunk). */
type AnimSvgModule = typeof import('./anim-svg-mount.ts');
/** The MilkDrop enhancer, loaded lazily the first paint that emits a [data-lolly-viz]
 *  placeholder - butterchurn and the preset builders are a chunk of their own. */
type VizModule = typeof import('../lib/viz-tool-mount.ts');

/**
 * The superset of export options this view assembles and hands to runtime.export -
 * the engine's ExportOpts plus the web-shell timing/print/provenance extensions the
 * export bridge reads. Permissive on purpose so the spread/assignment builders below
 * typecheck without changing what's passed at runtime.
 */
export interface RunExportOpts {
  width?: number | string;
  height?: number | string;
  quality?: number;
  background?: string;
  /** The clip length was asked for (a link's ?seconds=, or the panel's typed value):
   *  a tool hook that lengthens a clip to its material must leave it alone. */
  durationUserSet?: boolean;
  dpi?: number;
  scale?: number;
  embedMeta?: boolean;
  thumbnail?: boolean;
  colorProfile?: string;
  palette?: unknown;
  fullPage?: boolean;
  password?: string;
  strongPassword?: string;
  c2pa?: boolean;
  c2paDays?: number;
  imprint?: boolean;
  /** Opt-in durable Content Credential (neural TrustMark mark) for raster exports. */
  durable?: boolean;
  /** EMF text mode (the export panel's "Outline fonts" chip; same values as the
   *  CLI --text flag). EMF defaults to live GDI text records; 'outline' forces
   *  text-as-paths. Other formats ignore it. */
  text?: 'outline' | 'live';
  durableId?: number;
  /** Normalize the exported mix to a target integrated loudness, LKFS (the export
   *  bar's Off / -14 / -16 / -23 select). Undefined = off. */
  normalize?: number;
  /** Opt-in HDR (Rec.2100 PQ) raster export from ?hdr=1. Raster (png/jpeg/avif/tiff) only. */
  hdr?: boolean;
  /** HDR author dials (export-panel sliders): white peak (nits) + 0–100 reach/lift/richness. */
  hdrPeakNits?: number;
  hdrReach?: number;
  hdrLift?: number;
  hdrRichness?: number;
  /** Requested export bit depth from ?depth= (8/16/float). Absent ⇒ 'auto'. A
   *  request only - the export bridge emits deep bits solely where the pipeline
   *  produced them (plans/61-deeprichpixels.md section 10). */
  depth?: DepthSetting;
  bleed?: string;
  cropMarks?: boolean;
  registrationMarks?: boolean;
  bleedMarks?: boolean;
  colorBars?: boolean;
  provenance?: boolean;
  /** Colour-bar style: 'rgb-swatches' (brand colours as single RGB cells) for RGB
   *  output; 'cmyk-verify' (RGB+CMYK press pairs) for CMYK. See print-marks.ts. */
  barStyle?: 'cmyk-verify' | 'rgb-swatches';
  /** Colour-bar cell corner radius (pt), from the brand `--radius`. */
  barRadiusPt?: number;
  dither?: boolean;
  fps?: number;
  /** WP-B video quality stop (export card). Maps to a bits-per-pixel target in the
   *  bitrate authority; 'balanced' is the default and equals the historical rate.
   *  Distinct from `quality` (the 0..1 JPEG/WebP knob). */
  videoQuality?: 'smaller' | 'balanced' | 'best';
  /** WP-B explicit video codec (pro-settings picker): a WebCodecs codec string such
   *  as 'av01.0.08M.08' / 'hvc1.1.6.L93.B0' / 'avc1.640033'. Absent ⇒ the auto ladder.
   *  Honoured only where it probes supported in the chosen container. */
  videoCodec?: string;
  /** WP-B pro-settings: VBR (default) vs CBR, and the hardware-acceleration hint. */
  bitrateMode?: 'variable' | 'constant';
  hardwareAcceleration?: 'no-preference' | 'prefer-hardware' | 'prefer-software';
  wait?: number;
  duration?: number;
  live?: boolean;
  audio?: ExportAudio;
  filename?: string;
  bundleFormats?: string[];
  convertPaths?: boolean;
  /** Progress callback for slow exports (CMYK TIFF pass, SVG/PDF vector walk).
   *  The engine/bridge emit it; the export UI uses it to update the button label. */
  onProgress?: (done: number, total: number) => void;
  /** Cancellation (engine 1.141 ExportOpts.signal): the frame loops, the CMYK row
   *  pass, the vector walks and the sequence compositor poll it and reject with an
   *  AbortError. Set by the shuttered export paths, whose Cancel button aborts it. */
  signal?: AbortSignal;
}

function marksFromCsv(csv: string | null | undefined): PrintMarks | null {
  if (!csv) return null;
  const s = new Set(
    String(csv)
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean)
  );
  return {
    crop: s.has('crop'),
    registration: s.has('reg') || s.has('registration'),
    bleed: s.has('bleed'),
    colorBars: s.has('bars') || s.has('colorbars'),
    provenance: s.has('prov') || s.has('provenance'),
  };
}

// Undo/redo glyphs for the history toast (Lucide undo-2 / redo-2). App chrome,
// not exported, so currentColor is safe here (unlike tool-template SVGs).
const ICON_UNDO =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11"/></svg>';
const ICON_REDO =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5 5.5 5.5 0 0 0 9.5 20H13"/></svg>';

// Prompt (client-side, no server) for the password on an encrypted `zx` link and
// return the decrypted READABLE query. Loops on a wrong password; on cancel returns
// the original query unchanged (zx is reserved → parseUrlState ignores it → the tool
// loads at defaults). Readable params riding alongside zx (on-visit flags) are
// re-appended after the decoded state so they still apply - mirroring expandQuery.
// One navigation can mount twice (popstate + hashchange), so the prompt is shared
// per token via this in-flight map - the user never sees two stacked dialogs.
const zxInFlight = new Map<string, Promise<string>>();
async function decryptEncryptedLink(query: string): Promise<string> {
  const params = new URLSearchParams(query);
  const token = params.get(ENC_PARAM);
  if (!token) return query;
  const inFlight = zxInFlight.get(token);
  if (inFlight) return inFlight;
  const run = (async (): Promise<string> => {
    let error: string | undefined;
    for (;;) {
      const pw = await promptDialog({
        title: t('Password-protected link'),
        message: t(
          'This Lolly link is locked. Enter its password to open it here - nothing is sent to a server.'
        ),
        confirmLabel: t('Open'),
        inputType: 'password',
        placeholder: t('Password'),
        error,
      });
      if (pw == null) return query; // cancelled → load at defaults
      const decoded = await unpackEncrypted(token, pw);
      if (decoded != null) {
        const extras: string[] = [];
        params.forEach((v, k) => {
          if (k === ENC_PARAM) return;
          extras.push(
            v === '' ? encodeURIComponent(k) : `${encodeURIComponent(k)}=${encodeURIComponent(v)}`
          );
        });
        return extras.length ? `${decoded}&${extras.join('&')}` : decoded;
      }
      error = t('Incorrect password - try again.'); // wrong → re-prompt
    }
  })();
  zxInFlight.set(token, run);
  try {
    return await run;
  } finally {
    zxInFlight.delete(token);
  }
}

export async function mountTool(
  viewEl: ViewEl,
  host: WebToolHost,
  toolId: string,
  urlParams: string | null | undefined
): Promise<void> {
  // FIRST, and before any early return: the Team-projects open stashed the instance's id
  // for the session it is navigating into, and that stash is bounded by "the next mount
  // spends it" - so a mount that 404s or fails to load must spend it too, or an unrelated
  // later mount of the same tool would inherit it. Returns the origin, but the module
  // holds it for this mount (released in _cleanup), so nothing is threaded through the
  // view. Null for every mount that is not a team-session open, which is nearly all.
  //
  // SPENDING IS NOT THE WHOLE JOB, and this is the half that is easy to lose: a matching
  // consume also PROMOTES the origin to the module's live slot, and the only release is
  // in `_cleanup` - which is not assigned until ~1500 lines below, once the mount is
  // fully built. Every abandoned mount between here and there (a 404, an offline load, a
  // validation failure, a capability this shell cannot fulfil) therefore used to leave an
  // origin live with nothing to release it: `navigate()` calls `view._cleanup?.()` and
  // this view had given it none, so the id survived until some later mount of a DIFFERENT
  // tool cleared it - and in the meantime the Share dialog over an unrelated LOCAL session
  // of the SAME tool read it and keyed a work collab on a stranger's session. That is
  // exactly the "present and wrong" id `org/team-session-origin.ts` exists to prevent
  // (its rule 3), so each of those paths releases before it returns, and
  // `views/tool-team-origin.test.ts` fails if a new one forgets to.
  consumeTeamSessionOrigin(toolId);
  const mountLifecycle = new MountLifecycle({
    onDisposeError: (name, error) => console.error(`[tool] ${name} teardown:`, error),
  });

  // A sideloaded tool (installed from a .lolly) lives in a device-local bucket, not the
  // catalog. When one is installed it loads from that bucket with NO signed-catalog
  // integrity check - the recipient's catalog has no authority over it, and its bytes
  // were verified at import (lib/installed-tools.ts). Resolved before the existence check
  // so a deep link to an installed tool is never 404'd for being absent from the catalog.
  const installed = await isToolInstalled(toolId).catch(() => false);

  // If the catalog is loaded, do a fast existence check before fetching anything.
  const catalog = (window as Window & { __toolIndex?: { tools?: { id: string }[] } }).__toolIndex;
  if (!installed && catalog?.tools && !catalog.tools.some((t) => t.id === toolId)) {
    mount404(viewEl, toolId);
    releaseTeamSessionOrigin();
    return;
  }

  const fetchFile = installed ? installedFetchFile(toolId) : makeFetchFile(toolId);

  // Defer the loading screen so prefetched tools don't flash the gallery out.
  // The gallery stays visible until the tool is ready (or 400ms passes).
  const loadingTimer = setTimeout(() => {
    viewEl.innerHTML = `<p class="loading">${t('Loading…')}</p>`;
  }, 400);

  let tool: LoadedTool;
  try {
    // The loader takes a plain fetchFile with no abort handle, so a hung request
    // would leave an infinite "Loading…". Guard the whole load with a timeout that
    // rejects with a network-shaped error, so it flows through the SAME offline /
    // recoverable branch below (the Retry + "Browse all tools" card) as any other
    // fetch failure - no separate error path.
    const LOAD_TIMEOUT_MS = 15000;
    let loadTimer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      loadTimer = setTimeout(
        () => reject(new Error('Failed to fetch tool - network timeout')),
        LOAD_TIMEOUT_MS
      );
    });
    try {
      tool = await Promise.race([
        loadTool(toolId, fetchFile, {
          lang: currentLang(),
          integrity: installed ? undefined : ((await getToolIntegrity()) ?? undefined),
          trustClass: installed ? 'sideloaded-consented' : undefined,
        }),
        timeout,
      ]);
    } finally {
      clearTimeout(loadTimer);
    }
    clearTimeout(loadingTimer);
  } catch (e) {
    clearTimeout(loadingTimer);
    const err = e as { message?: string; validationErrors?: { path: string; message: string }[] };
    if (err.message === 'tool-not-found') {
      mount404(viewEl, toolId);
      releaseTeamSessionOrigin();
      return;
    }
    const errs = err.validationErrors?.length
      ? `<ul class="error-list">${err.validationErrors
          .map((ve) => `<li><code>${escape(ve.path)}</code> - ${escape(ve.message)}</li>`)
          .join('')}</ul>`
      : '';
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (
      !err.validationErrors?.length &&
      (offline || /fetch|network|load|failed to fetch/i.test(String(err.message || '')))
    ) {
      // Offline-first PWA: a network load failure should be recoverable, not a raw dead-end.
      viewEl.innerHTML =
        `<div class="error"><strong>${offline ? t('You’re offline') : t('Couldn’t load this tool')}</strong>` +
        `<p>${offline ? t('Reconnect, then try again.') : t('Check your connection, then retry.')}</p>` +
        `<div class="error-actions" style="margin-top:12px;display:flex;gap:8px;justify-content:center">` +
        `<button class="btn" data-retry>${t('Retry')}</button><a class="btn" href="/#/">${t('Browse all tools')}</a></div></div>`;
      viewEl.querySelector('[data-retry]')?.addEventListener('click', () => location.reload());
      releaseTeamSessionOrigin();
      return;
    }
    viewEl.innerHTML = `<div class="error"><strong>${escape(err.message)}</strong>${errs}</div>`;
    releaseTeamSessionOrigin();
    return;
  }

  // Guard direct links: if the tool needs a capability this shell can't fulfil,
  // show the right panel instead of mounting it into a broken state - on a
  // Chromium browser a capture tool offers the extension ('install'); otherwise
  // "desktop only" ('unavailable').
  const sup = toolSupport(tool.manifest, host.capabilities, presentApis(host));
  // A capture tool on a Chromium browser without the extension: MOUNT it anyway.
  // url-shot's visual composer + recipe output need no capture - only EXPORT does -
  // so a full-screen gate would hide a core authoring surface. Mount the tool and
  // steer to the extension/desktop for the actual capture with a dismissible banner
  // (below). A genuinely unavailable capability (non-Chromium, or a non-capture
  // need) still can't run here at all.
  const captureHint = sup.status === 'install';
  // `mountUnavailable` renders a card and installs no `_cleanup`, so the origin is let go
  // here rather than at a teardown that will never run (see the consume above). This is
  // the reachable case, not a theoretical one: a team session of a `capture` tool opened
  // on Safari or Firefox lands exactly here, and `openTeamSession` arms the stash without
  // consulting capabilities.
  if (sup.status === 'unavailable') {
    mountUnavailable(viewEl, tool.manifest, sup.unmet);
    releaseTeamSessionOrigin();
    return;
  }

  // A manifest `network.allowlist` gives THIS mount a host clone whose `net`
  // enforces exactly that list - the boot-time shared host keeps its fail-closed
  // empty allowlist and is never mutated (bridge methods are closures, not
  // `this`-bound, so a shallow spread is safe). Everything below - runtime,
  // hooks, actions - uses the clone; tools without the field see no change.
  if (tool.manifest.network?.allowlist?.length) {
    host = { ...host, net: createNetAPI({ allowlist: tool.manifest.network.allowlist }) };
  }

  // section 6.2a/section 11.17: an ACCEPTOR's working copy must never reach a slot on their device.
  // The ruling was one interception point rather than an audit of every save call site,
  // and this is it - a memory-backed `host.state`, armed by the mount before the route
  // was entered. The clone rides the SAME rule as the allowlist clone above (bridge
  // methods are closures, not `this`-bound), and it must land HERE: before the `slot`
  // load, before `createRuntime`, and before the actions bar is built, so every save
  // path in this view and in the tool's own actions is looking at one object. One-shot
  // and null for every mount that is not an ephemeral collab, which is all of them
  // until somebody accepts an invite.
  const ephemeralState = takeEphemeralState(toolId);
  // The bridge as it was BEFORE the swap, kept because exactly one thing still needs the
  // real store on an acceptor's mount: a beam they were asked about and accepted. section 11.17
  // is about their borrowed copy of the inviter's document; a gift is not that, and section 6.4
  // promises it lands in their library. The same object for every other mount, so this
  // costs a reference. NOTHING ELSE may use it - every save path in this view and in the
  // tool's own actions goes through `host`, which is the whole point of the interception.
  const libraryHost = host;
  if (ephemeralState) host = { ...host, state: ephemeralState };

  // Source the colour picker's swatches from design tokens (the canonical brand
  // colours), so choosing one keeps the value linked to the token. Falls back to
  // the built-in palette if tokens aren't available (offline first load, or a
  // shell without host.tokens). Best-effort - never blocks mounting the tool.
  try {
    const swatches = await host.tokens?.colors?.();
    if (swatches?.length) {
      setSwatches(
        swatches.map((s) => ({ value: s.value, label: s.name, group: s.group, ref: s.ref }))
      );
    }
  } catch {
    /* keep the built-in palette */
  }

  // Annotate the template once so rendered nodes carry data-canvas-input attrs
  // for click-to-focus. This is purely a shell-side concern; the engine just
  // stores the modified source and hydrates it like any other template.
  const inputIds = (tool.manifest.inputs ?? []).map((i) => i.id);
  tool.template = annotateTemplate(tool.template, inputIds);
  document.title = tRaw('{name} - Lolly', { name: tool.manifest.name });

  // A password-gated link (`?zx=…`) carries the whole state ENCRYPTED. Prompt for
  // the password client-side (no server), decrypt to the readable query, and carry
  // on. Cancel or give up → leave it (zx is reserved, so parseUrlState ignores it
  // and the tool loads at defaults). Runs before expandQuery so the rest is unchanged.
  // If it decrypts, remember the ORIGINAL encrypted query so the address bar keeps
  // showing a protected link (see syncUrl) until the user edits - otherwise the first
  // auto-sync would rewrite the bar to the cleartext state, silently downgrading the
  // shared link to an unprotected one.
  let encLinkQuery: string | null = null;
  if (hasEncryptedState(urlParams)) {
    const original = urlParams!;
    urlParams = await decryptEncryptedLink(urlParams!);
    if (!hasEncryptedState(urlParams)) encLinkQuery = original;
  }

  // A packed link (`?z=…`) carries the whole state compressed; expand it back into a
  // plain query BEFORE anything reads it (parse, flag detection, dirty-param seed).
  // A no-op for ordinary readable links. Done once so every consumer below agrees.
  urlParams = await expandQuery(urlParams ?? '');

  const {
    values,
    format: urlFormat,
    export: autoExport,
    copy: autoCopy,
    slot: routeSlot,
    filename: urlFilename,
    width: urlWidth,
    height: urlHeight,
    unit: urlUnit,
    dpi: urlDpi,
    profile: urlProfile,
    password: urlPassword,
    bleed: urlBleed,
    marks: urlMarks,
    c2pa: urlC2pa,
    imprint: urlImprint,
    metadata: urlMetadata,
    durable: urlDurable,
    hdr: urlHdr,
    depth: urlDepth,
    video: urlVideo,
    designSystem: urlDesignSystem,
  } = parseUrlState(urlParams, tool.manifest);
  const automationPassword = await takeAutomationExportPassword(Boolean(autoExport), urlPassword);
  // Starting a collab force-remounts this tool, and the route it remounts through is a
  // LOSSY encoder twice over: `buildShareParams` skips `user/` asset ids and anything
  // past 150 chars, `syncUrl` writes only dirty params, skips `file` inputs, and never
  // re-adds `slot`. So the outgoing mount hands its live model and its slot over in
  // memory (see this file's _cleanup, and lib/collab-live-mount.ts's header) and the
  // remount spends them here - an uploaded logo, a picked file and a long paragraph
  // survive because nothing was serialised. Null for every mount that is not that
  // remount. The values are applied below, ON TOP of the route: they are the same
  // model the route was encoded from, only complete.
  const carriedMount = takeCarriedMountState(toolId);
  // The bar drops `slot` on the first edit, so the route alone would open the collab as
  // a FRESH session and the inviter's first Save would mint a duplicate beside the one
  // they were collaborating on (section 6.2a pins a private collab to the session it started
  // from). The route still wins when it names one.
  const slot = routeSlot ?? carriedMount?.slot ?? undefined;
  const urlFlags = new URLSearchParams(urlParams || '');
  const isFull = urlFlags.has('full');
  // `?template=<id>` launches straight into a template starting point, SKIPPING the "New
  // from template" chooser - the on-ramp for a retired tool id or a deep link. Reserved
  // (so it's never a tool input and never counts toward the blank check below); the heavy
  // `values` seed is FETCHED in-process from the external file (tools/<id>/templates/
  // <id>.json), never packed into the URL. An unknown id is a null fetch → falls through
  // to the normal fresh-open flow (chooser or blank).
  const templateParam = urlFlags.get('template');
  // `?preset=<pid>` (plans/142): a curated values overlay INSIDE the named template
  // (`?template=poster&preset=story`). Only meaningful alongside `template`.
  const presetParam = urlFlags.get('preset');
  // Reached via a link when the boot URL carried ANY tool configuration - a share,
  // a bookmark, an `?options`/`?full` deep link. The cost panel keys its degrade on
  // this (money-policy `selectionFromUrl`): a link always opens on counts, and money
  // is revealed only by an explicit per-device action (section 5). A card is NEVER a URL
  // param, so this can never let a link ORIGINATE a money view - it can only withhold.
  const reachedViaLink = isFull || urlFlags.size > 0;
  // `?nostage` pre-checks the export panel's "Full page" toggle (HTML export only):
  // the saved page drops the fixed-size canvas frame and fills the whole window.
  const urlNostage = urlFlags.has('nostage');
  // `?options` lands the recipient on the export-settings panel expanded (instead
  // of the collapsed Render button). `full` collapses ALL chrome to the bare
  // preview - the opposite intent - so it wins when both are present, matching the
  // CSS, which hides the export panel whenever its host sidebar is collapsed.
  const showExportPanel = !isFull && urlFlags.has('options');
  // Presentation mode (plan 112): `?present` opens a frame document as a fullscreen,
  // click-advanced deck; `?s=` deep-links a slide (1-based position, frame id, or `h.f`);
  // `?kiosk` makes it signage. All three are engine-reserved (url-mode.ts RESERVED) -
  // `kiosk` was the unreserved `loop` flag until plan 171's freeze-day rename, because
  // `loop` is a live input id in other tools and could never be reserved.
  const isPresent = urlFlags.has('present');
  const presentAddress = urlFlags.get('s');
  // `let`, not const: the Design top bar's Loop row flips it and rewrites the URL, so the
  // flag the next openPresenter() reads is the one the author just chose (plan 179 M1).
  let presentLoop = urlFlags.has('kiosk');

  let initialValues: Record<string, InputValue> = values;
  if (slot) {
    let saved = await host.state.load(slot);
    // A retired carousel-maker session redirects into Design (`?template=carousel&slot=`):
    // reshape its flat page-strip model into `kind:"frame"` artboards so per-artboard
    // image-sequence export survives the fold. A pure no-op for a native Design session
    // (no pages/pageW/pageH) or an already-framed doc, and SCOPED to Design so it never
    // rewrites carousel-maker's own resume while that tool still exists.
    // (migrateCarouselToFrames - free-canvas-math.ts)
    if (saved && toolId === 'design') {
      saved = migrateCarouselToFrames(saved as Record<string, unknown>) as typeof saved;
    }
    if (saved) initialValues = { ...saved, ...values };
  }
  // The carried model wins outright, and only here. It is not a competing source of
  // truth - it is the SAME model the route and the slot were both encoded from, one
  // step later and with nothing dropped, so anything it disagrees with is a value one
  // of the encoders could not represent. Applied before `createRuntime` so the runtime
  // is BORN with it: a patch after mount would render twice and run `onInit` against
  // the wrong model.
  if (carriedMount)
    initialValues = { ...initialValues, ...(carriedMount.values as Record<string, InputValue>) };

  // Design is one canvas with several likely outcomes. This small UI-only intent
  // selects chrome and export defaults; it never changes the engine render path.
  // In particular, the Poster template intentionally remains `general`: modern
  // posters are often digital, so no print semantics are inferred from that name.
  let designIntent: DesignIntent =
    toolId === 'design'
      ? inferDesignIntent({
          saved: initialValues.__workspace_intent,
          templateId: templateParam,
          boxes: initialValues.boxes,
        })
      : 'general';
  if (toolId === 'design') viewEl.dataset.designIntent = designIntent;
  let refreshDesignExperience = (_pickDefault = false): void => {
    /* armed after the export panel mounts */
  };
  let syncDesignIntentChrome = (): void => {
    /* armed with the Design top bar */
  };
  let applyDesignIntentLayout = (_outcome: ReturnType<typeof designOutcome>): void => {
    /* armed with editor chrome */
  };
  const setDesignIntent = (intent: DesignIntent, pickDefault = false): void => {
    if (toolId !== 'design') return;
    designIntent = intent;
    refreshDesignExperience(pickDefault);
  };

  // A one-shot seed armed by the drop router's layered-import route (psd-import
  // stores the layer assets, then stashes the block rows + canvas size here).
  // Consumed generically - tool.ts knows nothing about PSD. URL/saved values
  // still win per key: the seed route always arrives on a bare hash, so in
  // practice the seed applies whole; a crafted link's own params keep priority.
  let seededDirect = false;
  {
    const { takePendingToolFile, takePendingToolSeed } = await import('../lib/drop-router.ts');
    const seed = takePendingToolSeed(toolId);
    if (seed) {
      initialValues = { ...(seed as Record<string, InputValue>), ...initialValues };
      seededDirect = true;
    }
    // A native file-manager utility verb already chose both the tool and file.
    // Seed its declared file input before the runtime is born, exactly like the
    // layered-file seed above, so onInit sees the right source and no empty-state
    // frame flashes first. Explicit URL/session values retain precedence.
    const directFile = takePendingToolFile(toolId);
    const directInput = tool.manifest.inputs?.find((i) => i.type === 'file');
    if (directFile && directInput) {
      const ref = await fileToRef(directFile);
      initialValues = {
        [directInput.id]: directInput.multiple ? [ref] : ref,
        ...initialValues,
      } as Record<string, InputValue>;
      seededDirect = true;
    }
  }

  // ── "New from template" on-ramp (plans/94) ───────────────────────────────────
  // A tool offers template starting points as per-template files (tools/<id>/templates/
  // <tid>.json); the synced index carries their METADATA only. Two ways they seed a fresh
  // session - the heavy `values` is FETCHED on demand (a real frame template serialises to
  // many KB, so it is never packed into the URL):
  //   1. `?template=<id>` fetches that entry's values directly and skips the chooser.
  //   2. otherwise, a BLANK fresh open shows the chooser (live tile previews + on-select
  //      values fetch) and awaits a pick.
  // Emptiness is keyed off the parsed URL `values` (not `initialValues`, which the
  // profile-fill loop below mutates), so the check stays honest; a chosen/parameterised
  // seed still gets profile-filled on top because this runs BEFORE that loop. Skipped
  // entirely on a resume (`slot`), a URL-seeded open, or an in-process direct seed
  // (`seededDirect`) - those all carry their own intent.
  //
  // "URL-seeded" must include RESERVED params: `values` holds only tool inputs, so a
  // deep link carrying just reserved params (`?format=png&export=1`, `?full`, `?options`
  // …) has empty `values` yet clearly carries its own intent - `reachedViaLink` (any boot
  // param at all, or `?full`) is what captures that. Because the chooser is AWAITED before
  // createRuntime/autoExport, gating on it too is what keeps an auto-export or `?full`
  // embed link from hanging on a modal no human is there to dismiss. `?template=<id>`
  // still seeds directly (it also sets `reachedViaLink`, so it's handled here, not below).
  // Template METADATA (id/name/category/description/thumb - NO values) comes from the
  // synced index entry (build-catalog-index.ts scans tools/<id>/templates/*.json). The
  // heavy `values` seed lives in each external file and is FETCHED ON DEMAND below, so it
  // never rides the index or a URL. Fall back to an inline manifest `templates[]` if a
  // tool still authors one (the optional inline shape).
  const indexEntry = (
    window as Window & { __toolIndex?: { tools?: Array<{ id: string; templates?: unknown }> } }
  ).__toolIndex?.tools?.find((e) => e.id === toolId);
  const templateMeta: unknown = Array.isArray(indexEntry?.templates)
    ? indexEntry!.templates
    : Array.isArray(tool.manifest.templates)
      ? tool.manifest.templates
      : undefined;
  const hasTemplates = Array.isArray(templateMeta) && templateMeta.length > 0;
  /** The chooser's pick, resolved off the mount path (see the else-branch below). */
  let templatePick: Promise<Record<string, InputValue>> | null = null;
  // Navigate-away guard for the un-awaited chooser above: latched true by _cleanup, so
  // the pick handler below can tell a resolution apart from a torn-down mount, and - the
  // chooser having started but not yet opened when the view is torn down - from a modal
  // that must never open at all. `templatePickClose` is armed once the modal actually
  // exists (`onOpen`, below); _cleanup calls it to take the modal down with the view
  // instead of leaving it floating over whatever loads next.
  let templatePickTornDown = false;
  let templatePickClose: (() => void) | null = null;
  // A NAMED `?template=` seeds on its own authority - the values fetch decides
  // (unknown id → null → normal open). It must NOT gate on `hasTemplates`:
  // metadata rides `window.__toolIndex`, which only the gallery populates, so a
  // direct link, a share, or an OFFSCREEN export remount (the blank-PDF/MP4 bug:
  // scene and export renders re-parse the URL in a context with no index and no
  // inline manifest fallback) would silently drop the seed and render empty.
  if (templateParam && !slot && !seededDirect && Object.keys(values).length === 0) {
    const { fetchTemplateSeed, templateValuesById } = await import('./template-chooser.ts');
    let seed = await fetchTemplateSeed(toolId, templateParam, presetParam);
    if (!seed && Array.isArray(templateMeta))
      seed = templateValuesById(templateMeta, templateParam, presetParam);
    if (seed) initialValues = { ...seed, ...initialValues };
  } else if (
    !slot &&
    !seededDirect &&
    Object.keys(values).length === 0 &&
    (!reachedViaLink || templateParam === '')
  ) {
    // An EMPTY `?template=` (present, no id) is an explicit ask for the chooser - the
    // gallery card's "+ new" button navigates with it - so it overrides the
    // reachedViaLink skip that would otherwise read "?template=" as a deep link with
    // its own intent. Auto-export/`?full` links never carry a bare `template`, so the
    // no-modal-over-headless-export guarantee holds.
    // The chooser opens on a blank fresh open (no resume, no seed, no link) when the tool
    // has built-in templates OR the current user has saved templates/variations for this
    // toolId - so a tool whose only starting points are user-saved is still reachable. The
    // store's list() is async and this gate is sync, so when there are NO built-in templates
    // we resolve the user's own here to decide whether to open at all. A tool WITH built-in
    // templates always opens, so we skip that await and let the chooser promise below fetch
    // the user templates off the mount path (as it already did), keeping the fast path fast.
    let hasUserTemplates = false;
    if (!hasTemplates) {
      try {
        const { createUserTemplateStore } = await import('../lib/user-templates.ts');
        const mine = await createUserTemplateStore(
          host as unknown as Parameters<typeof createUserTemplateStore>[0]
        ).list(toolId);
        hasUserTemplates = mine.length > 0;
      } catch {
        /* user templates are best-effort - fall through to a blank open */
      }
    }
    // A design file dropped on the front door is the document: the drop route stashed
    // it and free-canvas imports it on mount, so the chooser must not open over it - a
    // template picked (or merely clicked through) under a running import replaces the
    // board and re-mounts the canvas, and the import finishes in a view that is gone.
    const { hasPendingDesignImport } = await import('../lib/drop-router.ts');
    if ((hasTemplates || hasUserTemplates) && !hasPendingDesignImport()) {
      // NOT AWAITED - and that is the whole point. This chooser used to sit between the
      // user and `createRuntime` below: the tool could not begin to mount until a human
      // clicked a tile, and the chooser's own live tile previews (a real off-screen tool
      // mount + walker export each, measured at ~1 s apiece, 4 s for Design's four
      // templates on a cache-cold device) burned the main thread in that same window. The
      // felt "Design takes forever to open" was almost entirely this.
      //
      // So the modal still opens at exactly this moment - it is started here, before any
      // of the mount work below - but the mount no longer waits on it. The tool paints and
      // becomes interactive underneath while the chooser sits on top, and the pick is
      // applied as a PATCH once it arrives (search "template chooser pick" below).
      //
      // The `?template=` branch ABOVE stays awaited on purpose: that seed is deterministic,
      // has no human in the loop, and off-screen export/scene remounts depend on the values
      // being in the model before the first hydrate.
      //
      // The chooser fetches each template's values file on demand - for the live tile
      // previews (host + formats) and for the final select - so the seed it resolves is
      // already the full input map, ready to merge.
      // A chooser failure (a bad template file, a stale chunk, a throw mid-render) must
      // never brick the mount - fall through to a blank open, which is what dismissing the
      // chooser means anyway. That is why the whole thing, the lazy import included, is
      // wrapped in one promise that resolves `{}` instead of rejecting.
      templatePick = (async () => {
        const { openTemplateChooser, parseTemplates } = await import('./template-chooser.ts');
        // A navigate-away while the chunk above was loading - the modal never got to
        // open, so there is nothing for `onOpen` below to arm a close over. Resolve
        // blank without opening it, exactly like a torn-down mount that arrives later.
        if (templatePickTornDown) return {};
        const templates = parseTemplates(templateMeta);
        // Merge the user's own saved templates for this tool. Same TemplateVariant shape, but
        // their `values` ride INLINE (stored on the profile), so the chooser renders + applies
        // them with no fetch - a picked one seeds the doc exactly like a built-in. One chip.
        try {
          const { createUserTemplateStore } = await import('../lib/user-templates.ts');
          const mine = await createUserTemplateStore(
            host as unknown as Parameters<typeof createUserTemplateStore>[0]
          ).list(toolId);
          for (const ut of mine)
            templates.push({
              id: ut.id,
              name: ut.name,
              category: t('Your templates'),
              values: ut.values as Record<string, InputValue>,
            });
        } catch {
          /* user templates are best-effort */
        }
        if (!templates.length) return {};
        return openTemplateChooser({
          toolName: tool.manifest.name,
          toolId,
          templates,
          host,
          formats: tool.manifest.render?.formats,
          // "Blank canvas" on a frame-based tool is the default document's artboards with
          // nothing on them, not the composed cover the default opens with (plan 179).
          blankSeed: () => {
            type FrameInput = {
              id: string;
              type?: string;
              default?: unknown;
              canvas?: { frameKind?: string; kindField?: string };
            };
            const inp = (tool.manifest.inputs as FrameInput[]).find(
              (i) => i.type === 'blocks' && !!i.canvas?.frameKind
            );
            const rows = Array.isArray(inp?.default)
              ? (inp!.default as Array<Record<string, unknown>>)
              : [];
            const kindField = inp?.canvas?.kindField ?? 'kind';
            const frames = rows.filter((r) => r && String(r[kindField]) === inp!.canvas!.frameKind);
            return frames.length ? { [inp!.id]: frames as unknown as InputValue } : {};
          },
          onPick: ({ templateId, category }) =>
            setDesignIntent(inferDesignIntent({ templateId, templateCategory: category }), true),
          // Arms the navigate-away close. If teardown landed in the same tick as the
          // modal's own construction (the race the check exists for), close immediately
          // instead of leaving a reference nobody will ever call.
          onOpen: (close) => { if (templatePickTornDown) close(); else templatePickClose = close; },
        });
      })().catch((e) => {
        host.log?.('warn', 'template chooser failed - opening blank: ' + String(e));
        return {} as Record<string, InputValue>;
      });
    }
  }

  // "+ New tool" from the Projects view leaves a sessionStorage marker so the first
  // FRESH session saved here files into the folder it launched from. Read it ONLY on a
  // fresh open (no resume `slot`) - otherwise a diverted "open the gallery, resume an
  // unrelated old session, save it" flow would capture it and misfile that session.
  // We READ (not remove) the marker: a hash navigation can mount the tool twice (a
  // browser fires popstate AND hashchange, which the router debounce can't fully
  // collapse), and a consume-on-mount would let the first mount swallow the marker
  // while the SECOND mount owns the live Save button. The marker is cleared instead
  // when the user lands on any non-tool view (main.js navigate). Used in performSave.
  let fileIntoFolder: string | null = null;
  if (!slot) {
    try {
      const into = sessionStorage.getItem('lolly:fileInto');
      if (into !== null) fileIntoFolder = into || null;
    } catch (e) {
      /* sessionStorage unavailable (private mode) */
    }
  }

  // Where the tool returns to when it leaves. The Projects view arms a marker (the
  // folder it launched from, e.g. `/#/p/<folderId>`) so a tool opened or resumed from a
  // folder saves and lands BACK in that folder; opening straight from the gallery leaves
  // no marker, so we fall back to '/' (the gallery). Read (not removed) here for the same
  // double-mount reason as fileIntoFolder above; cleared on the next non-tool mount.
  let returnTo = '/';
  try {
    const back = sessionStorage.getItem('lolly:returnTo');
    if (back) returnTo = back;
  } catch (e) {
    /* sessionStorage unavailable (private mode) */
  }

  // The back pill follows that same marker: a tool launched from a folder is PINNED
  // to that folder - it must land back where the session was filed even if the user
  // wandered elsewhere in between - so the marker is handed to the shared pill as an
  // explicit target. Without a marker there's nothing to pin to and the pill does what
  // it does everywhere else: names and returns to the view you actually came from
  // (the gallery, the catalog, a search…), falling back to "Tools" only on a direct
  // visit. Either way the editing session stays a round-trip instead of dumping the
  // user in the gallery. The unsaved-changes dialog's "Save & leave" leaves through
  // the pill's own handler rather than re-deriving a target, so both exits agree by
  // construction.
  const fromFolder = returnTo !== '/';
  const backPillOpts = fromFolder ? { href: returnTo } : {};

  // Populate inputs from user profile if they match profile field names
  const profile = await host.profile.get();
  const profileInputIds = (tool.manifest.inputs ?? []).map((i) => i.id);
  for (const inputId of profileInputIds) {
    if (inputId in profile && !(inputId in initialValues)) {
      initialValues[inputId] = (profile as Record<string, InputValue>)[inputId]!;
    }
  }

  // Which design system this tool mounts under, and which one a resumed session was
  // made with. Both feed the two notices below the sidebar: "Made with X" when they
  // differ and X is on the device, and "Switched to X - reload" if a switch happens
  // while this tool stays open (the switch never tears a tool down under someone).
  const {
    registry: dsRegistry,
    mountedSystemId,
    madeWith,
  } = await prepareToolDesignSystemContext(host, urlDesignSystem, slot);

  const runtime: ToolRuntime = await createRuntime(tool, host, initialValues);
  const compileForSurface = async (inputs: Record<string, unknown> = {}) =>
    (
      await compileDocument(tool, { ...modelToValues(runtime.getModel()), ...inputs } as never, {
        host,
      })
    ).document;
  const documentSurface = {
    compile: compileForSurface,
    inspect: async (document?: unknown) =>
      inspectDocument((document ?? (await compileForSurface())) as never),
    measure: async (document?: unknown, opts?: Record<string, unknown>) =>
      measureDocument((document ?? (await compileForSurface())) as never, opts),
    diff: async (a: unknown, b: unknown) => diffDocuments(a as never, b as never),
  };
  const removeDocumentSurface = installDocumentSurface(window, documentSurface);
  mountLifecycle.add('document automation surface', removeDocumentSurface);
  // A NEW session appears - the soft "twinkle bloom". Only a fresh open (no resume
  // slot); resuming a saved session is not "making" one. Audible when opened via a
  // click (audio is gesture-gated); a cold direct-URL load stays silent until a gesture.
  if (!slot) playSfx('newSession');

  // ── Undo / redo (Cmd+Z / Cmd+Shift+Z / Cmd+Y) ──────────────────────────────
  // Lets an accidental slider nudge - or any control edit - be reverted. There's
  // no shell-level chokepoint for edits: every control calls runtime.setInput
  // directly, so we wrap it once here to record before/after values. A slider
  // drag fires 'input' on every pixel, so rapid same-input changes coalesce (by
  // id + time) into a single step - one gesture, one undo. Restoring just replays
  // setInput, so the existing subscriber refreshes the sidebar + canvas for free
  // and the onInput hook re-derives any computed inputs (we never store those).
  // The history RULES (coalescing, the byte-carrying filter, the cap, the redo
  // chain) live in ./tool-history.ts - pure and unit-tested. This view keeps the
  // wiring: the runtime, the toast and the button sync.
  const inputHistory = createHistory();
  let applyingHistory = false;
  let historyControls: HistoryControls | null = null; // ↶/↷ buttons - header pair, or the editor's toolbar pair (set on mount)
  let historyToastEl: HTMLElement | null = null;
  let historyToastTimer: ReturnType<typeof setTimeout> | undefined;
  // Gesture continuity for coalescing, tracked SEPARATELY from stack entries: an
  // undo/redo leaves an old entry on top still carrying its original time, so if we
  // keyed coalescing off the entry the next edit could wrongly merge into it (losing
  // a state). applyHistory resets this, so a post-undo edit always starts fresh.
  const refreshHistoryUI = () =>
    historyControls?.sync(inputHistory.canUndo(), inputHistory.canRedo());
  const baseSetInput = runtime.setInput.bind(runtime);
  // Expose the UNWRAPPED setter on the runtime so other scopes (notably renderActions'
  // programmatic width/height px-sync) can set inputs without the change landing in the
  // undo history. baseSetInput itself is local to mountTool; this is the shared handle.
  runtime.setInputNoHistory = baseSetInput;
  /**
   * What the undo/redo toast calls this edit (plans/179 A16). The input's own name is
   * the LAST resort, not the first: "Undid Boxes" names the slot that was written, which
   * is never what the user just did. `describeRowChange` reads the two values of a
   * blocks/canvas array and names the gesture where it honestly can - Add, Delete, Move,
   * Resize, Rotate, or the one field's own label in the user's language - and answers
   * null for everything else, where the input label is the truthful answer it always was.
   */
  const changeLabel = (
    item: {
      id: string;
      label?: string;
      fields?: Array<{ id?: string; label?: string }>;
      canvas?: Record<string, unknown>;
    },
    before: InputValue,
    after: InputValue
  ): string => {
    const fallback = item.label || item.id;
    const cvs = (item.canvas || {}) as Record<string, unknown>;
    const str = (k: string): string | undefined =>
      typeof cvs[k] === 'string' ? (cvs[k] as string) : undefined;
    const ch = describeRowChange(before, after, {
      xField: str('xField'),
      yField: str('yField'),
      wField: str('wField'),
      hField: str('hField'),
      rotationField: str('rotationField'),
    });
    if (!ch) return fallback;
    switch (ch.kind) {
      case 'add':
        return t('Add');
      case 'delete':
        return t('Delete');
      case 'move':
        return t('Move');
      case 'resize':
        return t('Resize');
      case 'rotate':
        return t('Rotate');
      default:
        break;
    }
    const f = (item.fields || []).find((x) => x?.id === ch.field);
    return f?.label ? t(f.label) : fallback;
  };
  runtime.setInput = (id: string, value: InputValue) => {
    if (!applyingHistory) {
      const cur = runtime.getModel().find((i) => i.id === id);
      // `label` is what the toast shows on undo/redo - what CHANGED where we can name it.
      if (
        cur &&
        inputHistory.record(
          { id, label: changeLabel(cur, cur.value, value), before: cur.value, after: value },
          Date.now()
        ) !== 'ignored'
      ) {
        historyToastEl?.classList.remove('is-visible'); // dismiss a now-stale undo/redo toast
        refreshHistoryUI();
      }
    }
    return baseSetInput(id, value);
  };

  const applyHistory = (id: string, value: InputValue) => {
    applyingHistory = true;
    inputHistory.endGesture(); // an undo/redo ends any gesture - the next edit starts a new step
    try {
      runtime.setInput(id, cloneValue(value));
    } finally {
      applyingHistory = false;
    }
  };
  const undoHistory = () => {
    const entry = inputHistory.undo();
    if (!entry) {
      showHistoryToast({ empty: 'undo' });
      return;
    }
    applyHistory(entry.id, entry.before);
    showHistoryToast({ kind: 'undo', label: entry.label });
    refreshHistoryUI();
  };
  const redoHistory = () => {
    const entry = inputHistory.redo();
    if (!entry) {
      showHistoryToast({ empty: 'redo' });
      return;
    }
    applyHistory(entry.id, entry.after);
    showHistoryToast({ kind: 'redo', label: entry.label });
    refreshHistoryUI();
  };

  // ── Stable row ids (plan 100 section 3) ───────────────────────────────────────────
  // A session saved before rows had ids gets them here, once, for this mount - the
  // ONE place that owns a mounted session's model, and before anything can edit it.
  // Fire-and-forget: it writes through the engine's applyPatch, so it records no undo
  // step (see lib/row-id.ts for why both of those matter) and the render it triggers
  // is the same one the first paint was going to do.
  void migrateBlockRowIds(runtime);

  // ── template chooser pick ──────────────────────────────────────────────────
  // The chooser was STARTED above without being awaited, so this mount has already
  // reached (or is about to reach) first paint. Its pick lands here instead, through
  // exactly the write path the row-id migration above uses - `applyPatch`, the engine's
  // atomic multi-input apply:
  //   • no undo step. Choosing a starting point is not the user's first edit; ⌘Z must
  //     not wipe the template they just picked (mountTool's `setInput` is the history
  //     wrapper - `applyPatch` bypasses it, exactly as lib/row-id.ts documents).
  //   • no collab echo. lib/collab-plumbing.ts wraps `setInput` only.
  //   • one render for the whole seed, hooks included, not one per input.
  // Precedence is IDENTICAL to the pre-mount merge this replaced (`{...chosen,
  // ...initialValues}`): a key the URL or the profile fill already supplied wins, so it
  // is dropped from the patch rather than overwritten. `values` is empty on this branch
  // by construction, so what survives in `initialValues` is exactly the profile fill.
  // Row ids are re-stamped afterwards because these rows arrive AFTER the mount-time
  // migration ran (on the blank model), and `ensureRowIds` is idempotent for the rest.
  if (templatePick) {
    void templatePick
      .then(async (chosen) => {
        // Navigated away before the pick landed (or before the chooser even opened,
        // per the guard at its `templatePickTornDown` check above) - this runtime is
        // already torn down by _cleanup; applying a patch to it now would re-run the
        // tool's onInput hook and emit() against disconnected DOM. `chosen` is `{}` on
        // this path anyway (the close armed by `onOpen` resolves blank), so the seed
        // below would end up empty regardless - this is the explicit, required check.
        if (templatePickTornDown) return;
        const seed: Record<string, InputValue> = {};
        for (const [k, v] of Object.entries(chosen ?? {})) if (!(k in initialValues)) seed[k] = v;
        if (!Object.keys(seed).length) return; // Blank canvas / Escape / close
        await runtime.applyPatch(seed);
        if (templatePickTornDown) return; // torn down while applyPatch was in flight
        await migrateBlockRowIds(runtime);
        // applyPatch resolves no refs (it's the keystroke/collab path); a template's
        // {color.*} backdrop tokens and tool-URL image stubs arrive unresolved, so do
        // the one resolve pass the mount does - else a seeded template renders black
        // colours + a placeholder where its own preview showed the real render.
        if (templatePickTornDown) return;
        await runtime.resolveRefs();
      })
      .catch((e) => host.log?.('warn', 'template seed failed - staying blank: ' + String(e)));
  }

  // ── Live collab (plan 100 section 5) ──────────────────────────────────────────────
  // Wraps the undo wrapper above once more, so a local edit ALSO becomes ops for a
  // registered sync provider (and an undo replay syncs like any other local edit).
  // Returns null when no provider is registered - which is every build of this repo
  // (plans/99 section 1.1) - and in that state it has not touched the runtime at all, so
  // the mount is byte-identical to single-player.
  const collab = attachCollabPlumbing(runtime);

  // The presence half of a collab is CHROME, so it cannot be composed here: it needs
  // the stage, the render surface and the sidebar root, and none of them exist yet
  // (the view's innerHTML is written a few hundred lines below). It is composed in
  // ONE guarded block once they do - search "Live collab: presence chrome" - and
  // these are the two handles that block hands back to the paint path, the stage
  // ResizeObserver and the teardown, each of which is declared BEFORE it.
  //
  // Both stay null for every mount of this repo, and that is what a single-player
  // mount pays for presence: two nullable reads on a resize and one per painted
  // frame. No timer, no listener, no node (section 11.14's solo-cost discipline).
  let collabReanchor: (() => void) | null = null;
  let collabTeardown: (() => void) | null = null;

  // Transient bottom-centre toast confirming what was undone/redone, with a
  // one-tap counter-action (Redo after an undo, and vice-versa) - that button
  // doubles as the redo path on touch, where there's no keyboard. Reuses
  // announce() for the screen-reader side (the toast itself is aria-hidden to
  // avoid a double read). A single reused element; the timer resets on each call.
  const showHistoryToast = ({
    kind,
    label,
    empty,
  }: {
    kind?: 'undo' | 'redo';
    label?: string;
    empty?: 'undo' | 'redo';
  }) => {
    if (!historyToastEl) {
      historyToastEl = document.createElement('div');
      historyToastEl.className = 'toast';
      historyToastEl.setAttribute('aria-hidden', 'true');
      document.body.appendChild(historyToastEl);
    }
    const el = historyToastEl;
    const wasVisible = el.classList.contains('is-visible');
    clearTimeout(historyToastTimer);
    if (empty) {
      el.classList.add('is-muted');
      const emptyMsg = empty === 'undo' ? t('Nothing to undo') : t('Nothing to redo');
      el.innerHTML = `<span class="toast-message">${emptyMsg}</span>`;
      announce(emptyMsg);
    } else {
      el.classList.remove('is-muted');
      const verb = kind === 'undo' ? t('Undid') : t('Redid');
      const counter = kind === 'undo' ? t('Redo') : t('Undo');
      el.innerHTML =
        `<span class="toast-icon" aria-hidden="true">${kind === 'undo' ? ICON_UNDO : ICON_REDO}</span>` +
        `<span class="toast-message">${verb}<span class="toast-label"> ${escape(String(label))}</span></span>` +
        // tabindex=-1: the toast is aria-hidden (announce() drives SR) so this button
        // must not become a phantom tab stop; it stays pointer-clickable for touch/mouse.
        `<button type="button" class="toast-action" tabindex="-1">${counter}</button>`;
      el.querySelector('.toast-action')!.addEventListener('click', () => {
        kind === 'undo' ? redoHistory() : undoHistory();
      });
      announce(tRaw('{verb} {label}', { verb, label: String(label) }));
    }
    // Animate the slide-in only when coming from hidden; if it's already showing
    // (rapid undo/redo), just swap the content and reset the timer - no flicker.
    if (!wasVisible) void el.offsetWidth; // flush the base state so the transition plays
    el.classList.add('is-visible');
    historyToastTimer = setTimeout(() => el.classList.remove('is-visible'), empty ? 1400 : 2200);
  };

  const onHistoryKey = (e: KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    const redo = k === 'y' || (k === 'z' && e.shiftKey);
    const undo = k === 'z' && !e.shiftKey;
    if (!undo && !redo) return;
    // Free-text fields keep their own per-character undo; sliders, selects,
    // colours and checkboxes have no useful native undo, so we own those.
    if (isTextEditing()) return;
    e.preventDefault();
    redo ? redoHistory() : undoHistory();
  };
  window.addEventListener('keydown', onHistoryKey);

  const nativeW = tool.manifest.render.width;
  const nativeH = tool.manifest.render.height;
  const hasInputs = (tool.manifest.inputs?.length ?? 0) > 0;
  const noExport = tool.manifest.render.export === false;
  // Whether /batch can run this template - the batch's own admission test, kept in
  // capabilities.ts so both halves of it live next to `toolSupport` rather than being
  // restated here (views/* must not pull in the pro/ folder, which owns its stylesheet).
  const canBulk = canBatchTool(tool.manifest, host.capabilities);
  // plans/147 M2 "Bulk from files": a transform tool (exportFile) with one single
  // file input can loop that path over N picked files into one zip. runtime exists
  // by here (created above), so hasExportFile is a real answer, not a guess.
  const bulkFilesId = runtime.hasExportFile ? singleFileInputId(tool.manifest) : null;
  // Transcribe (engine 1.150, render.transcribe): the tool names an audio/video
  // input and a text input, and the shell owns everything between them - consent
  // for the one-time model download, the background job, and one undoable write.
  // Feature-detected, never capability-gated: audio never leaves the device, and a
  // shell without on-device speech (the CLI) simply mounts nothing. Both named
  // inputs must exist, or the declaration is a typo and the button would write
  // nowhere.
  const transcribeSpec = resolveTranscribeSpec(tool, host);
  // Whether this tool persists a saved session - drives the Save half of the
  // render pill. Mirrors renderActions: the default action set includes 'save',
  // and an explicit empty actions list (opted-out file utilities) excludes it.
  const canSaveSession = (tool.manifest.render.actions ?? ['copy', 'download', 'save']).includes(
    'save'
  );
  // An on-device transform tool (export:false with an explicit empty actions list,
  // or no inputs) gets an EMPTY popup body from renderActions - so don't emit the
  // Export pill or the overlay shell at all; a header that expands to nothing
  // reads as broken chrome.
  const exportUiEmpty =
    noExport &&
    ((Array.isArray(tool.manifest.render.actions) && tool.manifest.render.actions.length === 0) ||
      !hasInputs);
  // Visitor page: `?nostage` on a NO-EXPORT tool. For these utilities the link
  // is the product (a jump page, a countdown), so a shared link opens as a plain
  // full-width webpage - normal document flow, no stage frame, no zoom HUD, no
  // sidebar, no pills - while the bare tool URL stays the editing preview. For
  // exportable tools `nostage` keeps its export-panel meaning (the html "Full
  // page" pre-check above) and none of this engages.
  const visitorPage = urlNostage && noExport;
  const canvasLayout = tool.manifest.render.layout === 'canvas';
  // The WYSIWYG "editor" layout: a chromeless full-canvas surface (no input
  // sidebar) that KEEPS the fixed render canvas + the full render/export
  // scaffolding, so it exports like a normal tool. The direct-manipulation overlay
  // (select / drag / resize / rotate / z-order / align) is mounted below.
  const editorLayout = tool.manifest.render.layout === 'editor';
  // The blocks input the editor manipulates directly (carries the `canvas` flag).
  const canvasEditInput = editorLayout
    ? tool.manifest.inputs?.find((i) => i.type === 'blocks' && i.canvas)
    : null;
  // Geometry paint fast-skip (plans/98 section 9) - OFF by default, opt-in via ?canvasfastpath=1 so
  // the served-app harness proves exported-SVG byte-parity before it is enabled for everyone.
  const fastPathOn =
    editorLayout &&
    !!canvasEditInput &&
    typeof location !== 'undefined' &&
    /[?&]canvasfastpath=1\b/.test(location.href);
  const fastCfgPaint: FastPathCfg | null =
    fastPathOn && canvasEditInput?.canvas
      ? resolveCanvasFastCfg(canvasEditInput.canvas as Record<string, unknown>)
      : null;
  // Multi-page ("carousel") editor: an editor-layout tool whose canvas is a horizontal
  // strip of N same-size [data-pdf-page] frames (render.pages). The overlay places boxes
  // across all frames; export fans out to a multi-page PDF or one still image per page.
  const pagesCfg = editorLayout && canvasEditInput ? tool.manifest.render.pages : undefined;
  const pagesMode = !!pagesCfg;
  // Frame-primitive editor (plan 93 F1b): an editor-layout tool whose canvas block
  // declares `frameField` (Design). kind:'frame' boxes render as free-placed
  // [data-pdf-page] pages and the overlay drives frame-local drag + containment-on-drop.
  // The fields live on the blocks input's `canvas`, not on render.*; null for every tool
  // without a frameField so the overlay's frame-aware paths stay dead.
  const frameCanvas = (
    canvasEditInput as {
      canvas?: {
        frameField?: string;
        frameKind?: string;
        orderField?: string;
        clipChildrenField?: string;
        frameTransitionField?: string;
        hiddenField?: string;
        lockedField?: string;
      };
    } | null
  )?.canvas;
  const frameCfg =
    editorLayout && frameCanvas?.frameField
      ? {
          frameField: frameCanvas.frameField,
          frameKind: frameCanvas.frameKind || 'frame',
          orderField: frameCanvas.orderField,
          clipChildrenField: frameCanvas.clipChildrenField,
          // The M4 declarations (plans/179): a slide's own transition to the next one, and the
          // two layer flags. Each is optional, so a canvas that declares none keeps every
          // frame-aware path exactly as it was.
          transitionField: frameCanvas.frameTransitionField,
          hiddenField: frameCanvas.hiddenField,
          lockedField: frameCanvas.lockedField,
        }
      : undefined;
  // A fixed-size editor canvas (no resize control): the canvas input opts in via
  // canvas.fixedCanvas. Connector tools (Org Chart) set this so their rendered
  // connector <svg>'s viewBox stays 1:1 with box coordinates (a resized canvas would
  // scale the lines away from the boxes). Treated like carousel mode for sizing.
  const fixedCanvasMode = !!(
    canvasEditInput &&
    (canvasEditInput as { canvas?: { fixedCanvas?: boolean } }).canvas?.fixedCanvas
  );
  // Will the Design chrome (top bar + the two side columns, plan 179 M1-M3) mount? The
  // same predicate the overlay block below is gated on, minus the two DOM lookups that
  // cannot happen until the template has painted - so the render can already move the
  // Home pill into the bar, and a layout:'editor' tool that declares no canvas blocks
  // input keeps the free-floating corner pill it has always had.
  const designChrome = editorLayout && !!canvasEditInput;
  // The multi-page rich-text document layout (render.layout:'document', e.g. Doc
  // Studio): chromeless like 'editor', but mounts a TipTap rich-document editor
  // (doc-editor.js) over the tool's `content` input, which stores the document as
  // portable ProseMirror JSON. The engine hook renders that JSON into paged
  // [data-pdf-page] boxes, so export / CLI / previews work without the editor.
  const documentLayout = tool.manifest.render.layout === 'document';
  const docEditInput = documentLayout
    ? (tool.manifest.inputs?.find((i) => i.id === 'content') ??
      tool.manifest.inputs?.find((i) => i.type === 'blocks'))
    : null;
  // The slide-deck editor layout (render.layout:'deck', e.g. Deck Builder). UNLIKE
  // editor/document it is deliberately NOT chromeless: the input sidebar stays as the home
  // for the long-tail fields (per-slide layout / media slots / notes, deck-level timing),
  // and the on-canvas overlay (deck-editor.ts) is mounted ON TOP of the live canvas for the
  // primary flow (edit text/colour/images in place, thumbnail-rail navigation). It edits a
  // `blocks` input whose rows are slides.
  const deckLayout = tool.manifest.render.layout === 'deck';
  const deckEditInput = deckLayout ? tool.manifest.inputs?.find((i) => i.type === 'blocks') : null;
  // Both chromeless full-canvas layouts drop the input aside but keep the fixed render
  // canvas + export controls; the on-canvas overlay replaces the sidebar. The 'deck' layout
  // is intentionally excluded - it keeps the sidebar.
  const chromeless = editorLayout || documentLayout;
  // A full-bleed utility whose template IS the whole interface and whose canvas is a
  // live preview (e.g. Run Web Code: a code editor + sandboxed preview that exports a
  // snapshot). It drops the input aside like a canvas utility, but unlike a plain
  // no-input+no-export tool it KEEPS the render/export pill. Two ways to qualify:
  //   • NO declared inputs (the original case - without this a no-input tool regressed
  //     into an empty sidebar squashing the editor the moment its manifest turned export on);
  //   • declared inputs with `render.sidebar:false` - the tool declares inputs so they
  //     ride the synced model (URL / collab / saved sessions / CLI) but owns their editing
  //     UI on the canvas itself, so the aside is suppressed. The declared inputs are a pure
  //     DATA channel: the template must NOT reference them (byte-constant hydrated output →
  //     paint() skips its innerHTML rebuild → the live editor DOM survives every commit),
  //     and the tool reads/writes them through the per-canvas channel (attachCanvasCommit).
  const sidebarOptOut = tool.manifest.render.sidebar === false;
  const bareExport = (!hasInputs || sidebarOptOut) && !noExport && !canvasLayout && !chromeless;
  // Hide the sidebar for pure-canvas utilities: no inputs at all, an explicit canvas
  // layout - where the tool's single file input becomes a drag-and-drop / click-to-pick
  // zone on the canvas itself (setupCanvasFileDrop) - or a bareExport full-bleed tool.
  // NOTE: editorLayout is deliberately NOT hideSidebar - it needs the live canvas
  // node + export UI. It only removes the input aside (via showAside below).
  const hideSidebar = (noExport && !hasInputs) || canvasLayout || bareExport;
  // A standard sidebar tool whose template stacks several [data-pdf-page] boxes
  // (render.paged - e.g. multi-page-pdf). Unlike the editorLayout carousel (pagesMode,
  // pages side-by-side) it renders through the ordinary render path; the difference is
  // purely how the STAGE presents it - the whole document laid out at full length in a
  // vertical scroll surface, rather than one page's worth clipped with an inner scroll.
  // The one-page sizing of each box is kept (that's what export reads); it just stops
  // bounding what the editor shows. Excludes the chromeless editor/document layouts,
  // which own their own canvas presentation.
  // A no-export web-page tool (render.webPreview - jump, countdown): the preview
  // is a real viewport, not a scaled artboard. It rides the paged plumbing (the
  // scrolling surface, no zoom HUD) but skips the zoom fit entirely: the canvas
  // fills the pane's width and REFLOWS as the pane resizes, so dragging the
  // sidebar edge is the browser-window test a visitor's device would give.
  const webDoc =
    (tool.manifest.render as { webPreview?: boolean }).webPreview === true &&
    noExport &&
    !chromeless &&
    !hideSidebar;
  const pagedDoc = (tool.manifest.render.paged === true || webDoc) && !chromeless && !hideSidebar;
  // Which edge the slide-sorter rail runs along. Left (a vertical rail) suits tall
  // documents; "bottom" is the deck-strip shape for tools whose pages are wide and few,
  // where a left rail would eat the width the page needs. Unknown values fall back to
  // the default rather than producing a rail nothing styles.
  const filmstripSide: FilmstripSide =
    tool.manifest.render.filmstrip === 'bottom' ? 'bottom' : 'left';
  // Whether the input aside is present. Chromeless modes drop it but aren't hideSidebar.
  const showAside = !hideSidebar && !chromeless && !visitorPage;
  const noAside = !showAside; // no visible input aside (hidden-canvas OR editor)
  // The one declared file input presented as a full-canvas drop zone. Canvas-layout
  // utilities have always worked this way; a sidebar tool with a `file` input (e.g.
  // redact) gets the same canvas drop IN ADDITION to its sidebar file-picker, so a
  // file can land on the big surface without hunting for the sidebar control. Click
  // still only opens the picker via an explicit [data-file-pick] affordance.
  const canvasFileInput = tool.manifest.inputs?.find((i) => i.type === 'file') ?? null;
  // A sidebar tool with a `dropToAdd` blocks input (e.g. logo-wall) also turns its
  // canvas into a drop zone, so a pile of images can be dropped straight onto the
  // (usually empty) preview - not only onto the sidebar list. Canvas-layout file
  // utilities use canvasFileInput above instead, so they're excluded here.
  const canvasDropInput = !canvasFileInput
    ? tool.manifest.inputs?.find(
        (i) =>
          i.type === 'blocks' &&
          i.dropToAdd?.field &&
          (i.fields ?? []).some((f) => f.id === i.dropToAdd!.field && f.type === 'asset')
      )
    : null;

  // On-device utilities (privacy:'on-device') carry an honest, prominent badge -
  // the user's content is processed locally and never uploaded. It's the single
  // most reassuring thing on screen for someone used to handing files to strangers.
  const onDevice = tool.manifest.privacy === 'on-device';
  const privacyBadge = onDevice
    ? `<div class="on-device-badge" title="${escape(t('This tool runs entirely in your browser. Your file is never uploaded.'))}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span>${t('Runs on your device - nothing is uploaded')}</span>
      </div>`
    : '';

  // The canvas is the visual OUTPUT (the editable interface is the sidebar), so
  // it's exposed to screen readers as a single role="img" with a text summary.
  // Authors can declare a live Handlebars summary (manifest.a11yLabel); otherwise
  // it's "<name> preview". Kept current in the render subscriber below.
  const canvasLabel = (): string => {
    if (!tool.manifest.a11yLabel) return tRaw('{name} preview', { name: tool.manifest.name });
    // Handlebars HTML-escapes {{values}}; an aria-label is plain text, so decode
    // the entities back (it's set via setAttribute, not innerHTML).
    const custom = runtime
      .getHydratedString(tool.manifest.a11yLabel)
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#(?:39|x27);/g, "'")
      .trim();
    return custom || tRaw('{name} preview', { name: tool.manifest.name });
  };

  const SIDEBAR_DEFAULT = 272;
  const SIDEBAR_MIN = 40;
  const savedWidth = Number(localStorage.getItem('sidebarWidth') ?? SIDEBAR_DEFAULT);
  // The desktop export panel anchors to the sidebar's bottom edge, so ?options
  // needs the sidebar open even if this device last left it collapsed (width 0).
  const sidebarOpen =
    isFull || hideSidebar || chromeless ? false : showExportPanel || savedWidth > 0;
  const openWidth = savedWidth > 0 ? savedWidth : SIDEBAR_DEFAULT;

  // A saved design (or a shared URL) can reference an image the user has since
  // deleted from their device library. The runtime resolves those to null and
  // reports them here; tell the user the field was left blank rather than leaving
  // a silent gap. Worded by DroppedAsset.reason: a frozen (baked) image whose
  // stored data was missing reads differently from an image that no longer resolves.
  const dropped = runtime.droppedAssets ?? [];
  const bakedLost = dropped.filter((d) => d.reason === 'baked-bytes-lost');
  const unresolved = dropped.filter((d) => d.reason !== 'baked-bytes-lost');
  const fieldsWere = (n: number): string => (n > 1 ? t('fields were') : t('field was'));
  const droppedLines = [
    unresolved.length
      ? t(
          'An image used in this saved design is no longer available, so the <strong>{fields}</strong> {were} left blank.',
          { fields: unresolved.map((d) => d.label).join(', '), were: fieldsWere(unresolved.length) }
        )
      : '',
    bakedLost.length
      ? t(
          "A frozen image's data was missing from this saved design, so the <strong>{fields}</strong> {were} left blank.",
          { fields: bakedLost.map((d) => d.label).join(', '), were: fieldsWere(bakedLost.length) }
        )
      : '',
  ].filter(Boolean);
  const droppedNotice = droppedLines.length
    ? `
    <div class="tool-notice" role="status" id="dropped-assets-notice">
      <span class="tool-notice-text">${droppedLines.join(' ')}</span>
      <button type="button" class="tool-notice-close" id="dropped-assets-dismiss" aria-label="${escape(t('Dismiss this message'))}">✕</button>
    </div>`
    : '';

  // Capture tool without the extension (see the gate above): mounted for composition,
  // so tell the author capture-to-file needs the extension/desktop while compose works.
  const captureNotice = captureHint
    ? `
    <div class="tool-notice" role="status" id="capture-hint-notice">
      ${/* nosemgrep: lolly-href-escape-is-not-scheme-validation - docsAppHref() over a build-time slug constant, always '#/docs/…' */ ''}
      <span class="tool-notice-text">${t('Compose a shot and copy its recipe here. Saving it to a file needs the desktop app or browser extension.')} <a href="${escape(docsAppHref('create/extension'))}" target="_blank" rel="noopener">${t('Get the extension')}</a></span>
      <button type="button" class="tool-notice-close" id="capture-hint-dismiss" aria-label="${escape(t('Dismiss this message'))}">✕</button>
    </div>`
    : '';

  // A resumed session made under another design system (plans/186 section 3.8):
  // say so, and offer the switch when that system is on this device. Rendering
  // continues with the active one meanwhile - a missing ref keeps its cached hex,
  // which is the half-rebrand the notice is warning about.
  const madeWithOnDevice =
    madeWith && dsRegistry ? await dsRegistry.get(madeWith.id).catch(() => null) : null;
  const madeWithNotice = madeWith
    ? `
    <div class="tool-notice" role="status" id="made-with-notice">
      <span class="tool-notice-text">${
        madeWithOnDevice
          ? t('Made with <strong>{name}</strong>. This design system is not the active one.', {
              name: escape(madeWith.label),
            })
          : t(
              'Made with <strong>{name}</strong>, which is not on this device. Rendering with the active design system.',
              { name: escape(madeWith.label) }
            )
      }
        ${madeWithOnDevice ? ` <button type="button" class="tool-notice-link" id="made-with-switch">${t('Switch to {name}', { name: escape(madeWith.label) })}</button>` : ''}</span>
      <button type="button" class="tool-notice-close" id="made-with-dismiss" aria-label="${escape(t('Dismiss this message'))}">✕</button>
    </div>`
    : '';

  viewEl.innerHTML = `
    ${
      /* The editor layout's Home pill moves INTO the design top bar's left slot (plan 179
          M1), so the free-floating corner pill is gated off there - two pills would sit on
          top of each other. mountBackPill() scans the whole view, so the one the bar emits
          (backHomeHtml, below) is wired by the same call, unsaved-changes intercept and all. */ ''
    }
    ${noAside && !visitorPage && !designChrome ? backPillHtml(backPillOpts) : ''}
    <div class="tool-layout${chromeless ? ' is-editor' : ''}${documentLayout ? ' is-document' : ''}${pagedDoc ? ' is-paged' : ''}${webDoc ? ' is-webdoc' : ''}${visitorPage ? ' is-visitor' : ''}${hideSidebar && !visitorPage ? ' is-bare' : ''}" id="tool-layout"${documentLayout ? ' data-theme="light"' : ''} data-sidebar="${noAside ? 'hidden' : sidebarOpen ? 'open' : 'closed'}">
      ${
        showAside
          ? `
        <aside class="sidebar" id="tool-sidebar">
          <div class="sidebar-header">
            <div class="sidebar-back-row">
              ${backPillHtml({ ...backPillOpts, class: 'sidebar-back' })}
            </div>
            <div class="sidebar-header-row">
              <span class="sidebar-title-wrap">
                <span class="sidebar-title">${escape(tool.manifest.name)}</span>
                ${hasGuide(tool.manifest) ? guideButtonHtml() : ''}
                ${canSaveSession ? `<button type="button" class="multi-edit-btn" id="multi-edit-btn" data-tip="${escape(t('Make variants'))}" aria-label="${escape(t('Make variants'))}" aria-haspopup="menu" aria-expanded="false">${icon('grid', { className: 'multi-edit-icon' })}</button>` : ''}
                ${
                  /* "Bulk from rows" - the same icon-only header control as Make variants
                      next to it, so it needs no styling of its own. */ ''
                }
                ${canBulk ? `<button type="button" class="multi-edit-btn" id="bulk-rows-btn" data-tip="${escape(t('Bulk from rows'))}" aria-label="${escape(t('Bulk from rows'))}">${icon('table', { className: 'multi-edit-icon' })}</button>` : ''}
                ${/* "Bulk from files" (plans/147 M2) - loop this transform tool over N picked files into one zip. */ ''}
                ${bulkFilesId ? `<button type="button" class="multi-edit-btn" id="bulk-files-btn" data-tip="${escape(t('Bulk from files'))}" aria-label="${escape(t('Bulk from files'))}">${icon('layersStack', { className: 'multi-edit-icon' })}</button>` : ''}
              </span>
              <button class="fullscreen-toggle" id="fullscreen-toggle" ${sidebarOpen ? 'open' : ''} aria-label="${escape(sidebarOpen ? t('Collapse sidebar') : t('Expand sidebar'))}"></button>
            </div>
          </div>
          <div class="sidebar-body">
            ${privacyBadge}
            ${droppedNotice}
            ${captureNotice}
            ${madeWithNotice}
            <div id="tool-inputs" class="tool-inputs"></div>
            ${
              hasInputs
                ? `
              <div class="sidebar-utils" id="sidebar-utils">
                ${toolId === 'darkroom' && typeof (window as { VideoDecoder?: unknown }).VideoDecoder !== 'undefined' && typeof (window as { VideoEncoder?: unknown }).VideoEncoder !== 'undefined' ? `<button type="button" id="grade-video-btn" class="clear-inputs-btn" title="${escape(t('Apply this look to a video from your library - runs on-device as a background job'))}">${t('Grade a video…')}</button>` : ''}
                ${transcribeSpec ? `<button type="button" id="transcribe-btn" class="clear-inputs-btn" disabled title="${escape(t('Add a clip first'))}">${t('Transcribe')}</button>` : ''}
                <button type="button" id="clear-inputs-btn" class="clear-inputs-btn" title="${escape(t('Reset all inputs to defaults'))}">${t('Clear changes')}</button>
              </div>
            `
                : ''
            }
            <div class="tool-actions" id="tool-actions"></div>
          </div>
          <div class="sidebar-drag-handle resize-grip" id="sidebar-drag-handle"></div>
        </aside>
        <!-- Grip lives OUTSIDE the sheet (it's position:fixed): keeps it from being
             clipped by the sheet's overflow, which must stay hidden so the form
             can't spill past the sheet's rounded edge. -->
        <button type="button" class="sheet-grip" id="sheet-grip" aria-label="${escape(t('Drag to resize controls, tap to expand'))}"></button>
      `
          : chromeless || bareExport
            ? `<div class="tool-actions" id="tool-actions"></div>`
            : ''
      }
      <div class="tool-stage" id="tool-stage">
        ${!exportUiEmpty && !visitorPage ? `<div class="url-budget" id="url-budget-gauge" role="button" tabindex="0" aria-label="${escape(t('URL budget'))}" title="${escape(t('URL budget'))}" hidden><span class="url-budget-fill" data-gauge-fill></span></div><div class="url-budget-toast" data-gauge-toast role="status" aria-live="polite" hidden></div>` : ''}
        ${showAside ? `<button class="fullscreen-toggle-float" id="fullscreen-toggle-float" aria-label="${escape(t('Expand sidebar'))}"></button>` : ''}
        ${
          hideSidebar && onDevice
            ? `<div class="on-device-badge on-device-badge--float" title="${escape(t('This tool runs entirely in your browser. Your file is never uploaded.'))}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span>${t('Runs on your device - nothing is uploaded')}</span>
        </div>`
            : ''
        }
        ${
          hideSidebar
            ? `<div id="tool-content" role="img" aria-label="${escape(canvasLabel())}"></div>`
            : `
        <div class="tool-canvas-outer" id="tool-canvas-outer">
          ${
            /* Visitor page: a real document, not a picture of one - no role="img"
                (its links must stay in the accessibility tree) and no fixed px
                frame (the page flows at viewport width, CSS owns the height). */ ''
          }
          <div class="tool-canvas" id="tool-canvas"${
            visitorPage
              ? ' style="width: 100%;"'
              : ` role="img" aria-label="${escape(canvasLabel())}"
               style="width: ${nativeW}px; height: ${nativeH}px;"`
          }></div>
        </div>`
        }
      </div>
      ${
        (!hideSidebar || bareExport) && !exportUiEmpty && !visitorPage
          ? `
        <div class="render-pill" id="render-pill" role="group" aria-label="${escape(t('Export and save'))}">
          <button type="button" class="render-pill-btn render-pill-get" id="render-fab" data-sfx="hydraulicOpen" aria-label="${escape(t('Export options'))}">
            <svg class="render-pill-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
            <span>${t('Export')}</span>
          </button>
          ${
            canSaveSession
              ? `
          <span class="render-pill-sep" aria-hidden="true"></span>
          <button type="button" class="render-pill-btn render-pill-save" id="render-save" data-sfx="save" aria-label="${escape(t('Save to your library'))}" title="${escape(t('Save to your library'))}">
            <svg class="render-pill-icon render-pill-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            <span data-save-label>${t('Save')}</span>
          </button>`
              : ''
          }
        </div>
        <div class="export-overlay" id="export-overlay">
          <div class="export-overlay-scrim" data-export-close></div>
          ${
            /* data-canvas-keys="off": the canvas editor binds its bare-key verbs on
                `window`, so this sheet's own buttons were a live canvas surface - Delete
                on Download removed the selected box, the arrows nudged it. The attribute
                travels WITH the element the dock re-parents, so it covers the sheet
                docked in the right column and floating over the stage alike. */ ''
          }
          <div class="export-popup" role="dialog" aria-modal="true" data-canvas-keys="off" aria-label="${escape(t('Export'))}">
            <div class="export-popup-head">
              <span class="export-popup-title">${t('Export')}</span>
              <button type="button" class="export-popup-close" data-export-close aria-label="${escape(t('Close'))}">&#x2715;</button>
            </div>
            <div class="export-popup-body" id="export-popup-body"></div>
          </div>
        </div>
      `
          : ''
      }
    </div>
  `;

  // Entrance settle (plans/142): a tool mounts as one brief fade instead of an
  // instant cut. The worst measured transition was a full-bleed dark canvas
  // (countdown) arriving over a near-white page - ΔL 0.90 with no easing. Armed
  // synchronously with the innerHTML above (view-enter.ts contract) so the first
  // paint already carries the hidden `from` state; reduced motion (OS or app
  // pref) skips arming entirely and renders instantly. The animated nodes are
  // the sidebar and the STAGE WRAPPER - never #tool-canvas itself, whose paint
  // is the user's artwork and is shared with the export path.
  armViewEnter(viewEl, '#tool-sidebar, .tool-stage');

  const canvasScope = hideSidebar ? '#tool-content' : '#tool-canvas';

  const styleEl = document.createElement('style');
  {
    const toolCss = tool.styles ? scopeCss(tool.styles, canvasScope) : '';
    // The chromeless editors own their own on-canvas affordances (free-canvas.js /
    // doc-editor.js), so skip the generic click-to-focus hover outline.
    const focusHint = chromeless
      ? ''
      : `
${canvasScope} [data-canvas-input] { cursor: pointer; }
${canvasScope} [data-canvas-input]:hover { outline: 2px dashed rgba(128,128,128,0.35); outline-offset: 3px; border-radius: 2px; }`;
    styleEl.textContent = `${toolCss}${focusHint}`;
    document.head.appendChild(styleEl);
  }

  const layout = viewEl.querySelector<HTMLElement>('#tool-layout')!;
  const inputsEl = viewEl.querySelector<PanelEl>('#tool-inputs');
  const canvasEl = hideSidebar ? null : viewEl.querySelector<HTMLElement>('#tool-canvas');
  const outerEl = hideSidebar ? null : viewEl.querySelector<HTMLElement>('#tool-canvas-outer');
  const contentEl = (hideSidebar ? viewEl.querySelector<HTMLElement>('#tool-content') : canvasEl)!;
  // The node the export/thumbnail actions target. Normally the fixed render canvas;
  // a bareExport full-bleed tool has no #tool-canvas, so it's the mounted #tool-content
  // (whose [data-export-root] mirror exportTargetNode then retargets). Non-null wherever
  // export is offered, unlike canvasEl which is null for every hideSidebar layout.
  const exportSourceNode = bareExport ? contentEl : canvasEl;

  // Shell chrome a full-bleed tool can host INSIDE its own top toolbar via
  // [data-shell-slot] hooks: the render/export control. Re-applied after each
  // template paint (paint() swaps innerHTML, recreating the empty slots).
  // The theme slot ([data-shell-slot="theme"]) is retired (2026-08-27, Andy):
  // full-bleed utilities now dock the consolidated profile menu top-right - theme,
  // sound/Neurospicy and Language all live inside it - so the standalone toggle
  // would be a duplicate control. Tools that still author the slot get an empty
  // span, which renders nothing.
  let placeRenderPill: (() => void) | null = null;
  const mountToolbarSlots = (): void => {
    placeRenderPill?.();
  };
  // Slide-sorter filmstrip for paged tools - mounted lazily on the first paint (below),
  // refreshed on each re-render, and torn down with the view. See lib/page-filmstrip.ts.
  let filmstrip: Filmstrip | null = null;
  // Interactive tools (gradient, street-map) commit canvas edits through
  // this per-canvas channel bound to the one runtime; the marker persists across
  // every innerHTML paint. (The legacy global-sidebar-poke path stays as their
  // fallback for offscreen export, where no canvas is mounted.)
  attachCanvasCommit(contentEl, runtime);
  // Inject the brand's semantic colour slots (--brand-primary, --brand-surface,
  // …) from the active tokens onto the canvas root, so templates can consume
  // `var(--brand-primary, <fallback>)`. Like the token-sourced swatches above
  // (setSwatches), this is best-effort and non-blocking for the interactive
  // mount: a missing tokens doc leaves the template fallbacks in charge. The
  // promise IS captured, though - the deep-link auto-export/copy/preview paths
  // await it (raced with a short cap so a stalled tokens fetch can't hold up a
  // capture beyond quiescence) so a `?export=` capture doesn't race the tokens
  // fetch and ship fallback colours. Namespaced --brand-* so the vars can never
  // collide with the shell's :root shadcn HSL triples (see brand-vars.ts).
  const brandVarsReady: Promise<unknown> = Promise.race([
    applyBrandVars(contentEl, host),
    new Promise<void>((resolve) => setTimeout(resolve, 3000)),
  ]).catch(() => {
    /* cosmetic - never block a mount or fail an export on brand vars */
  });
  // Always present in the template (both layouts render #tool-stage), so treat it
  // as non-null - mirrors mountTool's unguarded uses (ro.observe, fitCanvas, …).
  const stageEl = viewEl.querySelector<HTMLElement>('#tool-stage')!;

  // Undo / redo buttons in the header - the tappable counterpart to Cmd+Z/Cmd+Y,
  // and the primary way to trigger history on touch (no keyboard). Sit at the
  // right of the back-row, opposite the Tools pill. Each button stays
  // disabled while its stack is empty (refreshHistoryUI), and clicks route through
  // the same undoHistory/redoHistory the keyboard uses (so they show the toast too).
  // Only sidebar tools get the header pair. Editor-layout tools have no back-row -
  // their buttons live in the free-canvas toolbar rail instead (see the history
  // option passed to initFreeCanvas below). Plain hideSidebar tools (file
  // utilities with minimal inputs) stay keyboard-only.
  const backRow = viewEl.querySelector<HTMLElement>('.sidebar-back-row');
  if (backRow) {
    const group = document.createElement('div');
    group.className = 'history-controls';
    const mkBtn = (label: string, icon: string, onClick: () => void): HTMLButtonElement => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'history-btn';
      b.setAttribute('aria-label', label);
      b.title = label;
      b.innerHTML = icon;
      b.addEventListener('click', onClick);
      group.appendChild(b);
      return b;
    };
    const undoBtn = mkBtn(t('Undo'), ICON_UNDO, undoHistory);
    const redoBtn = mkBtn(t('Redo'), ICON_REDO, redoHistory);
    // (The sidebar language picker that used to sit here is gone: the canvas HUD's
    // profile avatar now opens the consolidated menu, which carries the Language row.)
    historyControls = {
      sync: (canUndo: boolean, canRedo: boolean) => {
        // If the button that ran the action is about to disable itself (e.g. the
        // last undo via keyboard), hand focus to its now-enabled sibling so a
        // disabled button doesn't drop focus to <body>.
        const active = document.activeElement;
        if (active === undoBtn && !canUndo && canRedo) redoBtn.focus();
        else if (active === redoBtn && !canRedo && canUndo) undoBtn.focus();
        undoBtn.disabled = !canUndo;
        redoBtn.disabled = !canRedo;
      },
    };
    backRow.appendChild(group);
    refreshHistoryUI(); // start disabled (empty history)
  }

  // Theme cycle toggle now lives in the canvas zoom HUD (setupStageNav below), not
  // the sidebar header - so it's shared by every canvas tool (including the
  // chromeless editor/Design, which has no sidebar) and the header stays
  // uncluttered. Built once here so setupStageNav can dock it into the HUD.
  const themeToggle = createThemeToggle(host as unknown as Parameters<typeof createThemeToggle>[0]);
  // The interface-sound (sfx) toggle rides the same HUD, right after the theme toggle, so
  // the editor/Design (which has no sidebar) can mute/unmute sounds from the canvas.
  const soundToggle = createSoundToggle(host as unknown as Parameters<typeof createSoundToggle>[0]);
  // The profile avatar sits after the sound toggle - icon only, opening the same
  // consolidated menu the main views' top-right avatar opens (theme, sound/Neurospicy,
  // Language, Settings…), so a canvas tool needs no separate sidebar language/theme controls.
  const profileToggle = createProfileControl(
    host as unknown as Parameters<typeof createProfileControl>[0],
    { className: 'stage-nav-profile' }
  );

  // Removed-image notice: announce it (live region) and let the user dismiss it.
  if (dropped.length) {
    announce(
      [
        unresolved.length
          ? tRaw(
              'An image used in this saved design is no longer available; the {fields} {were} left blank.',
              {
                fields: unresolved.map((d) => d.label).join(', '),
                were: fieldsWere(unresolved.length),
              }
            )
          : '',
        bakedLost.length
          ? tRaw("A frozen image's data was missing; the {fields} {were} left blank.", {
              fields: bakedLost.map((d) => d.label).join(', '),
              were: fieldsWere(bakedLost.length),
            })
          : '',
      ]
        .filter(Boolean)
        .join(' '),
      { assertive: true }
    );
    viewEl
      .querySelector('#dropped-assets-dismiss')
      ?.addEventListener('click', () => viewEl.querySelector('#dropped-assets-notice')?.remove());
  }
  viewEl
    .querySelector('#capture-hint-dismiss')
    ?.addEventListener('click', () => viewEl.querySelector('#capture-hint-notice')?.remove());
  viewEl
    .querySelector('#made-with-dismiss')
    ?.addEventListener('click', () => viewEl.querySelector('#made-with-notice')?.remove());
  viewEl.querySelector('#made-with-switch')?.addEventListener('click', async () => {
    if (!madeWith) return;
    const { switchDesignSystem } = await import('../lib/design-system/switch.ts');
    // The person asked for this session under its own design system: switch, then
    // remount this very route so the render is born with it (a just-opened saved
    // session holds no unsaved work yet).
    await switchDesignSystem(
      host as unknown as Parameters<typeof switchDesignSystem>[0],
      madeWith.id,
      { noRemount: true }
    );
    window.dispatchEvent(new Event('lolly:remount'));
  });
  // A switch while this tool is open (plans/186 section 3.4 step 6): the switch does
  // not tear a tool down, so it is told here and offered a reload.
  const onDesignSystemChanged = (e: Event): void => {
    const rec = (e as CustomEvent<{ id: string; label: string }>).detail;
    if (!rec || rec.id === mountedSystemId || viewEl.querySelector('#ds-switched-notice')) return;
    const body = viewEl.querySelector<HTMLElement>('.sidebar-body') ?? stageEl;
    const el = document.createElement('div');
    el.className = 'tool-notice';
    el.id = 'ds-switched-notice';
    el.setAttribute('role', 'status');
    el.innerHTML = `<span class="tool-notice-text">${t('Switched to <strong>{name}</strong>. Reload this tool to render with it.', { name: escape(rec.label) })} <button type="button" class="tool-notice-link" id="ds-switched-reload">${t('Reload')}</button></span><button type="button" class="tool-notice-close" id="ds-switched-dismiss" aria-label="${escape(t('Dismiss this message'))}">✕</button>`;
    body.prepend(el);
    el.querySelector('#ds-switched-reload')?.addEventListener('click', () =>
      window.dispatchEvent(new Event('lolly:remount'))
    );
    el.querySelector('#ds-switched-dismiss')?.addEventListener('click', () => el.remove());
  };
  window.addEventListener('lolly:design-system-changed', onDesignSystemChanged);

  // Export shutter: a canvas camera-iris that closes over the whole stage so the
  // brief full-res resize during export (the "shake") is never seen, then opens.
  // The mechanism, tuning and frame budget live in lib/shutter.ts.
  const shutter = createShutter(stageEl);
  const openShutter = (): void => shutter.open();
  // Named apart from the object because `shutter` is shadowed by the boolean opt
  // inside exportUnscaledRaw, which is where the progress actually arrives.
  const reportShutterProgress = (done: number, total: number): void =>
    shutter.progress(done, total);
  // A long export (video, a sequence, a big multi-page fan-out) seals the screen
  // for minutes - fullscreen on a phone - so it closes WITH a status block: the
  // tool name, the format, live progress and elapsed time, plus a way out. An
  // export that passed an abort signal gets Cancel (the encode loops poll it and
  // stop); the rest keep Hide, which opens the shutter and lets the export finish
  // underneath rather than claiming to stop it.
  // The block only appears once the export outlasts STATUS_DELAY (lib/shutter.ts),
  // which is what keeps a sub-second still export looking exactly as it did.
  const closeShutter = (detail?: string, onCancel?: () => void): Promise<void> =>
    shutter.close({
      label: tool.manifest.name,
      ...(detail ? { detail } : {}),
      onHide: () => {
        openShutter();
        announce(t('Exporting…'));
      },
      ...(onCancel ? { onCancel } : {}),
    });
  // Standalone visual (no export gating) - used by Copy, whose clipboard write
  // must stay in the user-gesture context, so we can't await the shutter first.
  function playShutter(): void {
    shutter.play();
  }
  const actionsEl = viewEl.querySelector<PanelEl>('#tool-actions');
  const sidebarEl = viewEl.querySelector<HTMLElement>('#tool-sidebar');

  // The tool's own walkthrough (manifest `guide`, components/tool-guide.ts): the
  // help button beside the title, plus one automatic open per device on a tool
  // the user hasn't opened before. mountModal bodies its dialog, so the handle is
  // kept to close it on teardown - a guide must not outlive the tool it explains.
  let openGuide: { close(): void } | null = null;
  viewEl.querySelector<HTMLButtonElement>('#tool-guide-btn')?.addEventListener('click', () => {
    openGuide = showToolGuide(tool.manifest);
  });
  // The automatic first-visit open is for someone who came to MAKE the thing.
  // Anyone arriving on a finished render - a fullscreen/auto-export share link,
  // or a chromeless editor embed - gets the button and nothing in their way.
  // Deferred a frame so the dialog opens over a painted canvas, not a blank one.
  if (showAside && !isFull && !autoExport && !autoCopy) {
    requestAnimationFrame(() => {
      if (viewEl.isConnected) openGuide = autoOpenToolGuide(tool.manifest) ?? openGuide;
    });
  }

  // ── Sidebar ──────────────────────────────────────────────────────────────

  const fullscreenToggle = viewEl.querySelector<HTMLButtonElement>('#fullscreen-toggle');
  const fullscreenToggleFloat = viewEl.querySelector<HTMLButtonElement>('#fullscreen-toggle-float');
  const dragHandle = viewEl.querySelector<HTMLElement>('#sidebar-drag-handle');
  const sheetGrip = viewEl.querySelector<HTMLElement>('#sheet-grip');

  function setSidebarWidth(w: number, save = true): void {
    if (!sidebarEl) return;
    const snapped = w < SIDEBAR_MIN ? 0 : w;
    sidebarEl.style.width = snapped + 'px';
    // Freeze the content width at the open size so collapsing to 0 clips rather
    // than reflows (kept on collapse - only updated while the panel is open).
    if (snapped > 0) sidebarEl.style.setProperty('--sb-open-w', snapped + 'px');
    // Publish the open width so the desktop export panel can match the sidebar.
    if (snapped > 0) layout.style.setProperty('--sidebar-w', snapped + 'px');
    const isOpen = snapped > 0;
    layout.dataset.sidebar = isOpen ? 'open' : 'closed';
    if (fullscreenToggle) {
      fullscreenToggle.toggleAttribute('open', isOpen);
      fullscreenToggle.setAttribute(
        'aria-label',
        isOpen ? t('Collapse sidebar') : t('Expand sidebar')
      );
    }
    if (save) localStorage.setItem('sidebarWidth', String(snapped));
  }

  // Canonical address-bar URL for this open tool: the path form /t/<id> (so a copied
  // link carries the per-tool OG preview - see scripts/build-tool-og.ts). All in-tool
  // URL writers (syncUrl, updateFullParam) build on this; the bar is rewritten from
  // the boot-time #/tool/<id> hash to this on the first syncUrl.
  // The Design tool owns the bare vanity path `/design` (main.ts parseRoute returns it as
  // a first-class route); keep the bar there instead of rewriting it to /t/design.
  const TOOL_URL_BASE = toolId === 'design' ? '/design' : `/t/${toolId}`;

  // The live param string, whichever URL form the bar is in: the path's ?search once
  // syncUrl has prettified it, or the hash's #…?query in the instant after boot.
  function currentQuery(): string {
    if (window.location.search) return window.location.search.slice(1);
    const qi = window.location.hash.indexOf('?');
    return qi >= 0 ? window.location.hash.slice(qi + 1) : '';
  }

  function getRestoreWidth(): number {
    const v = Number(localStorage.getItem('sidebarWidth'));
    return v > SIDEBAR_MIN ? v : SIDEBAR_DEFAULT;
  }

  function updateFullParam(shouldBeFull: boolean): void {
    const sp = new URLSearchParams(currentQuery());
    if (shouldBeFull) sp.set('full', '');
    else sp.delete('full');
    const parts: string[] = [];
    for (const [k, v] of sp.entries()) parts.push(v ? `${k}=${encodeURIComponent(v)}` : k);
    const q = parts.join('&');
    history.replaceState(null, '', q ? `${TOOL_URL_BASE}?${q}` : TOOL_URL_BASE);
  }

  // Canvas pan/zoom handle for the stage, assigned once the canvas is wired
  // (see setupStageNav below). Reset whenever the stage is resized by a
  // sidebar toggle so the preview returns to a clean fit.
  let stageZoom: StageNav | null = null;
  // The Design mark menu lives on the free-canvas handle, which mounts after the stage
  // nav; the docked HUD's swirl reaches it through this late-bound slot.
  let openDesignMarkMenu: ((anchor: HTMLElement) => void) | null = null;
  let onFocusRect: ((e: Event) => void) | null = null;

  if (showAside) {
    fullscreenToggle!.addEventListener('click', () => {
      const opening = layout.dataset.sidebar !== 'open';
      setSidebarWidth(opening ? getRestoreWidth() : 0);
      updateFullParam(!opening);
      stageZoom?.reset();
      setTimeout(fitCanvas, 220);
    });

    fullscreenToggleFloat!.addEventListener('click', () => {
      setSidebarWidth(getRestoreWidth());
      updateFullParam(false);
      stageZoom?.reset();
      setTimeout(fitCanvas, 220);
    });

    // Drag to resize
    {
      let dragging = false;
      let startX = 0;
      let startW = 0;

      dragHandle!.addEventListener('pointerdown', (e) => {
        dragging = true;
        startX = e.clientX;
        startW = sidebarEl!.getBoundingClientRect().width;
        sidebarEl!.classList.add('is-dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        dragHandle!.setPointerCapture(e.pointerId);
      });

      dragHandle!.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const w = Math.min(600, Math.max(0, startW + (e.clientX - startX)));
        setSidebarWidth(w, false);
      });

      dragHandle!.addEventListener('pointerup', () => {
        if (!dragging) return;
        dragging = false;
        sidebarEl!.classList.remove('is-dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setSidebarWidth(sidebarEl!.getBoundingClientRect().width);
        fitCanvas();
      });
    }

    // Apply saved/initial width without triggering a save
    setSidebarWidth(sidebarOpen ? openWidth : 0, false);
  }

  // ── Responsive canvas ─────────────────────────────────────────────────────
  //
  // The canvas stays at its DOM-declared pixel dimensions so that CSS
  // getComputedStyle and exports work correctly. A CSS transform scales it
  // visually to fit the available stage width. The outer wrapper is sized to
  // the visual (scaled) dimensions so the layout doesn't leave a gap.

  function fitCanvas(): void {
    if (visitorPage) return; // a visitor page flows as a document - never scaled to fit
    if (!canvasEl || !outerEl) return;
    if (stageZoom?.isZoomed()) return; // preserve pan/zoom across window/sidebar resize
    if (pagesMode) {
      fitPages();
      return;
    } // carousel: fit the page strip, not one page
    if (pagedDoc) {
      fitPagedDoc();
      return;
    } // multi-page doc: fit one page's width; the stage scrolls
    const canvasW = parseInt(canvasEl.style.width, 10) || nativeW;
    const canvasH = parseInt(canvasEl.style.height, 10) || nativeH;
    const stageRect = stageEl.getBoundingClientRect();

    // On mobile the controls sheet overlaps the top of the (static) preview stage.
    // Pad the stage down by however much the sheet currently covers it, so Fit
    // sizes AND centres the canvas within the area the sheet leaves visible - not
    // behind it. getBoundingClientRect is the border-box (padding-independent), so
    // the scale math stays stable as we set the padding.
    let topPad = 0;
    if (sidebarEl && window.matchMedia('(max-width: 640px)').matches) {
      const sheetBottom = sidebarEl.getBoundingClientRect().bottom;
      topPad = Math.max(0, Math.min(stageRect.height, sheetBottom - stageRect.top));
    }
    const padPx = topPad ? `${topPad}px` : '';
    if (stageEl.style.paddingTop !== padPx) stageEl.style.paddingTop = padPx; // guard the ResizeObserver

    // A view can reserve top/bottom chrome bands (via --stage-reserve-* on the stage) so the
    // fitted canvas sits BETWEEN its docked toolbars instead of under them - the deck editor
    // uses this to lift its freeform toolbars out of the canvas. Default 0 → wholly inert for
    // every other tool. Reserved as flex MARGINS on the centred outer (not stage padding - the
    // overlay is inset to the stage's padding box, so padding would drag the toolbars in with
    // it); justify-content:center then honours the margins, floating the canvas into the band.
    const cs = getComputedStyle(stageEl);
    const reserveTop = Math.max(0, parseFloat(cs.getPropertyValue('--stage-reserve-top')) || 0);
    const reserveBottom = Math.max(
      0,
      parseFloat(cs.getPropertyValue('--stage-reserve-bottom')) || 0
    );
    // Left band: the free-canvas rail docks into a fixed-width left panel while the
    // timeline is open (see dockRailForTimeline). Same margin mechanism as top/bottom -
    // centring the margin box puts the canvas exactly centred in the remaining band.
    const reserveLeft = Math.max(0, parseFloat(cs.getPropertyValue('--stage-reserve-left')) || 0);
    // There is NO right band. The one right-hand column is the app's edge dock
    // (lib/edge-dock.ts) - the export sheet, the compact zoom bar and the Design
    // inspector all take a slot in it - and that column reserves its space by nudging
    // `#view` with `--dock-w`, so the stage this function measures is already narrower.
    // Subtracting a second right reserve on top of it took the space twice and left the
    // canvas sitting off-centre to the left of its own surface.
    const availW = Math.max(40, stageRect.width - reserveLeft - 32);
    const availH = Math.max(40, stageRect.height - topPad - reserveTop - reserveBottom - 32);
    const scale = Math.min(1, availW / canvasW, availH / canvasH);
    canvasEl.style.transform = scale < 1 ? `scale(${scale.toFixed(4)})` : '';
    outerEl.style.width = Math.round(canvasW * scale) + 'px';
    outerEl.style.height = Math.round(canvasH * scale) + 'px';
    outerEl.style.marginTop = reserveTop ? `${reserveTop}px` : '';
    outerEl.style.marginBottom = reserveBottom ? `${reserveBottom}px` : '';
    outerEl.style.marginLeft = reserveLeft ? `${reserveLeft}px` : '';
    outerEl.style.marginRight = '';
    stageZoom?.sync(); // refresh the zoom % readout after a re-fit
  }

  // Reset pan/zoom and re-fit. Passed to renderActions so a dimension change always
  // returns to a clean fitted view rather than leaving a panned/zoomed canvas.
  //
  // The fit is the CONTENT fit (`stageZoom.fit()`), the same one `refitStage` and the
  // `canvas-resize` listener use since plan 179 C5 - not `reset() + fitCanvas()`, which
  // frames the export box alone. `setCanvasSize` calls this, and `importAsArtboards`
  // calls `setCanvasSize` the moment its rows commit: a 20-slide .pptx was therefore
  // framed on slide 1 with slides 2-20 off the right edge and nothing saying they were
  // there, on the newest path, with no later re-fit (the ResizeObserver watches the
  // stage, whose size did not change). `fit()` resets first, so the "return to a clean
  // fitted view" contract is unchanged; a tool with no artboards cannot tell the
  // difference, since the content rect is then null and fit() is exactly what this was.
  function resetView(): void {
    if (stageZoom) stageZoom.fit();
    else fitCanvas();
  }

  // ── Multi-page document canvas (render.paged) ──────────────────────────────
  // A paged tool stacks its [data-pdf-page] boxes vertically and the STAGE scrolls the
  // whole document - every page visible at full length, not one page clipped with an
  // inner scroll (the old behaviour where pages "appeared out of nowhere"). We fit ONE
  // page's width to the surface with `zoom` (not a transform: zoom shrinks the layout
  // box too, so the scroll surface measures the pages at their on-screen size and scrolls
  // correctly). Height grows via CSS (#tool-canvas + its root are height:auto here), so
  // adding a page just makes the surface taller. `zoom` is neutralised during export
  // (exportUnscaled) so each page still prints at its true, unscaled page size.
  function fitPagedDoc(): void {
    if (!canvasEl) return;
    // A web-page preview never zooms: the canvas IS the viewport, CSS gives it
    // the pane's full width and the content reflows there like a real page.
    if (webDoc) {
      canvasEl.style.zoom = '';
      stageZoom?.sync();
      return;
    }
    const stageRect = stageEl.getBoundingClientRect();
    // Leave the surface's side padding (24px each) PLUS room for each page's drop-shadow,
    // so the left/right shadows aren't clipped by the scroll surface.
    const availW = Math.max(40, stageRect.width - 96);
    const zoom = Math.min(1, availW / nativeW); // never upscale past 1:1
    canvasEl.style.zoom = zoom < 1 ? String(Number(zoom.toFixed(4))) : '';
    stageZoom?.sync();
  }

  // ── Multi-page (carousel) canvas ──────────────────────────────────────────
  // The editor canvas is a horizontal strip of N same-size page frames. render.width/
  // height stay ONE page's size (each [data-pdf-page] frame + PDF page is page-sized);
  // the STRIP width is derived from the live page-count + page-size inputs and applied
  // to #tool-canvas so the free-canvas overlay's coordinate math (which reads
  // canvasEl.style.width) stays correct. Fit shows up to three pages at a workable size
  // (fit-to-single-page is off) - the zoom/pan HUD reaches the rest.
  function pageGeom(): { count: number; pw: number; ph: number; gap: number; stripW: number } {
    const cfg = pagesCfg!;
    const gap = cfg.gap ?? 56;
    const min = cfg.min ?? 1,
      max = cfg.max ?? 6;
    const read = (id: string, dflt: number): number => {
      const v = runtime.getModel().find((i) => i.id === id)?.value;
      const n = typeof v === 'number' ? v : parseFloat(v as string);
      return Number.isFinite(n) ? n : dflt;
    };
    const count = Math.max(min, Math.min(max, Math.round(read(cfg.count, 3))));
    const pw = Math.max(1, Math.round(read(cfg.width, nativeW)));
    const ph = Math.max(1, Math.round(read(cfg.height, nativeH)));
    return { count, pw, ph, gap, stripW: count * pw + (count - 1) * gap };
  }
  function fitPages(): void {
    if (!canvasEl || !outerEl || !pagesCfg) return;
    const g = pageGeom();
    const stageRect = stageEl.getBoundingClientRect();
    const availW = Math.max(40, stageRect.width - 32);
    const availH = Math.max(40, stageRect.height - 32);
    // Fit up to three pages wide (identical to the whole strip when count ≤ 3); the
    // strip scales as one unit (transform-origin: top left) so overlay geometry holds.
    const shown = Math.min(g.count, 3);
    const viewW = shown * g.pw + (shown - 1) * g.gap;
    const scale = Math.min(1, availW / viewW, availH / g.ph);
    canvasEl.style.transform = scale !== 1 ? `scale(${scale.toFixed(4)})` : '';
    outerEl.style.width = Math.round(g.stripW * scale) + 'px';
    outerEl.style.height = Math.round(g.ph * scale) + 'px';
    stageZoom?.sync();
  }
  // (Re)size #tool-canvas to the current page strip and re-fit. Only fires when the
  // strip dimensions actually change (page count / size), so an ordinary box edit
  // never resets the view.
  let prevStripKey = '';
  function syncStrip(): void {
    if (!pagesMode || !canvasEl) return;
    const g = pageGeom();
    const key = g.stripW + 'x' + g.ph;
    if (key === prevStripKey) return;
    prevStripKey = key;
    canvasEl.style.width = g.stripW + 'px';
    canvasEl.style.height = g.ph + 'px';
    stageZoom?.reset();
    fitPages();
  }
  if (pagesMode) syncStrip(); // size the strip before the first fit

  // Re-fit after the stage (or the canvas) changed size. At Fit this is the FULL fit,
  // which since plan 179 C5 means "the canvas, then the artboard union on top of it" -
  // so a deck's framing tracks a window resize, and a template load that brings in new
  // artboards is framed rather than left half off-screen. A view the USER zoomed or
  // panned is untouched, exactly as before (fitCanvas's own isZoomed guard), and a tool
  // with no artboards cannot tell the difference: stageZoom.fit() is then reset() (a
  // no-op at Fit) plus the same fitCanvas call this always made.
  function refitStage(): void {
    if (stageZoom && !stageZoom.isUserZoomed()) stageZoom.fit();
    else fitCanvas();
  }

  // The stage resized, so the canvas re-fits - and every remote focus ring and
  // cursor was anchored from rects that just moved. `collabReanchor` is null unless
  // a collab is live, so this stays the one-call observer it has always been.
  const ro = new ResizeObserver(() => {
    refitStage();
    collabReanchor?.();
  });
  ro.observe(stageEl);
  fitCanvas();
  if (canvasEl) canvasEl.addEventListener('canvas-resize', refitStage);

  // Canvas navigation - one module for both pointer types. Touch gets pinch-zoom +
  // drag-pan; desktop gets trackpad-native zoom/pan (Cmd/Ctrl-wheel & pinch zoom
  // about the cursor, Space/middle-drag pan, 0/1/+/- keys) plus a Fit/% HUD.
  if (stageEl && !hideSidebar && !visitorPage && outerEl && canvasEl && !pagedDoc) {
    // The other direction of the `fc-focus-rect` seam (plan 179 C5): the stage ASKS the
    // overlay for a rect worth framing - the union of the document's artboards for Fit,
    // the selection's AABB for Shift+2. The dispatch is synchronous, so the answer is on
    // `detail.rect` by the time it returns; with no overlay mounted (every tool but the
    // canvas editors) or no artboards in the document it stays null, and Fit then does
    // exactly what it always did.
    const askRect =
      (what: 'content' | 'selection' | 'active') =>
      (): { x: number; y: number; w: number; h: number } | null => {
        const detail: {
          what: string;
          rect: { x: number; y: number; w: number; h: number } | null;
        } = { what, rect: null };
        try {
          stageEl.dispatchEvent(new CustomEvent('fc-query-rect', { detail }));
        } catch {
          return null;
        }
        return detail.rect;
      };
    const contentRect = askRect('content');
    // Pass fitCanvas as the "fit" action so the HUD's Fit button re-fits to the
    // CURRENT layout (e.g. the area left by the mobile sheet), not just the
    // stale fit that reset() restores. themeToggle docks into the HUD (its icon
    // sits alongside the zoom controls; see setupStageNav).
    // The Design editor gets NO floating HUD: its top bar carries Fit / ± / NN% (plan 179
    // M1), and the swirl pill was the second of two zoom controls on one stage. The theme
    // and sound toggles the HUD used to host move with it - into the bar's mark menu, via
    // the `chrome` option on initFreeCanvas below - so nothing is lost, only re-homed.
    // Every gesture (pinch, wheel, space-pan, 0/1/+/-) is unchanged either way.
    // In the Design editor the HUD is built hidden and docks itself into the right
    // sidebar's compact bar (mark menu, zoom, theme, sound, profile) whenever that
    // column holds a panel; the top bar carries the zoom cluster and the avatar only
    // while nothing is docked (Andy, 2026-09-03: "the zoom / theme / profile menu are
    // meant to be part of the right dock if it is opened, we don't need to recreate
    // those things in the top panel"). The mark menu opener is late-bound: the
    // free-canvas handle that owns the menu is created further down.
    stageZoom = setupStageNav(
      stageEl,
      outerEl,
      canvasEl,
      nativeW,
      fitCanvas,
      themeToggle,
      soundToggle,
      profileToggle,
      {
        contentRect,
        activeRect: askRect('active'),
        selectionRect: askRect('selection'),
        hud: !designChrome,
        editorLayout: !!designChrome,
        onMarkMenu: designChrome
          ? (anchor: HTMLElement) => {
              openDesignMarkMenu?.(anchor);
            }
          : undefined,
      }
    );
    // The Artboards navigator (free-canvas) asks the stage to frame one artboard by
    // dispatching `fc-focus-rect` with the frame's native rect - the overlay never
    // touches the pan/zoom transform itself. Wired here because only tool.ts holds the
    // StageNav handle; torn down with the view in _cleanup below.
    onFocusRect = (e: Event): void => {
      const d = (e as CustomEvent<{ x: number; y: number; w: number; h: number }>).detail;
      if (d) stageZoom?.focusRect(d.x, d.y, d.w, d.h);
    };
    stageEl.addEventListener('fc-focus-rect', onFocusRect);

    // A document with artboards OPENS showing all of them. Both halves of the answer land
    // after this line - the runtime paints the frame pages asynchronously and the overlay
    // that reports them is a lazy chunk - so poll a bounded run of frames for the first
    // content rect, exactly like the `?present` auto-entry below, and fit once. Any hand
    // on the trackpad (or a deep link that framed something) wins and stops the poll.
    {
      let tries = 0;
      const openFit = (): void => {
        if (!viewEl.isConnected || !stageZoom || stageZoom.isUserZoomed()) return;
        if (contentRect()) {
          stageZoom.fit();
          return;
        }
        if (tries++ < 120) requestAnimationFrame(openFit); // ~2s at 60fps, then give up
      };
      requestAnimationFrame(openFit);
    }
  } else if (stageEl && pagedDoc && (themeToggle || soundToggle)) {
    // Paged docs navigate by NATIVE scroll of the canvas surface (no pan/zoom transform),
    // so there's no zoom HUD - but the theme / sound toggles still dock in the same
    // bottom-right cluster every canvas tool carries.
    const hud = document.createElement('div');
    hud.className = 'stage-nav stage-nav--chrome';
    if (themeToggle) hud.append(themeToggle);
    if (soundToggle) hud.append(soundToggle);
    stageEl.appendChild(hud);
  } else if (hideSidebar && !visitorPage && !isFull) {
    // Full-bleed utility (is-bare): no zoom HUD, but the consolidated profile menu
    // (theme, sound/Neurospicy, Language, Settings) docks top-right in the reserved
    // chrome strip - the mirror of the back pill's top-left pin, reusing the main
    // views' .gallery-topright cluster (chrome layer, globally loaded). This replaces
    // the standalone theme toggle these tools used to host in their own toolbars.
    // Appended to the layout so the view's innerHTML swap tears it down; the menu
    // popover itself already closes on any navigation (NAV_EVENTS).
    const cluster = document.createElement('div');
    cluster.className = 'gallery-topright';
    cluster.appendChild(
      createProfileControl(host as unknown as Parameters<typeof createProfileControl>[0])
    );
    layout.appendChild(cluster);
  }

  // ── Live collab: presence chrome (plan 100 section 4.6, section 5) ───────────────────────
  //
  // The ONE place a mounted tool becomes a collab, and the only place in this view
  // that knows presence exists. It is DEAD in this repo: nothing registers a session
  // source (lib/collab-session-source.ts), so `acquireCollabSession` returns null
  // having allocated nothing, the presence chunk is never fetched, no node is
  // created, no listener or timer is armed, and the mount stays byte-identical to
  // the single-player one it has always been.
  //
  // It sits HERE, and not beside the op plumbing it belongs to (search "Live collab
  // (plan 100 section 5)"), for two reasons that are both about the DOM: presence is chrome,
  // so it needs the stage, the render surface and the sidebar root, which the view's
  // innerHTML only creates further up; and the pill shares the stage's top-inline-end
  // lane with the zoom HUD, so it can only measure what it is clearing after
  // setupStageNav has built it.
  //
  // The composition itself lives in ./tool-collab.ts - see that file's header for why
  // it is a module rather than a hundred lines here (it is the half of this that can
  // actually be tested, and the half that must not ride the tool chunk).
  const collabHandle = acquireCollabSession(tool.manifest.id, slot ?? null);
  if (collabHandle) {
    // ONE transport per mount. The plumbing attached at mount time talks to whatever
    // `canvas-sync-provider` holds; the session attaches its OWN against this handle's
    // adapter (and wraps it for an observer's role, which the bare plumbing cannot
    // know about). Two attachments over one adapter would emit every local edit
    // twice, so the session's is the one that survives. `detach()` is idempotent, so
    // _cleanup calling it again later is free.
    collab?.detach();

    // The teardown holder is armed BEFORE the await, which is the whole reason this
    // shape is not a plain `const collab = await …`. A navigation during the import
    // (or during the token read behind it) runs _cleanup while nothing is mounted
    // yet: `aborted` latches, and the composition that lands a moment later is torn
    // straight back down instead of taking over a view that is already gone - with
    // its presence heartbeat running, in a detached tree, forever.
    let mounted: ToolCollab | null = null;
    let aborted = false;
    collabTeardown = () => {
      aborted = true;
      collabReanchor = null;
      mounted?.teardown();
      mounted = null;
    };
    try {
      const { mountToolCollab } = await import('./tool-collab.ts');
      const built = await mountToolCollab({
        handle: collabHandle,
        runtime,
        toolManifest: tool.manifest,
        host,
        // Where a RECEIVED beam lands (the same object as `host` unless this mount is an
        // acceptor's), and the export bar's `__export_*` markers, read at press time so a
        // beamed session reopens at the size, unit, DPI and profile it was sent at rather
        // than at tool defaults. `actionsApi` is built further down; both are closures, so
        // neither is read until the human presses send.
        libraryHost,
        exportSettings: () => actionsApi?.sessionState?.() ?? null,
        // The stage hosts the pill and the overlay layer; the render surface is
        // passed to be MEASURED and never written to, which is what keeps an export
        // byte-identical whether or not anyone is watching (section 4.6, section 8).
        stage: stageEl,
        canvas: contentEl,
        sidebar: inputsEl,
      });
      if (aborted) built.teardown();
      else {
        mounted = built;
        collabReanchor = () => built.reanchor();
      }
    } catch (e) {
      // A presence stack that fails to load costs the user their collab, never their
      // tool: the transport is closed and the mount carries on single-player.
      console.warn('[lolly:collab] presence failed to mount', e);
      collabTeardown = null;
      try {
        collabHandle.close();
      } catch {
        /* the transport's failure is not the view's */
      }
    }
  }

  // Mobile (≤640px): the sidebar becomes a top-anchored controls panel with the
  // grip on its bottom edge; the preview fills below. Dragging the grip down grows
  // the controls (grip tracks the finger), releasing snaps to peek/half/full, and
  // the preview re-fits to whatever space the panel leaves.
  if (!hideSidebar && sheetGrip && sidebarEl) {
    // The preview is a static backdrop the sheet slides over, so half/full snaps
    // leave it untouched. But collapsing to peek (grip dragged to the top) vacates
    // most of the screen - re-fit there so the canvas grows into the freed space.
    // fitCanvas no-ops if the user has zoomed/panned, so this only fires at Fit.
    // Wait out the 0.34s height settle so it measures the final sheet position.
    setupMobileSheet(layout, sidebarEl, sheetGrip, {
      onChange: (snap) => {
        if (snap === 'peek') setTimeout(fitCanvas, 360);
      },
    });
  }

  // Collapse the export/actions panel behind a "Render" button on BOTH mobile and
  // desktop: the wired #tool-actions node moves into the popup (its listeners
  // survive the move). Mobile presents it as a full-screen sheet; desktop as a
  // non-modal panel anchored to the sidebar bottom - pure CSS difference (app.css).
  let exportTeardown: (() => void) | null = null;
  // The image-framing overlay's unsubscribe (plans/148). Null unless the tool
  // declares a framing control; torn down with the view like the export chrome.
  let framingTeardown: (() => void) | null = null;
  // The "Save" half of the render pill - assigned just below, but declared out here
  // so the dirty-state helpers (markSessionDirty / markSessionSaved, defined later)
  // can flash and clear it from the input-change chokepoint.
  let renderSaveBtn: HTMLButtonElement | null = null;
  const renderPill = viewEl.querySelector<HTMLElement>('#render-pill');
  // The ambient URL-budget gauge (plan 115 P1) - a draggable vertical bar showing the
  // share-link cost of the current edit (reads the P0 cost model, never the address bar).
  // The instance is created after actionsApi (below) so a click can open the Share dialog;
  // the holder is declared here so syncUrl + _cleanup (both above that point) can see it.
  const urlGaugeEl = viewEl.querySelector<HTMLElement>('#url-budget-gauge');
  let urlGauge: UrlGauge | null = null;
  const renderFab = viewEl.querySelector<HTMLButtonElement>('#render-fab'); // the "Export" half (opens export)
  renderSaveBtn = viewEl.querySelector<HTMLButtonElement>('#render-save'); // the "Save" half (outer-scoped)
  const exportOverlay = viewEl.querySelector<HTMLElement>('#export-overlay');
  const exportBody = viewEl.querySelector<HTMLElement>('#export-popup-body');
  if (
    (!hideSidebar || bareExport) &&
    renderFab &&
    exportOverlay &&
    exportBody &&
    actionsEl &&
    renderPill
  ) {
    const mqMobile = window.matchMedia('(max-width: 640px)');
    const exportPopup = exportOverlay.querySelector<HTMLElement>('.export-popup')!;
    // The export panel is modal ONLY on mobile, where it's a full bottom sheet over a
    // scrim. On desktop it's a NON-modal panel anchored to the sidebar bottom - the
    // inputs above and the resize handle must stay live (users routinely open Export,
    // then go back to editing before downloading), so we neither inert the background
    // nor trap Tab there. The markup hard-codes aria-modal; we correct it per
    // breakpoint here. applyModality reconciles inert + aria-modal with both the open
    // state and the current breakpoint, so it's safe to re-run on resize too.
    const isModal = (): boolean => mqMobile.matches;
    const applyModality = (): void => {
      const modal = layout.classList.contains('export-open') && isModal();
      for (const child of layout.children) {
        if (child !== exportOverlay) (child as HTMLElement).inert = modal; // pointer + Tab blocked behind the sheet
      }
      exportPopup.setAttribute('aria-modal', modal ? 'true' : 'false');
    };
    const closeExport = (): void => {
      const wasOpen = layout.classList.contains('export-open');
      // If edge-docked, undock first so the popup returns to its overlay and the
      // export-open removal actually hides it (docked, it lives outside the overlay).
      if (isDocked('export')) releaseDock('export');
      layout.classList.remove('export-open');
      renderFab.setAttribute('aria-expanded', 'false');
      actionsApi?.stopAudioPreview?.(); // silence any audio audition when the popup closes
      // The pneumatic 'pushhh' as the door seals shut - here (not on the close controls)
      // so every dismissal path (✕, scrim, Escape, flick-down) sounds it exactly once, and
      // only when a panel was actually open (defensive/duplicate closes stay silent). The
      // matching 'shhhht' open rides the trigger's data-sfx, which every open path clicks.
      if (wasOpen) playSfx('hydraulicClose');
      // The mirror of 'lolly:export-open': anything showing a value the sheet also edits
      // has to re-read it on the way OUT too. The document name is the case that bit -
      // the sheet's Filename field and the design top bar's name field are two views of
      // one string, and a rename that was normalised or reverted as the sheet closed left
      // the bar showing the value the user no longer had.
      if (wasOpen) actionsEl.dispatchEvent(new CustomEvent('lolly:export-close'));
      applyModality(); // un-inert before returning focus to the trigger
      // Return focus to the trigger. In editor mode the render pill is hidden, so the
      // visible Export control is the real trigger: the design top bar's when it is
      // mounted (plan 179 M1 - it is the primary now), the rail icon otherwise.
      const focusTarget =
        (chromeless
          ? (viewEl.querySelector<HTMLElement>('[data-topbar="export"]') ??
            viewEl.querySelector<HTMLElement>('.fc-action-primary'))
          : null) ?? renderFab;
      focusTarget.focus();
    };
    // Subscribers to "the sheet just opened" - today only the float wiring below, which
    // uses it to put the sheet back in the right-hand column the user keeps it in.
    const exportOpenHooks = new Set<() => void>();
    const openExport = ({ focus = true }: { focus?: boolean } = {}): void => {
      layout.classList.add('export-open');
      renderFab.setAttribute('aria-expanded', 'true');
      applyModality();
      // Let the panel refresh anything derived from live state (the auto
      // filename placeholder follows the inputs and the provenance toggles).
      actionsEl.dispatchEvent(new CustomEvent('lolly:export-open'));
      // …and tell the float wiring, which is where the sheet decides whether it belongs
      // in the one right-hand column. A plain event will not do: the actions panel is a
      // DESCENDANT of the popup, so an event fired on it never reaches a listener on the
      // popup, and the sheet has to be placed before focus moves into it.
      for (const cb of [...exportOpenHooks]) {
        try {
          cb();
        } catch (e) {
          console.error(e);
        }
      }
      // Move focus into the dialog (its close button) for keyboard/SR users - but
      // not when auto-opened from ?options on load, where grabbing focus is jarring.
      if (focus) exportOverlay.querySelector<HTMLElement>('.export-popup-close')?.focus();
    };
    // Actions live in the Render popup on every breakpoint. The Get|Save pill
    // lives INSIDE the sidebar on desktop (a centred footer) but must sit OUTSIDE
    // it on mobile, where it's a viewport FAB the sheet's overflow would clip.
    const placeActions = (): void => {
      if (actionsEl.parentElement !== exportBody) exportBody.appendChild(actionsEl);
      // A full-bleed tool can host the pill INSIDE its own toolbar via
      // [data-shell-slot="export"] (desktop). Otherwise: no sidebar in chromeless
      // modes → the pill floats over the stage (like mobile); else it docks under
      // the sidebar. The slot only exists once the template has painted, so this is
      // re-run from paint() via placeRenderPill below.
      const exportSlot = !mqMobile.matches
        ? contentEl.querySelector<HTMLElement>('[data-shell-slot="export"]')
        : null;
      const fabDest =
        exportSlot ?? (mqMobile.matches || chromeless || !sidebarEl ? layout : sidebarEl);
      if (renderPill.parentElement !== fabDest) fabDest.appendChild(renderPill);
    };
    placeRenderPill = placeActions;
    renderFab.setAttribute('aria-haspopup', 'dialog');
    renderFab.setAttribute('aria-expanded', 'false');
    renderFab.addEventListener('click', () => openExport());
    exportOverlay
      .querySelectorAll('[data-export-close]')
      .forEach((el) => el.addEventListener('click', closeExport));
    // Escape closes the export popup; Tab is wrapped so focus stays within the
    // sheet (a belt-and-braces companion to the inert background above - inert
    // alone can let Tab graze the browser chrome between the last and first stop).
    const onExportKey = (e: KeyboardEvent): void => {
      if (!layout.classList.contains('export-open')) return;
      if (e.key === 'Escape') {
        closeExport();
        return;
      }
      if (e.key !== 'Tab' || !isModal()) return; // only trap Tab in the modal (mobile) sheet
      const focusables = [
        ...exportOverlay.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ),
      ].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusables.length === 0) return;
      const first = focusables[0]!,
        last = focusables[focusables.length - 1]!;
      // Only wrap when focus is already at an edge of the popup - if it's elsewhere
      // (e.g. an auto-opened panel the user hasn't tabbed into yet) leave Tab alone.
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onExportKey);

    // Flick-down to dismiss the export popup - the same instinct as swiping a
    // bottom sheet away. The popup follows the finger; release past a threshold
    // (or a fast flick) closes it, otherwise it springs back. Drags from the
    // (scrollable) body only engage at the top, so the list still scrolls.
    let py = 0,
      pt = 0,
      pdrag = false;
    const popupStart = (e: TouchEvent): void => {
      pdrag = mqMobile.matches && e.touches.length === 1;
      // Never engage the flick-to-dismiss when the touch lands on a scrubbable
      // control - the export-size fields own the full horizontal drag of their
      // value, so a diagonal scrub must not also drag the sheet down.
      if (pdrag && (e.target as HTMLElement).closest?.('[data-scrub]')) pdrag = false;
      if (pdrag && exportBody.contains(e.target as Node) && exportBody.scrollTop > 0) pdrag = false;
      if (!pdrag) return;
      py = e.touches[0]!.clientY;
      pt = e.timeStamp;
    };
    const popupMove = (e: TouchEvent): void => {
      if (!pdrag) return;
      const dy = e.touches[0]!.clientY - py;
      if (dy <= 0) {
        exportPopup.style.transform = '';
        return;
      } // upward → ignore
      e.preventDefault(); // claim the gesture from scroll
      exportPopup.classList.add('is-popup-dragging');
      exportPopup.style.transform = `translateY(${dy}px)`;
    };
    const popupEnd = (e: TouchEvent): void => {
      if (!pdrag) return;
      pdrag = false;
      const dy = (e.changedTouches[0]?.clientY ?? py) - py;
      exportPopup.classList.remove('is-popup-dragging');
      exportPopup.style.transform = ''; // hand back to the CSS transition
      if (dy > 0 && flickDirection(dy, e.timeStamp - pt) === 1) closeExport();
    };
    exportPopup.addEventListener('touchstart', popupStart, { passive: true });
    exportPopup.addEventListener('touchmove', popupMove, { passive: false });
    exportPopup.addEventListener('touchend', popupEnd, { passive: true });
    exportPopup.addEventListener('touchcancel', popupEnd, { passive: true });

    // Free-floating desktop behaviour: drag the head to move, grips to resize,
    // maximise to full height, dock to snap back - persisted per device. A "free"
    // layout (canvas/chromeless, no sidebar to dock under) opens floated. Mobile
    // keeps its bottom-sheet + flick-dismiss; the module no-ops under 641px.
    const exportHead = exportPopup.querySelector<HTMLElement>('.export-popup-head');
    const floatTeardown = exportHead
      ? wireExportPanelFloat({
          overlay: exportOverlay,
          popup: exportPopup,
          head: exportHead,
          isMobile: () => mqMobile.matches,
          freeLayout: chromeless || !sidebarEl,
          editorLayout,
          onOpen: (cb) => {
            exportOpenHooks.add(cb);
            return () => {
              exportOpenHooks.delete(cb);
            };
          },
        })
      : null;

    placeActions();
    // ?options share-links land with the export panel already open (no focus grab).
    if (showExportPanel) openExport({ focus: false });
    const onBreakpoint = (): void => {
      placeActions();
      applyModality();
    };
    mqMobile.addEventListener('change', onBreakpoint);
    exportTeardown = () => {
      mqMobile.removeEventListener('change', onBreakpoint);
      document.removeEventListener('keydown', onExportKey);
      floatTeardown?.();
    };
  }

  // Cleanup: remove injected <style>, disconnect observer, tear down canvas nav + export.
  viewEl._cleanup = () => {
    // Abort late continuations and release scope-owned resources before dismantling
    // the DOM they are allowed to address. The scope is idempotent and failure-isolated.
    mountLifecycle.dispose();
    window.removeEventListener('lolly:design-system-changed', onDesignSystemChanged);
    // Release the live camera FIRST and guarded: it's the one teardown step whose failure
    // leaves hardware running, and a throw anywhere in this teardown used to abort the whole
    // navigation (the scanner trap - see the router guard in main.ts). Idempotent, so the
    // ordered call below re-runs harmlessly.
    try {
      runtime.stopLive?.();
    } catch (e) {
      console.error('[tool] stopLive on teardown:', e);
    }
    urlGauge?.dispose(); // cancel any pending pack-refine timer so it can't fire post-teardown
    // FIRST, because everything below destroys the thing it reads. Starting a collab
    // remounts this tool through a route that cannot carry an uploaded asset, a picked
    // file, a long paragraph or the slot - so when (and only when) that remount is the
    // reason we are being torn down, the live model crosses in memory instead. The
    // predicate is three comparisons and no allocation, which is the whole cost every
    // ordinary teardown pays for this.
    if (willRemountForCollab(toolId)) {
      const live: Record<string, unknown> = {};
      // `undefined` is skipped rather than carried: the carry is applied ON TOP of the
      // route, so a value the model does not hold would otherwise blank one the route
      // (or the resumed slot) did.
      for (const item of runtime.getModel())
        if (item.value !== undefined) live[item.id] = item.value;
      carryMountState(toolId, slot ?? null, live);
    }
    // Latch first: the template chooser is un-awaited and outlives nothing else here,
    // so this is the ONLY thing that stops it landing on a torn-down runtime. Closing
    // takes the modal itself down with the view (it was never inside viewEl's subtree -
    // it's appended to document.body - so nothing below would otherwise touch it) and
    // resolves its promise blank; the latch then short-circuits the pick handler even
    // if a fetch already in flight resolves with a real (now-irrelevant) selection.
    templatePickTornDown = true;
    templatePickClose?.();
    templatePickClose = null;
    runtime.stopLive?.(); // release the camera if a live session is running
    (host.media as unknown as { armAnimSource?: (m: string | null) => void }).armAnimSource?.(null); // drop any armed anim source
    stopFrameFps(); // stop the dev fps meter if it was running
    runtime.stopMeter?.();
    runtime.cancelRecording?.(); // release the mic / abort any take
    runtime.destroy?.(); // release per-mount executor resources (a Worker-isolated tool's run)
    (stageEl as (HTMLElement & { _recordCleanup?: () => void }) | null)?._recordCleanup?.(); // viewfinder + timers
    (stageEl as (HTMLElement & { _animCleanup?: () => void }) | null)?._animCleanup?.(); // animation transport bar + its rAF poll
    actionsApi?.stopAudioPreview?.(); // a detached <audio> keeps playing - stop it on navigation
    stopSlotPreview(); // and the sidebar slot's own sound preview (also a detached <audio>)
    actionsApi?.dispose?.(); // unsubscribe the cost-authoring registry listener + tear down its extension
    lottieModule?.destroyLottiePlayers(); // else animationManager ticks detached trees
    videoModule?.destroyVideoPlayers(); // drop remembered <video> positions
    vizModule?.destroyToolViz(); // else a WebGL2 context stays pinned per visited tool
    if (onFocusRect && stageEl) stageEl.removeEventListener('fc-focus-rect', onFocusRect);
    styleEl.remove();
    shutter.destroy();
    ro.disconnect();
    stageZoom?.destroy();
    exportTeardown?.();
    framingTeardown?.();
    framingTeardown = null; // framing overlay: listeners + its layer
    filmstrip?.destroy();
    window.removeEventListener('keydown', onHistoryKey);
    // Presence chrome first, transport last: the pill/rings/cursors come down, then
    // the session says goodbye and closes the channel (see the block's own note).
    // Null unless a collab was live, and idempotent when it was.
    collabTeardown?.();
    collabTeardown = null;
    collab?.detach(); // restore the un-wrapped setInput; drop any queued remote ops
    // The team-session id belongs to THIS mount and dies with it: the Share dialog can be
    // opened again from the Projects view over a LOCAL session of the same tool, and an
    // origin that outlived its mount would key a room on the wrong session. A remount
    // (the collab adoption path) re-earns it or does without - it is never resurrected.
    releaseTeamSessionOrigin();
    clearTimeout(historyToastTimer);
    historyToastEl?.remove();
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    // Everything renderInputs parked outside the sidebar's subtree - the document-
    // level capture dismissers + body-mounted flatpickr calendars - in one call, so
    // a detached sidebar tree isn't pinned alive across tool navigation.
    inputsEl?._inputsDispose?.();
    // The export popup (actionsEl) wires its own help tip for the C2PA card
    // (renderActions, not renderInputs - outside the disposer's remit).
    if (actionsEl?._helpTipDismiss)
      document.removeEventListener('click', actionsEl._helpTipDismiss, true);
    openGuide?.close();
    openGuide = null;
  };

  // Temporarily remove the CSS scale so dom-to-image sees native dimensions.
  // Also strips data-canvas-input attrs so they don't appear in exported files,
  // restoring them after so click-to-focus keeps working post-export.
  // Serialized behind exportChain: overlapping exports (e.g. a Download click while
  // the fire-and-forget history thumbnail captures) would otherwise both read
  // prevTransform and the later one restore a stale '', leaving the canvas unscaled.
  let exportChain: Promise<unknown> = Promise.resolve();
  type ExportReport = (done: number, total: number) => void;
  function exportUnscaled<T>(
    fn: (report?: ExportReport) => Promise<T>,
    opts: { shutter?: boolean; detail?: string; onCancel?: () => void } = {}
  ): Promise<T> {
    const run = exportChain.catch(() => {}).then(() => exportUnscaledRaw(fn, opts));
    exportChain = run.catch(() => {});
    return run;
  }
  async function exportUnscaledRaw<T>(
    fn: (report?: ExportReport) => Promise<T>,
    {
      shutter = false,
      detail,
      onCancel,
    }: { shutter?: boolean; detail?: string; onCancel?: () => void } = {}
  ): Promise<T> {
    // Drives the shutter's status block; inert when this export runs without one.
    const report: ExportReport = (done, total) => {
      if (shutter) reportShutterProgress(done, total);
    };
    // Renders are coalesced behind rAF (see the subscriber below); an export reads
    // the canvas DOM directly, so force any pending paint to land first - otherwise
    // we'd capture the frame before the latest keystroke.
    flushRender();
    // Embeds (lolly.tools/tool/… URLs) hydrate fire-and-forget on each render;
    // wait for the latest pass so export reads resolved blobs, not the placeholder.
    await embedsPending;
    // Same for lottie players - a first-paint/deep-link export must not capture
    // an unmounted [data-lottie-src] container.
    await lottiePending;
    // And for animated SVGs - a still/first export must inline the <svg> first, or
    // it captures an empty [data-anim-src] marker.
    await animSvgPending;
    // And for shaped glyphs (plans/175 WP-D) - an export mid-enhancement would shoot
    // a word half span-tier, half glyph-tier.
    await glyphPending;
    // And for video: snapshotMotion (export.js) needs a decoded frame or it skips
    // the <video> and exports blank - videoPending resolves once frames are ready.
    await videoPending;
    // And for the visualizer: an artist preset is fetched, so an export that didn't wait
    // would capture whichever brand-native preset was up while that was in flight.
    await vizPending;
    // Full-bleed tools (hideSidebar: export:false utilities and canvas-layout tools) have
    // no fixed-size artboard scaled-to-fit - canvasEl/outerEl are null - so there's no
    // transform to un-scale. Run the export directly (still behind the shutter). This is the
    // path the preview generator's __lollyCaptureThumb hook takes to vector-capture them.
    if (!canvasEl || !outerEl) {
      if (shutter) await closeShutter(detail, onCancel);
      try {
        return await fn(report);
      } finally {
        if (shutter) openShutter();
      }
    }
    const annotated = [...canvasEl.querySelectorAll<HTMLElement>('[data-canvas-input]')];
    const saved = annotated.map((el) => ({ el, id: el.dataset.canvasInput }));
    annotated.forEach((el) => el.removeAttribute('data-canvas-input'));

    // Close the shutter BEFORE the resize so the shake happens fully hidden.
    if (shutter) await closeShutter(detail, onCancel);

    const prevTransform = canvasEl!.style.transform;
    const prevZoom = canvasEl!.style.zoom; // paged docs fit-to-width via zoom
    const prevW = outerEl!.style.width;
    const prevH = outerEl!.style.height;
    canvasEl!.style.transform = '';
    canvasEl!.style.zoom = ''; // export reads pages at true page size
    outerEl!.style.width = canvasEl!.style.width;
    outerEl!.style.height = canvasEl!.style.height;
    try {
      return await fn(report);
    } finally {
      canvasEl!.style.transform = prevTransform;
      canvasEl!.style.zoom = prevZoom;
      outerEl!.style.width = prevW;
      outerEl!.style.height = prevH;
      saved.forEach(({ el, id }) => {
        if (el.isConnected && id != null) el.dataset.canvasInput = id;
      });
      if (shutter) openShutter();
    }
  }

  // ── Wire up ───────────────────────────────────────────────────────────────

  // A size-style select (its options carry width/height) sets the export size, so
  // the chosen badge/page size actually prints at that size. Seed the export-bar
  // defaults from the initially-selected option (URL / saved state still win).
  const sizeDriver = exportSizeDriver(tool.manifest);
  const sizeDims = sizeDriver
    ? sizeDriver.dims[String(runtime.getModel().find((i) => i.id === sizeDriver.id)?.value)]
    : null;
  // A mode-style select (its options carry `formats`) narrows the export format bar
  // to the selected option's formats - a vector effect offers svg/pdf/emf, a raster
  // one only png/jpg - while render.formats stays the union. Applied on mount and on
  // every change of the driving input, below (mirrors sizeDriver).
  const formatDriver = exportFormatDriver(tool.manifest);
  let lastFmtDriveVal: unknown;

  // L3 (plans/163) - the format and size of the last successful download of THIS tool,
  // if there was one. Read here, at the same point in the mount as the saved session, so
  // the panel is built once with the final values. It fills only what nothing else
  // supplied: everything explicit is already in the literal below, and mergeExportPrefs
  // never overwrites it (see lib/export-prefs.ts for the precedence rule).
  const rememberedExport = await loadExportPrefs(host, toolId).catch(() => null);

  const currentDesignOutcome = () =>
    designOutcome(designIntent, runtime.getModel().find((i) => i.id === 'boxes')?.value);
  const explicitExportFormat = urlFormat || (initialValues.__export_format as string | undefined);

  const exportDefaults: ExportDefaults = mergeExportPrefs(
    {
      filename: urlFilename || (initialValues.__export_filename as string | undefined),
      // A named Design outcome is stronger than a generic per-tool remembered format,
      // but never stronger than this link/session's explicit choice.
      format:
        explicitExportFormat ||
        (toolId === 'design' ? currentDesignOutcome().defaultFormat : undefined),
      width: urlWidth || Number(initialValues.__export_width) || sizeDims?.width || undefined,
      height: urlHeight || Number(initialValues.__export_height) || sizeDims?.height || undefined,
      unit:
        urlUnit || (initialValues.__export_unit as string | undefined) || sizeDims?.unit || 'px',
      dpi: urlDpi || Number(initialValues.__export_dpi) || 300,
      profile: urlProfile || (initialValues.__export_profile as string | undefined) || undefined,
      // Never restored from saved state. Browser automation supplies its one-time
      // value over a Playwright binding, so it does not enter URL/history/logs.
      password: urlPassword || automationPassword || undefined,
      // Print prep (pdf / pdf-cmyk / cmyk-tiff): bleed dimension string + a marks toggle map.
      // Present (from URL or saved state) ⇒ the Print marks card opens pre-filled.
      bleed: urlBleed || (initialValues.__export_bleed as string | undefined) || undefined,
      marks: (urlMarks ||
        marksFromCsv(
          initialValues.__export_marks as string | null | undefined
        )) as PrintMarks | null,
      // Full-page HTML export ("no stage"). URL-driven - like `password`, it isn't
      // persisted to the library at rest, only round-tripped through the URL.
      nostage: urlNostage || undefined,
      // Content Credentials from ?c2pa= ({ on, days } or undefined) - an explicit
      // link setting beats the tool's render.c2pa default in the popup.
      c2pa: urlC2pa || undefined,
      // Pixel watermark from ?imprint= - on by default (like c2pa). Preserve an
      // explicit `imprint=0`/`off` as false rather than collapsing it to
      // undefined (`false || undefined` would silently re-default it to on).
      imprint: urlImprint === false ? false : urlImprint === true ? true : undefined,
      // Generator-metadata strip from ?meta=off - on by default; preserve an explicit
      // opt-out as false (the vector writers drop their source field when false).
      metadata: urlMetadata === false ? false : undefined,
      // Durable credential from ?durable=1 - opt-in, OFF by default (performance: a
      // neural encode + a one-time model fetch), so it's simply true/undefined.
      durable: urlDurable || undefined,
      // HDR (Rec.2100 PQ) raster export from ?hdr=1 - opt-in, OFF by default; the
      // tuned form (`hdr=1600-60-0-50`) seeds the slider dials.
      hdr: urlHdr ? true : undefined,
      hdrTune: urlHdr ?? undefined,
      // Requested export bit depth from ?depth= - 'auto' (the default) carries
      // nothing, so only an explicit 8/16/float request travels.
      depth: urlDepth !== 'auto' ? urlDepth : undefined,
      // Video controls from the URL (fps/seconds/wait/codec/vq): seed the panel so a
      // manual export honours a pasted link the way `format=` does.
      video: hasVideoParams(urlVideo) ? urlVideo : undefined,
      // The deck state address from ?s= (plan 112). Read from the BOOT url, like every
      // other export default: presentation mode writes `s=` live while presenting and
      // clears it on exit, so the live query is the wrong thing to photograph. A still
      // export of a framed doc then renders just that slide (tool-actions' fan-out).
      slide: presentAddress || undefined,
    },
    rememberedExport,
    tool.manifest.render?.formats ?? []
  );
  // Rewrite the URL hash query string to reflect the current tool state so the
  // page is shareable and bookmarkable. Uses replaceState - no history entry.
  // Params the user has explicitly touched - only these are written to the URL.
  // Pre-seeded from any params already in the URL so shared/bookmarked links
  // are preserved across the first subscribe callback.
  let userHasMadeChanges = false;
  // A completed export/copy/save since the last edit. When true, the leave guards
  // stand down: the user finished - their latest state left as a file, a clipboard
  // copy or a library save - and "Unsaved changes" at that moment reads as the app
  // disbelieving them (audit 167 F-A2). Editing again re-arms the guard. The amber
  // Save cue deliberately stays: the SESSION may still be worth keeping, the guard
  // just stops blocking the door over it.
  let exportedSinceEdit = false;
  // The render pill's Save half goes amber (with a one-shot flash) the moment the
  // first un-saved edit lands, and reverts to its resting state on save. We flash
  // only on the clean→dirty edge so it's an attention cue, not a strobe; the
  // animation is restarted by removing+re-adding the class (a no-op re-add wouldn't
  // replay it), so it fires again after each subsequent save→edit cycle.
  function markSessionDirty(): void {
    exportedSinceEdit = false; // a fresh edit re-arms the leave guard
    if (userHasMadeChanges) return; // already dirty - keep the resting amber
    userHasMadeChanges = true;
    if (renderSaveBtn) {
      renderSaveBtn.classList.remove('is-unsaved');
      void renderSaveBtn.offsetWidth; // force reflow so the flash animation restarts
      renderSaveBtn.classList.add('is-unsaved');
    }
  }
  function markSessionSaved(): void {
    userHasMadeChanges = false;
    renderSaveBtn?.classList.remove('is-unsaved');
  }
  // Seed from the params this mount was routed with (form-agnostic - works whether the
  // bar arrived as /t/<id>?… or #/tool/<id>?…) so shared/bookmarked links survive the
  // first subscribe callback.
  const dirtyParams = new Set(new URLSearchParams(urlParams || '').keys());
  // Monotonic guard shared by every address-bar writer (syncUrl AND shrinkUrl). It's
  // bumped on EVERY bar write, so any later write invalidates an in-flight async pack
  // - a stale pack from an earlier (larger) state can never clobber a newer bar. A
  // holder object (not a bare `let`) so the module-level shrinkUrl can share it.
  const barSeq: BarSeq = { v: 0 };

  function syncUrl(dirtyId?: string): void {
    if (dirtyId) dirtyParams.add(dirtyId);

    // Ambient URL-budget gauge: the SHARE-link cost of the current edit (reads the cost
    // model, NOT this address bar - different serializations), so it updates even before
    // the first edit of an encrypted link. Pure + synchronous; the packed refine is
    // deferred inside the gauge and never blocks this tick.
    if (urlGauge) {
      const gaugeBase = `${location.origin}${TOOL_URL_BASE}?`;
      urlGauge.update(
        costUrlState(
          { model: runtime.getModel(), exportParts: collectExportParams(actionsEl) },
          { base: gaugeBase, target: BROWSER_TARGET }
        ),
        gaugeBase
      );
    }

    // A password-protected (`zx`) link stays ENCRYPTED in the address bar until the
    // user actually changes something - otherwise this first auto-sync would rewrite
    // the bar to the cleartext state, so copying it would re-share an UNPROTECTED link
    // and a refresh would skip the password prompt. After the first edit the new state
    // can't be the original token, so we fall through to the normal (cleartext) write.
    if (encLinkQuery && !userHasMadeChanges) {
      history.replaceState(null, '', `${TOOL_URL_BASE}?${encLinkQuery}`);
      return;
    }

    const params = new URLSearchParams();

    for (const entry of runtime.getModel()) {
      const { id, type, value } = entry;
      if (!dirtyParams.has(id)) continue;
      // The address bar writes each input under its short urlKey alias when it declares one
      // (e.g. design `boxes`→`bx`), same as the share link (encodeModelParam) - so a
      // copy-pasted bar is as small as a copied Share link. Dirty tracking stays keyed by the
      // canonical id; only the written param NAME shortens. parseUrlState reads both forms.
      const key = entry.urlKey ?? id;
      // A picked file is binary, in-memory, device-local content - it has no
      // shareable URL form. Never write it (would otherwise serialise to junk).
      if (type === 'file') continue;
      if (type === 'asset') {
        // Library assets are shareable by ID; user uploads are device-local. A
        // baked ref's frozen bytes can't ride in the bar either: write its
        // provenance (assetIdForUrl → bakedFrom) so a refresh degrades to a live
        // re-render - but one WITHOUT provenance is skipped like a user upload
        // (its dead 'baked/…' id could never re-resolve; a saved session is what
        // restores the exact bytes).
        const ref = value as AssetRef | null;
        if (ref && isBakedRef(ref) && typeof ref.meta?.bakedFrom !== 'string') continue;
        const assetId = ref ? assetIdForUrl(ref) : undefined;
        if (assetId && !assetId.startsWith('user/')) params.set(key, assetId);
        continue;
      }
      if (type === 'blocks') {
        if (Array.isArray(value) && value.length > 0) {
          // Compact form first (the share dialog's encoder, in its address-bar variant that
          // keeps device-local user/ ids) - a 20-layer import is ~10× smaller than the JSON
          // form, and it now carries separator-bearing values too (URLSearchParams.set applies
          // the outer url-encode layer that keeps in-value %2C/%7E escapes intact - see
          // blocks-url.ts), so JSON is the fallback only for field-less blocks; blocksForUrl
          // collapses baked sub-field refs to their provenance URL first (the data: bytes would
          // blow the bar). The JSON form copies every key, so the hidden row id comes off first -
          // it is this device's bookkeeping, not a value. No length guard: a blocks value IS the
          // content (a design's boxes), so - like a table - it rides the bar and the auto-pack
          // tail below compresses it, rather than being silently dropped from a shared link.
          const compact = encodeBlocksCompact(value, entry.fields ?? [], { keepUserIds: true });
          const encoded = compact ?? JSON.stringify(blocksForUrl(stripHiddenRowIds(value)));
          params.set(key, encoded);
        }
        continue;
      }
      if (type === 'vector') {
        // One flat param per field: "<inputId>.<fieldId>" (e.g. transform.zoom=200).
        if (value && typeof value === 'object') {
          const vv = asRow(value);
          for (const f of entry.fields ?? []) {
            if (vv[f.id] !== undefined && vv[f.id] !== null)
              params.set(`${key}.${f.id}`, String(vv[f.id]));
          }
        }
        continue;
      }
      if (type === 'table') {
        // A table IS the tool's content - it belongs in the URL, not as the
        // "[object Object]" the scalar path below would stamp. It round-trips
        // through the engine's compact form (encode here / decodeTableCompact on
        // load), and rides under the input's short urlKey (e.g. battlecards `t`),
        // which parseUrlState reads alongside the id. Deliberately bypasses the
        // 150-char scalar cap below: a table is meant to FILL the link, and once
        // the query passes AUTO_PACK_MIN the auto-pack tail of this function
        // compresses the bar to the `z=` form. An empty grid writes nothing, so a
        // blank tool keeps a bare URL. URLSearchParams applies its own encode layer.
        const tbl = normalizeTableValue(value);
        if (tbl && (tbl.columns.length || tbl.rows.length))
          params.set(key, encodeTableCompact(tbl));
        continue;
      }
      if (value == null || value === '') continue;
      if (typeof value === 'boolean' && !value) continue;
      // A token-backed colour ({ ref, value }) serialises to its canonical token ref
      // (mirrors the engine's coerceToString) - never String()'d into the URL as
      // "[object Object]", which would then ride into a lolly-URL embed of this tool.
      const str = type === 'color' && isTokenValue(value) ? value.ref : String(value);
      // A `longtext` is CONTENT (d3 data, design customCss, code) and rides uncapped like a
      // table - it must NOT be dropped from the bar, or a shared chart link would open blank. The
      // 150-char cap stays only for short single-line scalars (a stray-long label is bloat).
      if (type !== 'longtext' && str.length > 150) continue;
      params.set(key, str);
    }

    if (dirtyParams.has('w')) {
      // As typed, not truncated: `8.5in` must survive a share link (plans/184 R12).
      const w = parseFloat(
        actionsEl?.querySelector<HTMLInputElement>('[data-action="export-width"]')?.value ?? ''
      );
      if (w > 0) params.set('w', String(w));
    }
    if (dirtyParams.has('h')) {
      const h = parseFloat(
        actionsEl?.querySelector<HTMLInputElement>('[data-action="export-height"]')?.value ?? ''
      );
      if (h > 0) params.set('h', String(h));
    }
    if (dirtyParams.has('unit')) {
      const u = actionsEl?.querySelector<HTMLSelectElement>('[data-action="export-unit"]')?.value;
      if (u && u !== 'px') params.set('unit', u);
    }
    if (dirtyParams.has('dpi')) {
      const d = parseInt(
        actionsEl?.querySelector<HTMLInputElement>('[data-action="export-dpi"]')?.value ?? '',
        10
      );
      const u = actionsEl?.querySelector<HTMLSelectElement>('[data-action="export-unit"]')?.value;
      if (d > 0 && u && u !== 'px') params.set('dpi', String(d));
    }
    if (dirtyParams.has('format')) {
      const fmt = actionsEl?.querySelector<HTMLSelectElement>('[data-action="format"]')?.value;
      if (fmt) params.set('format', fmt);
    }
    if (dirtyParams.has('filename')) {
      const filename = actionsEl
        ?.querySelector<HTMLInputElement>('[data-action="filename"]')
        ?.value?.trim();
      if (filename) params.set('filename', filename);
    }
    if (dirtyParams.has('profile')) {
      // Meaningful for the CMYK print formats (Print PDF / Print TIFF); share it only
      // when one is selected and it isn't the default condition (keeps links clean).
      const fmt = actionsEl?.querySelector<HTMLSelectElement>('[data-action="format"]')?.value;
      // `own:<digest>` is device-local - urlProfileValue flattens it to bare `own`.
      const prof = urlProfileValue(
        actionsEl?.querySelector<HTMLSelectElement>('[data-action="cmyk-profile"]')?.value
      );
      if (isCmykFmt(fmt) && prof && prof !== DEFAULT_CMYK_CONDITION) params.set('profile', prof);
    }
    if (dirtyParams.has('password')) {
      // Open-password for the standard-tier lock only (PDF 40-bit RC4 or the ZIP
      // ZipCrypto bundle); carried clear-text by design (a basic lock for short-lived
      // transactional material). Empty value → omitted.
      const fmt = actionsEl?.querySelector<HTMLSelectElement>('[data-action="format"]')?.value;
      const pw = actionsEl?.querySelector<HTMLInputElement>('[data-action="pdf-password"]')?.value;
      const strong =
        actionsEl?.querySelector<HTMLSelectElement>('[data-action="pdf-lock-tier"]')?.value ===
        'strong';
      // Only the standard lock rides in the URL. The strong (AES-256) tier is never
      // serialized - its password is typed at export/open only.
      if ((fmt === 'pdf' || fmt === 'zip') && pw && !strong) params.set('password', pw);
    }
    if (dirtyParams.has('bleed') || dirtyParams.has('marks')) {
      // Print marks & bleed - print formats (pdf / pdf-cmyk / cmyk-tiff) only, and
      // only when the card is on.
      const fmt = actionsEl?.querySelector<HTMLSelectElement>('[data-action="format"]')?.value;
      const on = actionsEl?.querySelector<HTMLInputElement>(
        '[data-action="print-enable"]'
      )?.checked;
      if (isPrintFmt(fmt) && on) {
        const mm = parseFloat(
          actionsEl?.querySelector<HTMLInputElement>('[data-action="print-bleed"]')?.value ?? ''
        );
        if (mm > 0) params.set('bleed', `${mm}mm`);
        const csv = marksToCsv({
          crop: actionsEl?.querySelector<HTMLInputElement>('[data-action="mark-crop"]')?.checked,
          registration: actionsEl?.querySelector<HTMLInputElement>('[data-action="mark-reg"]')
            ?.checked,
          bleed: actionsEl?.querySelector<HTMLInputElement>('[data-action="mark-bleed"]')?.checked,
          colorBars: actionsEl?.querySelector<HTMLInputElement>('[data-action="mark-bars"]')
            ?.checked,
          provenance: actionsEl?.querySelector<HTMLInputElement>('[data-action="mark-prov"]')
            ?.checked,
        });
        if (csv) params.set('marks', csv);
      }
    }
    if (dirtyParams.has('nostage')) {
      // Full-page HTML export - a presence flag, written only while HTML is the
      // selected format and the toggle is on (so it drops off other formats).
      const fmt = actionsEl?.querySelector<HTMLSelectElement>('[data-action="format"]')?.value;
      const on = actionsEl?.querySelector<HTMLInputElement>('[data-action="full-page"]')?.checked;
      if (fmt === 'html' && on) params.set('nostage', '');
    }
    if (dirtyParams.has('imprint')) {
      // Pixel watermark - on by default like c2pa (see url-mode serializeUrlState):
      // unchecking the popup toggle writes the explicit `imprint=0` opt-out;
      // checking it back on returns to the default, so the param drops out.
      const on = actionsEl?.querySelector<HTMLInputElement>('[data-action="imprint"]')?.checked;
      if (on) params.delete('imprint');
      else params.set('imprint', '0');
    }
    if (dirtyParams.has('durable')) {
      // Durable credential - OFF by default (opt-in, performance cost): checking
      // writes durable=1; unchecking drops the param so a plain link stays clean.
      const on = actionsEl?.querySelector<HTMLInputElement>('[data-action="durable"]')?.checked;
      if (on) params.set('durable', '1');
      else params.delete('durable');
    }
    if (dirtyParams.has('hdr')) {
      // HDR - OFF by default (opt-in): checking writes hdr=1 (or the compact tuned
      // form when a slider is off-default); unchecking drops it. serializeHdr emits
      // `1` when all dials are default so a plain link stays clean.
      const on = actionsEl?.querySelector<HTMLInputElement>('[data-action="hdr"]')?.checked;
      if (on) {
        const dial = (a: string, d: number) => {
          const v = Number(
            actionsEl?.querySelector<HTMLInputElement>(`[data-action="${a}"]`)?.value
          );
          return Number.isFinite(v) ? v : d;
        };
        params.set(
          'hdr',
          serializeHdr({
            peakNits: dial('hdr-peak', HDR_DEFAULTS.peakNits),
            reach: dial('hdr-reach', HDR_DEFAULTS.reach),
            lift: dial('hdr-lift', HDR_DEFAULTS.lift),
            richness: dial('hdr-focus', HDR_DEFAULTS.richness),
          })
        );
      } else params.delete('hdr');
    }

    const qs = params.toString();
    // Bump the shared guard on EVERY write (not just when we pack) so a later,
    // possibly sub-threshold, syncUrl invalidates any pack still in flight from an
    // earlier large state - otherwise that stale pack could resolve afterward and
    // overwrite this bar with the old state.
    const seq = ++barSeq.v;
    history.replaceState(null, '', qs ? `${TOOL_URL_BASE}?${qs}` : TOOL_URL_BASE);

    // Auto-switch to the packed form once the readable query gets long enough to
    // risk the ~2000-char URL ceiling. The readable write above already landed, so
    // simple links stay readable/editable and only large states get compressed -
    // and only if packing is available AND genuinely shorter. Async + seq-guarded so
    // a slow pack from an older keystroke can never clobber a newer bar.
    if (qs.length >= AUTO_PACK_MIN && isPackAvailable()) {
      packQuery(qs)
        .then((token) => {
          if (token == null || seq !== barSeq.v) return; // unavailable, or superseded
          const packed = `${PACK_PARAM}=${token}`;
          if (packed.length >= qs.length) return; // packing didn't help - keep readable
          history.replaceState(null, '', `${TOOL_URL_BASE}?${packed}`);
        })
        .catch(() => {
          /* keep the readable URL already written */
        });
    }
  }

  function markUserDirty(id?: string): void {
    markSessionDirty(); // sets userHasMadeChanges + flashes the Save pill on the first edit
    // Just record the param as dirty - the coalesced render's syncUrl() (folded
    // into the rAF below) writes the URL for every dirty param, so calling it here
    // too would replaceState twice per keystroke for no benefit.
    if (id) dirtyParams.add(id);
  }

  const actionsApi = renderActions(
    actionsEl,
    tool.manifest,
    runtime,
    exportSourceNode,
    host,
    resetView,
    exportUnscaled,
    exportDefaults,
    syncUrl,
    playShutter,
    fileIntoFolder,
    returnTo,
    slot,
    reachedViaLink,
    toolId === 'design'
      ? {
          current: () => currentDesignOutcome(),
          sessionMeta: () => ({ __workspace_intent: designIntent }),
        }
      : {}
  );
  if (toolId === 'design') {
    refreshDesignExperience = (pickDefault = false): void => {
      const outcome = currentDesignOutcome();
      viewEl.dataset.designIntent = designIntent;
      actionsApi?.setExperience?.(outcome);
      // Choosing a new outcome is an explicit request for its natural deliverable.
      // A URL/session format remains authoritative on initial mount; a later template
      // or intent switch may deliberately move the picker.
      if (pickDefault && outcome.defaultFormat) actionsApi?.setFormat?.(outcome.defaultFormat);
      if (pickDefault) applyDesignIntentLayout(outcome);
      syncDesignIntentChrome();
    };
    const offOutcome = runtime.subscribe(() => refreshDesignExperience(false));
    if (typeof offOutcome === 'function')
      mountLifecycle.add('Design outcome subscription', offOutcome);
  }
  // renderActions announces every completed download/copy/save - see
  // exportedSinceEdit above for why that quiets the unsaved-changes guards.
  actionsEl?.addEventListener('lolly:export-complete', () => {
    exportedSinceEdit = true;
  });

  // "Bulk from rows" - hand this template to /batch, where a sheet of rows renders the
  // whole set in one run. Deliberately NOT an export option (like Make variants, it is a
  // step BEFORE export). The batch starts from rows, so the current design does not
  // travel with it, which is why an edited-but-unsaved session gets the same offer to
  // save that the back pill makes before it leaves. Two homes, one action: this header
  // button for the sidebar layouts, the Lolly menu item for the chromeless editors.
  const openBulk = (): void => {
    const go = (): void => navigateTo(`#/batch?tool=${encodeURIComponent(toolId)}`);
    if (!hasInputs || !userHasMadeChanges || exportedSinceEdit) {
      go();
      return;
    }
    const canSave = !!actionsEl?.querySelector('[data-action="save"]') && !!actionsApi?.save;
    showUnsavedDialog(
      canSave
        ? async () => {
            if (await actionsApi!.save!()) go();
          }
        : null,
      go
    );
  };
  viewEl.querySelector<HTMLButtonElement>('#bulk-rows-btn')?.addEventListener('click', openBulk);

  // "Bulk from files" (plans/147 M2): pick N files and run this transform tool over
  // each through its exportFile hook on the LIVE runtime, delivering one zip. It is
  // foreground by design (it drives the mounted runtime), so progress rides the icon
  // button - a background/navigate-away job would need a fresh runtime per file.
  if (bulkFilesId) {
    const fileSpec = tool.manifest.inputs.find((i) => i.id === bulkFilesId) as
      | { accept?: string[] }
      | undefined;
    const picker = document.createElement('input');
    picker.type = 'file';
    picker.multiple = true;
    if (fileSpec?.accept?.length) picker.accept = fileSpec.accept.join(',');
    picker.style.display = 'none';
    viewEl.appendChild(picker);
    const bulkBtn = viewEl.querySelector<HTMLButtonElement>('#bulk-files-btn');
    const idleTip = bulkBtn?.getAttribute('data-tip') ?? '';
    const tip = (s: string): void => {
      if (bulkBtn) bulkBtn.dataset.tip = s;
    };
    bulkBtn?.addEventListener('click', () => {
      picker.value = '';
      picker.click();
    });
    picker.addEventListener('change', async () => {
      const picked = Array.from(picker.files ?? []);
      if (!picked.length || !bulkBtn || bulkBtn.dataset.busy) return;
      bulkBtn.dataset.busy = '1';
      bulkBtn.disabled = true;
      // The loop drives the live input; snapshot what the user had so the view
      // returns to it rather than sitting on the last file of the batch.
      const prevFile = runtime.getModel().find((i) => i.id === bulkFilesId)?.value ?? null;
      try {
        const { entries, failed } = await collectBulkFiles(
          picked.map((f) => ({ name: f.name })),
          async (i) => {
            await runtime.setInput(bulkFilesId, await fileToRef(picked[i]!));
            const res = await runtime.exportFile();
            return Array.isArray(res) ? res : [res];
          },
          (done, total) => tip(`${t('Converting')} ${done}/${total}…`)
        );
        if (!entries.length)
          throw new Error(t('Every file failed to convert - try different files.'));
        const { storeZip } = await import('@lolly/engine');
        const zip = storeZip(entries);
        await host.export.file(new Blob([zip as BlobPart], { type: 'application/zip' }), {
          filename: `${toolId}-bulk.zip`,
        });
        tip(failed.length ? `${failed.length} ${t('skipped')}` : idleTip);
      } catch (err) {
        console.error('bulk-from-files failed:', err);
        bulkBtn.classList.add('is-error');
        tip((err as { message?: string })?.message || t('Bulk convert failed - try again'));
      } finally {
        await runtime.setInput(bulkFilesId, prevFile).catch(() => {});
        bulkBtn.disabled = false;
        delete bulkBtn.dataset.busy;
        window.setTimeout(() => {
          bulkBtn.classList.remove('is-error');
          tip(idleTip);
        }, 4000);
      }
    });
  }

  // Now that actionsApi exists, wire the gauge - a click (not a drag) opens the Share
  // dialog with the current state (same path as the Share button). syncUrl already drives
  // its live value via the holder above.
  if (urlGaugeEl) {
    urlGauge = createUrlGauge(
      urlGaugeEl,
      {
        used: (pct) => `${t('URL budget')}: ${pct}%`,
        // Shown from the meter the first time a link fills the bar - reassurance, not a warning.
        reassure: t(
          "It's okay - keep going. You can always share the whole thing as a .lolly file."
        ),
      },
      prefersReducedMotion,
      () =>
        showShareDialog(
          runtime,
          actionsEl,
          tool.manifest,
          makeLollyVehicle(host, toolId, tool.manifest, actionsApi?.sessionState, contentEl)
        )
    );
    // Render once now so the bar shows on mount - not only after the first syncUrl (a
    // free-canvas tool may not write the URL on load, which would leave it hidden).
    const gaugeBase = `${location.origin}${TOOL_URL_BASE}?`;
    urlGauge.update(
      costUrlState(
        { model: runtime.getModel(), exportParts: collectExportParams(actionsEl) },
        { base: gaugeBase, target: BROWSER_TARGET }
      ),
      gaugeBase
    );
  }

  // Preview-generation hook - scripts/build-previews.ts calls this to grab a VECTOR
  // SCREENSHOT (SVG) of the mounted canvas for ANY tool, even an export:false utility
  // (colour browser, countdown timer) that has no Save button and would otherwise fall
  // back to a raster page screenshot. It's the app's own captureThumbnail - text outlined
  // to paths, blob-URLs inlined - so the SVG is self-contained and crisp at any tile size.
  // A benign single function ref no in-app UI calls; re-bound to the live canvas each mount.
  // Uses contentEl (the universal canvas node) rather than canvasEl - the latter is null for
  // hideSidebar/full-bleed tools (export:false utilities, editor layouts), which are exactly
  // the ones without a Save button that this hook exists to cover.
  (
    globalThis as { __lollyCaptureThumb?: (fmt?: string) => Promise<string | null> }
  ).__lollyCaptureThumb = (fmt = 'svg') =>
    captureThumbnail(tool.manifest, contentEl, runtime, exportUnscaled, fmt);

  // Canvas → input setter for THIS mounted tool. A template/canvas script can drive
  // any declared input by id - including custom controls (sliders, colour fields)
  // that the "set .value + dispatch input" pattern can't reach, since it rides the
  // real runtime.setInput (URL sync, undo, dirty, session-save all included). Used
  // by url-shot's visual composer to apply its crop/scroll/css back to the tool.
  // Re-bound to the live runtime each mount; last-mounted wins (a single tool at a
  // time on the tool route - /multi drives inputs its own way).
  (globalThis as { __lollySetInput?: (id: string, value: InputValue) => void }).__lollySetInput = (
    id,
    value
  ) => {
    try {
      runtime.setInput(id, value);
      markUserDirty(id);
    } catch {
      /* unknown id - ignore */
    }
  };

  // Deep-link an overlay open on load, so a share link OR a screenshot recipe can
  // reproduce a state that otherwise lives only in a click. `?share` opens the Share
  // dialog. This is the pattern for making the app's click-only surfaces addressable
  // (see plans/43-deep-linking.md) - each new one reads its flag here or in its view.
  if (urlFlags.has('share')) {
    requestAnimationFrame(() => showShareDialog(runtime, actionsEl, tool.manifest));
  }

  // Motion preview-generation hook - scripts/build-animated-previews.ts calls this to
  // export the LIVE animating canvas as a short, small looping clip (apng/gif) for an
  // animated tool's gallery tile / example look. Like __lollyCaptureThumb it reuses the
  // app's OWN export path (runtime.export → the shell's renderApng/renderGif), so a
  // generated APNG is byte-faithful to a real user export - no second capture path to drift.
  // Returns a base64 data-URL, or null on failure. Build-tool only; no in-app UI calls it.
  type MotionCaptureOpts = {
    width?: number;
    height?: number;
    duration?: number;
    wait?: number;
    repeat?: number;
    fps?: number;
  };
  (
    globalThis as {
      __lollyCaptureMotion?: (fmt?: string, opts?: MotionCaptureOpts) => Promise<string | null>;
    }
  ).__lollyCaptureMotion = async (fmt = 'apng', opts = {}) => {
    try {
      const nw = opts.width ?? tool.manifest.render.width ?? 600;
      const nh = opts.height ?? tool.manifest.render.height ?? 600;
      // wait/duration/fps/repeat are the de-facto motion-timing opts the engine passes
      // through untouched (not in RuntimeExportOpts, like render-export.ts's exportOpts) -
      // build a typed local so the excess-property check doesn't trip at the call site.
      const exportOpts: {
        width: number;
        height: number;
        embedMeta: boolean;
        watermark: boolean;
        thumbnail: boolean;
        duration?: number;
        wait?: number;
        repeat?: number;
        fps?: number;
      } = { width: nw, height: nh, embedMeta: false, watermark: false, thumbnail: true };
      if (opts.duration !== undefined) exportOpts.duration = opts.duration;
      if (opts.wait !== undefined) exportOpts.wait = opts.wait;
      if (opts.repeat !== undefined) exportOpts.repeat = opts.repeat;
      if (opts.fps !== undefined) exportOpts.fps = opts.fps;
      const blob = await exportUnscaled(() => runtime.export(contentEl, fmt, exportOpts), {
        shutter: false,
      });
      return await new Promise<string | null>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  // Copy-URL now lives in the actions bar (renderActions), alongside the export
  // buttons - its format/filename/dimension inputs are in the same element. The Share
  // dialog also offers a `.lolly` download (plans/114) when the tool has a session.
  if (actionsEl) {
    const lolly = makeLollyVehicle(
      host,
      toolId,
      tool.manifest,
      actionsApi?.sessionState,
      contentEl
    );
    wireUpCopyUrl(actionsEl, runtime, actionsEl, tool.manifest, lolly);
  }

  // The render pill's Save half: an in-place quick-save. It reuses the exact same
  // export-aware save routine as the popup's Save button (performSave), but unlike
  // that button it does NOT navigate away - it's a checkpoint affordance. performSave
  // leaves the button disabled with a "Saved" label for its own navigate-away caller,
  // so we restore it here and clear the unsaved cue, briefly holding "Saved" as
  // confirmation before reverting to "Save".
  if (renderSaveBtn && actionsApi?.save) {
    const saveLabel = renderSaveBtn.querySelector<HTMLElement>('[data-save-label]');
    // The button's "Saved" confirmation + amber-cue clear, factored out so the Save dialog's
    // save-to-library path lights the button up exactly like the old in-place quick-save did.
    const flashSaved = (): void => {
      delete renderSaveBtn!.dataset.saving;
      renderSaveBtn!.disabled = false;
      markSessionSaved(); // drop the amber unsaved cue
      renderSaveBtn!.classList.add('is-just-saved');
      setTimeout(() => {
        if (saveLabel) saveLabel.textContent = t('Save');
        renderSaveBtn!.classList.remove('is-just-saved');
      }, 1500);
    };
    // Save now opens a dialog (plan 114 / user-templates): file into a PROJECT, or save the
    // doc as a reusable TEMPLATE / VARIATION for this tool. Everything the dialog does is
    // injected here, where host / runtime / stores / the Share vehicle are all in scope.
    renderSaveBtn.addEventListener('click', async () => {
      if (renderSaveBtn!.dataset.saving) return; // mid-save
      if (document.querySelector('dialog.save-dialog')) return; // already open
      const [
        { openSaveDialog },
        { createFolderStore },
        { createUserTemplateStore },
        { createUserToolStore },
        { parseTemplates },
      ] = await Promise.all([
        import('../lib/save-dialog.ts'),
        import('../folders.ts'),
        import('../lib/user-templates.ts'),
        import('../lib/user-tools.ts'),
        import('./template-chooser.ts'),
      ]);
      const folderStore = createFolderStore(
        host as unknown as Parameters<typeof createFolderStore>[0]
      );
      const tplStore = createUserTemplateStore(
        host as unknown as Parameters<typeof createUserTemplateStore>[0]
      );
      const userToolStore = createUserToolStore(
        host as unknown as Parameters<typeof createUserToolStore>[0]
      );
      // "Create a tool" turns a saved Design doc into the user's own listed tool - shown only
      // for a tool that can BE a user tool's base (Design today). See lib/user-tools.ts.
      const canCreateTool = toolId === 'design';
      // Variation bases: this tool's built-in templates + the user's own saved ones.
      const bases: { id: string; name: string }[] = [];
      try {
        for (const tv of parseTemplates(templateMeta)) bases.push({ id: tv.id, name: tv.name });
        for (const ut of await tplStore.list(toolId)) bases.push({ id: ut.id, name: ut.name });
      } catch {
        /* bases are best-effort - the variation card just offers fewer options */
      }
      const plainValues = (): Record<string, unknown> =>
        Object.fromEntries(runtime.getModel().map((i) => [i.id, i.value]));
      // The project this session is already filed in, so the dialog's picker can
      // tell the truth on a re-save (plans/142 W1). Best-effort: an unfiled or
      // never-saved session resolves null and the picker falls back to the
      // last-picked project. (No async-IIFE shape here - the template-chooser
      // guard bans `await (async` across this file.)
      let currentFolderId: string | null = null;
      try {
        const slot = actionsApi?.getSlot?.();
        if (slot) currentFolderId = folderStore.folderOfRef(await folderStore.list(), slot);
      } catch {
        currentFolderId = null;
      }
      openSaveDialog({
        toolName: tool.manifest.name,
        hasTemplates,
        bases,
        currentFolderId,
        listFolders: () =>
          folderStore.list().then((fs) => fs.map((f) => ({ id: f.id, name: f.name }))),
        createFolder: (name) => folderStore.create(name).then((f) => ({ id: f.id, name: f.name })),
        saveToLibrary: async (folderId) => {
          const ok = await actionsApi!.save!(renderSaveBtn, { folderId });
          if (ok) flashSaved();
          return ok;
        },
        saveTemplate: async (name, variationOf) => {
          await tplStore.save({ toolId, name, values: plainValues(), variationOf });
        },
        canCreateTool,
        toolFormats: tool.manifest.render?.formats,
        createTool: async ({ title, description, icon, formats }) => {
          await userToolStore.save({
            title,
            description,
            icon,
            formats,
            baseToolId: toolId,
            values: plainValues(),
          });
        },
        shareLolly: () => {
          const lolly = makeLollyVehicle(
            host,
            toolId,
            tool.manifest,
            actionsApi?.sessionState,
            contentEl
          );
          showShareDialog(runtime, actionsEl, tool.manifest, lolly);
        },
        announce: (m) => announce(m),
        t,
      });
    });
  }

  // Darkroom's "Grade a video…" (plans/130): the tool authors the look and publishes
  // it as the `videoLook` hook extra (a baked .cube, key-guarded); the shell owns the
  // video pipeline. This button joins them - pick a video, hand the baked look plus
  // the tool's own texture params to the background grade job. The toast owns
  // progress; darkroom itself never decodes video.
  const gradeVideoBtn = viewEl.querySelector<HTMLButtonElement>('#grade-video-btn');
  if (gradeVideoBtn) {
    gradeVideoBtn.addEventListener('click', async () => {
      if (gradeVideoBtn.dataset.busy) return;
      gradeVideoBtn.dataset.busy = '1';
      try {
        const picked = await host.assets.pick({ type: 'video', title: t('Grade a video') });
        if (!picked) return;
        let cube = '';
        try {
          const look = JSON.parse(runtime.getHydratedText('{{videoLook}}')) as {
            v?: number;
            on?: number;
            cube?: string;
          };
          // The envelope's `on` flag is the tool's own colour-identity test: an
          // untouched darkroom publishes an identity cube, and grading a clip
          // through it would re-encode for nothing AND stamp a colour-grade
          // credential the pixels don't earn. Only an active look counts.
          if (look?.v === 1 && look.on === 1 && typeof look.cube === 'string') cube = look.cube;
        } catch {
          /* no look authored yet - texture params may still make a grade */
        }
        const num = (id: string, dflt: number): number => {
          const v = Number(runtime.getModel().find((i) => i.id === id)?.value);
          return Number.isFinite(v) ? v : dflt;
        };
        const grain = Math.min(1, Math.max(0, num('grain', 0) / 100));
        const vignette = Math.min(1, Math.max(0, num('vignette', 0) / 100));
        if (!cube && grain === 0 && vignette === 0) {
          announce(t('Adjust the look first - this would output the video unchanged.'));
          return;
        }
        const { runVideoJobAsJob, videoJobRefusal } = await import('../lib/video-jobs.ts');
        // A metadata-only probe so the caps refuse BEFORE a doomed decode starts -
        // the same check the catalog's inline mode shows next to Apply.
        const meta = await new Promise<{ w: number; h: number; durationSec: number } | null>(
          (resolve) => {
            const v = document.createElement('video');
            v.preload = 'metadata';
            v.muted = true;
            v.onloadedmetadata = () =>
              resolve({
                w: v.videoWidth,
                h: v.videoHeight,
                durationSec: Number.isFinite(v.duration) ? v.duration : 0,
              });
            v.onerror = () => resolve(null);
            v.src = picked.url;
          }
        );
        if (!meta) {
          announce(t("Couldn't read this video."));
          return;
        }
        const refusal = videoJobRefusal('grade', {
          longEdge: Math.max(meta.w, meta.h),
          durationSec: meta.durationSec,
          bytes: Number(picked.meta?.bytes ?? 0),
        });
        if (refusal) {
          announce(refusal);
          return;
        }
        const sourceName = String(picked.meta?.name ?? picked.id);
        runVideoJobAsJob(
          host as unknown as import('../lib/video-jobs.ts').VideoJobHost,
          {
            op: 'grade',
            source: picked,
            sourceName,
            grade: {
              cubeText: cube,
              lutLabel: t('Darkroom look'),
              lutIntensity: 1, // the baked cube already carries the LUT at its authored strength
              grain,
              grainSize: Math.min(4, Math.max(1, num('grainSize', 1.6))),
              vignette,
              seed: Math.round(num('seed', 7)),
              fps: 0, // source fps - a colour edit must not re-time the clip
              bitrate: 8_000_000,
            },
            ...(picked.meta?.aiGenerated === 'full' || picked.meta?.aiGenerated === 'partial'
              ? { aiGeneratedSource: picked.meta.aiGenerated as 'full' | 'partial' }
              : {}),
          },
          {
            onComplete: () => announce(t('Graded video saved to your uploads.')),
            onError: (err) =>
              host.log('error', 'Video grade failed', { id: picked.id, error: String(err) }),
          }
        );
        announce(t('Grading in the background - watch the progress toast.'));
      } finally {
        delete gradeVideoBtn.dataset.busy;
      }
    });
  }

  // Transcribe (engine 1.150, render.transcribe). The whole affordance from one
  // declaration: listen to the named audio/video input, write cues into the named
  // text input. The heavy part is a background job (lib/stt-job.ts) whose toast
  // owns progress and cancel, exactly like the timeline panel's Generate
  // subtitles - the same consent sheet, the same stash/persist rungs, so a clip
  // transcribed once is never paid for twice.
  const transcribeBtn = viewEl.querySelector<HTMLButtonElement>('#transcribe-btn');
  if (transcribeSpec && transcribeBtn) {
    const { setupTranscribeControl } = await import('./transcribe-control.ts');
    setupTranscribeControl({
      btn: transcribeBtn,
      runtime: runtime as unknown as Parameters<typeof setupTranscribeControl>[0]['runtime'],
      host: host as unknown as Parameters<typeof setupTranscribeControl>[0]['host'],
      spec: transcribeSpec,
      markSessionDirty,
    });
  }

  // Wire up the remaining sidebar utility buttons (Shrink URL, Clear changes).
  const sidebarUtilsEl = viewEl.querySelector<HTMLElement>('#sidebar-utils');
  if (sidebarUtilsEl) {
    sidebarUtilsEl
      .querySelector<HTMLButtonElement>('#shrink-url-btn')
      ?.addEventListener('click', function (this: HTMLButtonElement) {
        shrinkUrl(runtime, tool.manifest, barSeq);
        const prev = this.textContent;
        this.textContent = t('Shrunk!');
        setTimeout(() => {
          this.textContent = prev;
        }, 1500);
      });
  }

  // WYSIWYG editor overlay (render.layout:'editor'): mount the direct-manipulation
  // layer over the live canvas. Dynamically imported (gated, never static) so it's
  // only pulled in for editor-layout tools - the engine and every other tool are
  // untouched. It reads/writes the flat `boxes` array through runtime.setInput.
  if (editorLayout && canvasEditInput && canvasEl && stageEl) {
    // The artboard is a resizable document. Restore its size from the URL's
    // reserved width/height (px) if present, then re-fit. Skipped in carousel mode -
    // the strip size is owned by syncStrip (from the page count/size inputs), and a
    // reserved ?width/?height must not overwrite it.
    if (!pagesMode && !fixedCanvasMode) {
      if ((urlWidth ?? 0) > 0) canvasEl.style.width = urlWidth + 'px';
      if ((urlHeight ?? 0) > 0) canvasEl.style.height = urlHeight + 'px';
      if ((urlWidth ?? 0) > 0 || (urlHeight ?? 0) > 0) resetView();
    }
    // Resize the document: keep box coordinates fixed (they don't scatter), resize
    // the canvas, mirror it to the export dimensions so output matches, and re-fit.
    const setCanvasSize = (w: number, h: number, unit = 'px'): void => {
      // w/h are in `unit`; the artboard DOM is always px (a physical unit maps at the
      // 96-DPI CSS convention), while the export bar carries the physical size so the
      // output renders at the chosen DPI.
      const pxW = Math.round(unit === 'px' ? w : toCssPx({ value: w, unit: unit as Unit }));
      const pxH = Math.round(unit === 'px' ? h : toCssPx({ value: h, unit: unit as Unit }));
      canvasEl.style.width = pxW + 'px';
      canvasEl.style.height = pxH + 'px';
      actionsApi?.setDims?.({ width: w, height: h, unit });
      markUserDirty('w');
      markUserDirty('h');
      resetView();
    };

    // --- Presentation mode (plan 112) ------------------------------------------------
    // A lazily-imported view state over the live canvas: it clones the rendered
    // `.lolly-frame-page` nodes out of contentEl into a body-level fullscreen deck stage
    // and never mutates the editor DOM, so exit restores the editor for free. Present is
    // reachable from the ⋯ menu (actions.present) and by opening a `?present` link.
    let presenter: import('./present-mode.ts').PresentController | null = null;
    // Debounced `s=` writer - mirrors updateFullParam, but no more than once per second
    // (reveal's MAX_REPLACE_STATE_FREQUENCY; Safari throttles replaceState). Writes the
    // reorder-proof frame id, so a deep link survives a later frame reorder.
    let sTimer: ReturnType<typeof setTimeout> | null = null;
    let sPending: string | null = null;
    const writePresentUrl = (mutate: (sp: URLSearchParams) => void): void => {
      const sp = new URLSearchParams(currentQuery());
      mutate(sp);
      barSeq.v++;
      const q = sp.toString();
      history.replaceState(null, '', q ? `${TOOL_URL_BASE}?${q}` : TOOL_URL_BASE);
    };
    const flushPresentAddress = (): void => {
      if (sPending == null) return;
      const s = sPending;
      sPending = null;
      writePresentUrl((sp) => {
        sp.set('present', '');
        if (presentLoop) sp.set('kiosk', '');
        sp.set('s', s);
      });
    };
    const writePresentAddress = (frameId: string): void => {
      sPending = frameId;
      if (sTimer) return; // a write is already scheduled this window
      sTimer = setTimeout(() => {
        sTimer = null;
        flushPresentAddress();
      }, 1100);
    };
    /**
     * Open the deck. `at` starts on one frame (the top bar's "Present from this slide" and
     * the navigator's row menu both pass a frame id, which present-mode parses as an `s=`
     * address exactly like the deep link); `speaker` opens straight into the speaker view.
     * Both optional, so every existing caller - the rail's Present action, the `?present`
     * auto-entry - keeps its no-argument call and its behaviour.
     */
    const openPresenter = async (o?: { at?: string; speaker?: boolean }): Promise<void> => {
      if (presenter) return;
      const { openPresentMode } = await import('./present-mode.ts');
      // `varsFrom` is read ONCE, at open, off `contentEl`'s inline `--brand-*` slots -
      // and `applyBrandVars` writes those asynchronously (seven awaited token resolves).
      // The `?present` deep link opens on the first rAF that sees a frame page, which on
      // a cold token cache is BEFORE the slots exist: `readScopeVars` returned [] and
      // every `var(--brand-on-primary, #ffffff)` box painted its white fallback, with no
      // second read to recover when the tokens arrived a moment later. So wait for the
      // same promise every other deep-link path waits on (plan 179 T7). On the menu path
      // this is one microtask - the promise settled during mount, long before the click -
      // and it carries brandVarsReady's own 3s cap, so a stalled fetch cannot wedge it.
      await brandVarsReady;
      if (presenter || !viewEl.isConnected) return; // re-check after the awaits
      // Present from the ENGINE's render (nested frame pages WITH their children), not the
      // editor's live DOM: the free-canvas editor flattens boxes to siblings of empty
      // frame-page backgrounds for editing, so cloning those pages would show blank frames.
      // getHydrated() reflects the current committed model as the template renders it.
      const presentSource = document.createElement('div');
      presentSource.innerHTML = runtime.getHydrated();
      const transitionVal = String(
        runtime.getModel().find((i) => i.id === 'transition')?.value ?? 'slide'
      );
      // Derived from the manifest so an option added to the select can never be
      // silently downgraded to a push here (that is how `flight` was lost once).
      const deckTransitionOptions = (): Set<string> =>
        new Set(
          (
            (
              tool.manifest.inputs.find((i) => i.id === 'transition') as
                | { options?: Array<string | { value?: unknown }> }
                | undefined
            )?.options ?? []
          )
            .map((o) => String(typeof o === 'string' ? o : (o?.value ?? '')))
            .filter(Boolean)
        );
      presenter = openPresentMode({
        source: presentSource,
        // A frame id IS an `s=` address (present-mode resolves position / id / `h.f`), so
        // "from this slide" needs no second entry point - it just addresses the open.
        initial: o?.at || presentAddress,
        loop: presentLoop,
        // The presenter stage is a body-level overlay, so it inherits none of the
        // `--brand-*` slots applyBrandVars wrote onto this canvas - hand it the canvas to
        // copy them from, or a box coloured `var(--brand-on-primary, #ffffff)` paints its
        // fallback while presenting and the brand colour while editing (plan 179 T7).
        varsFrom: contentEl,
        // Every value the manifest's `transition` select offers, and no more: the
        // presenter reads this one string as the deck's own transition, so a spelling
        // dropped here is a chosen option that silently becomes a push. `flight` (the
        // camera move over the canvas, plans/179 section 7) was exactly that - offered in
        // the sidebar, written to the model, honoured by the .pptx and mp4 exports, and
        // downgraded on the way into the one player that can actually fly it. Anything
        // unrecognised still falls back to the manifest's own default.
        transition: deckTransitionOptions().has(transitionVal)
          ? (transitionVal as 'slide' | 'fade' | 'morph' | 'flight')
          : 'slide',
        onAddress: (frameId, _index, build) =>
          writePresentAddress(build > 0 ? `${frameId}.${build}` : frameId),
        onClose: () => {
          presenter = null;
          if (sTimer) {
            clearTimeout(sTimer);
            sTimer = null;
          }
          sPending = null;
          // Leave the editor's own URL clean: drop the present params on exit.
          writePresentUrl((sp) => {
            sp.delete('present');
            sp.delete('kiosk');
            sp.delete('s');
          });
        },
      });
      // "Speaker view" opens the deck AND its notes panel in one gesture. Done here rather
      // than as an option on openPresentMode because the controller's own `s` key toggles
      // the very same function - one implementation, two doors.
      if (o?.speaker) presenter?.speaker();
    };

    // New from template (plans/142 WP-1): re-open the Start chooser from the editor's
    // Lolly menu. Unlike the fresh-open seed (applyPatch, deliberately outside the
    // history), a mid-session pick REPLACES live content, so it applies through the
    // history-wrapped setInput - one ⌘Z restores the doc, exactly like the import
    // panel's commit. Blank/Escape/close resolve `{}` and apply nothing.
    let templateChooserBusy = false;
    const openTemplatesMidSession = async (): Promise<void> => {
      if (templateChooserBusy) return;
      templateChooserBusy = true;
      try {
        const { openTemplateChooser, parseTemplates } = await import('./template-chooser.ts');
        const templates = parseTemplates(templateMeta);
        try {
          const { createUserTemplateStore } = await import('../lib/user-templates.ts');
          const mine = await createUserTemplateStore(
            host as unknown as Parameters<typeof createUserTemplateStore>[0]
          ).list(toolId);
          for (const ut of mine)
            templates.push({
              id: ut.id,
              name: ut.name,
              category: t('Your templates'),
              values: ut.values as Record<string, InputValue>,
            });
        } catch {
          /* user templates are best-effort */
        }
        if (!templates.length) return;
        // Held in a local first: the mount-gate contract test (tool-template-mount.
        // test.ts) forbids the literal `await openTemplateChooser(` file-wide, so the
        // fresh-open path can never regress into gating createRuntime on a click.
        // This callback runs long after mount, where waiting on the pick is the point.
        const pick = openTemplateChooser({
          toolName: tool.manifest.name,
          title: t('New from template'),
          toolId,
          templates,
          host,
          formats: tool.manifest.render?.formats,
          onPick: ({ templateId, category }) =>
            setDesignIntent(inferDesignIntent({ templateId, templateCategory: category }), true),
          // Same navigate-away teardown as the fresh-open chooser: _cleanup calls
          // templatePickClose so the modal never outlives the view.
          onOpen: (close) => { if (templatePickTornDown) close(); else templatePickClose = close; },
        });
        const chosen = await pick;
        if (templatePickTornDown || !viewEl.isConnected) return;
        for (const [k, v] of Object.entries(chosen ?? {})) await runtime.setInput(k, v);
        if (Object.keys(chosen ?? {}).length) {
          await migrateBlockRowIds(runtime);
          // setInput resolves no refs, so the template's {color.*} tokens + tool-URL
          // image stubs would render black/placeholder; run the mount's resolve pass
          // once, mirroring the fresh-open seed path above.
          if (!templatePickTornDown && viewEl.isConnected) await runtime.resolveRefs();
          refreshDesignExperience(true);
        }
      } catch (e) {
        host.log?.('warn', 'template chooser failed: ' + String(e));
      } finally {
        templateChooserBusy = false;
      }
    };

    // The document name lives in ONE place - the export sheet's filename field - and three
    // surfaces read and write it (the Document-info panel, the top bar, the save snapshot's
    // `__label`). Hoisted out of the `info` literal below so the bar shares the exact same
    // pair rather than a second copy of the selector.
    const getFilename = (): string =>
      viewEl.querySelector<HTMLInputElement>('[data-action="filename"]')?.value || '';
    const setFilename = (v: string): void => {
      const fn = viewEl.querySelector<HTMLInputElement>('[data-action="filename"]');
      if (fn) {
        fn.value = v;
        fn.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };

    // History is a SINGLE-SLOT contract (`historyControls`), and this layout now has two
    // registrants: the overlay's rail pair and the top bar's. Fanning out here keeps the
    // slot single while letting both stay live - without it whichever registered last
    // would leave the other's buttons frozen at their mount-time enabled state.
    const historySyncs: Array<(canUndo: boolean, canRedo: boolean) => void> = [];
    const registerHistory = (sync: (canUndo: boolean, canRedo: boolean) => void): void => {
      historySyncs.push(sync);
      historyControls = {
        sync: (canUndo, canRedo) => {
          for (const s of historySyncs) s(canUndo, canRedo);
        },
      };
      refreshHistoryUI();
    };

    // The three Design chrome modules (plan 179 M1-M3). Declared here so the top bar's
    // Navigator toggle can reach a column that is mounted after it, and so teardown has
    // one list to fold into `_cleanup`.
    let designTopbar: import('./design-topbar.ts').DesignTopbar | null = null;
    let designNav: import('./design-navigator.ts').DesignNavigatorHandle | null = null;
    let designInspector: import('./design-inspector.ts').DesignInspectorHandle | null = null;
    let designInspectorFloat: import('./design-inspector-float.ts').DesignInspectorFloatHandle | null = null;

    /**
     * Column open state is a DEVICE preference, not document data: it must never dirty the
     * document, ride a collab op or travel in a saved session, which is what `host.state`
     * would mean. Same reasoning (and the same try/catch) as the sidebar width.
     */
    const readColumnPref = (key: string): boolean => {
      try {
        const v = localStorage.getItem(key);
        if (v === 'open') return true;
        if (v === 'closed') return false;
      } catch {
        /* private mode / blocked storage: fall through to the width default */
      }
      return window.innerWidth > 1180;
    };
    const writeColumnPref = (key: string, open: boolean): void => {
      try {
        localStorage.setItem(key, open ? 'open' : 'closed');
      } catch {
        /* best-effort */
      }
    };

    import('./free-canvas.ts')
      .then(({ initFreeCanvas }) => {
        if (!viewEl.isConnected) return; // navigated away before the chunk loaded
        // The host-UI profile setter is a web-shell extension (WebProfileAPI), not on
        // the engine's read-only ProfileAPI - surface it via a narrow cast so the
        // Document-info panel can toggle the provenance opt-in.
        const profileApi = host.profile as typeof host.profile & {
          set?: (p: Profile) => Promise<void>;
        };
        const fc = initFreeCanvas({
          viewEl,
          stageEl,
          canvasEl,
          outerEl,
          runtime,
          host,
          input: canvasEditInput,
          nativeW,
          nativeH,
          onDirty: markUserDirty,
          // In carousel mode the strip size is owned by syncStrip (page count/size inputs);
          // withholding setCanvasSize stops the artboard-resize + design-import paths from
          // clobbering the strip. (The rail's size control is the page-size picker instead.)
          setCanvasSize: pagesMode || fixedCanvasMode ? undefined : setCanvasSize,
          setDocumentSettings: ({ unit, dpi, width, height }) => {
            // Design owns a document-level unit/DPI.  The export panel remains the
            // physical-output surface, but it mirrors that document state rather than
            // maintaining a competing temporary unit preference.
            actionsApi?.setDims?.({ unit, dpi, width, height });
          },
          // Multi-page (carousel) mode: gives the overlay the page-count + page-size input
          // ids so its rail exposes a page stepper / size picker, and so it translates box
          // gestures by each frame's offset. Absent for single-page editors.
          pages: pagesCfg
            ? {
                countField: pagesCfg.count,
                widthField: pagesCfg.width,
                heightField: pagesCfg.height,
                min: pagesCfg.min ?? 1,
                max: pagesCfg.max ?? 6,
              }
            : undefined,
          // Frame-primitive mode (plan 93 F1b): frame field names so the overlay renders
          // frame-local + re-buckets on drop. Absent unless the canvas declares frameField.
          frame: frameCfg,
          // One-shot EDITOR state off the link (docs/url-mode.md "On a tool route"): the
          // `_ui` object param plus the `_sel`/`_t`/`_panel` shorthands, which win on
          // conflict. All in the `_` namespace the engine reserves outright (parseUrlState
          // skips it), so none can ever shadow a tool input; syncUrl drops them on the
          // first edit.
          deepLink: parseEditorState(urlFlags),
          // Document-info panel: read/write the export/save name, plus at-a-glance
          // details. Name binds to the export bar's filename field (the canonical
          // save name); last-edited reads the resumed session's timestamp if any.
          info: {
            id: tool.manifest.id,
            name: tool.manifest.name,
            version: tool.manifest.version,
            status: tool.manifest.status,
            formats: tool.manifest.render.formats,
            getFilename,
            setFilename,
            lastEdited: (async () => {
              if (!slot) return null;
              try {
                return (await host.state.list()).find((s) => s.slot === slot)?.updatedAt || null;
              } catch {
                return null;
              }
            }) as () => string | Promise<string> | null | undefined,
            // Export provenance - a read-only view of the name/contact baked into the
            // file's metadata (see engine metadata.ts buildExportMeta) + the opt in/out
            // toggle. Only offered where the shell can persist the profile (host.profile.set).
            provenance:
              typeof profileApi.set === 'function'
                ? {
                    editHref: '#/profile?focus=use-details',
                    get: async () => {
                      const pr = await host.profile.get();
                      const join = (a?: string, b?: string, sep = ' '): string =>
                        [a, b]
                          .map((s) => (s ?? '').trim())
                          .filter(Boolean)
                          .join(sep);
                      return {
                        optedIn: pr.useDetails === true,
                        author: join(pr.firstname, pr.lastname),
                        contact: join(pr.email, pr.phone, ' · '),
                      };
                    },
                    setOptIn: async (on: boolean) => {
                      const cur = await host.profile.get();
                      await profileApi.set!({ ...cur, useDetails: on });
                    },
                  }
                : undefined,
          },
          // Picking a Lolly link / saved session for a box image opens its inputs
          // first (configure → insert), same as the sidebar asset slots. The picker
          // passes mode 'edit' when re-opening the box's current Lolly render.
          editTool: (toolUrl: string, mode = 'insert') =>
            openEmbedEditor(host, { editUrl: toolUrl, slotLabel: t('image'), mode }),
          // The editor is chromeless (no sidebar header), so the free-canvas rail
          // hosts a pair of visible undo/redo buttons. Since plan 179 M1 the design
          // top bar hosts a second pair, so `registerHistory` fans the single-slot
          // contract out to both rather than letting the later mount silence the
          // earlier one (the header pair can't exist in this layout, so no conflict).
          history: {
            undo: undoHistory,
            redo: redoHistory,
            register: registerHistory,
          },
          // Chrome the tool view owns and the overlay's trimmed Lolly menu now hosts: the
          // theme cycle and sound toggles the retired zoom HUD used to carry (see the
          // setupStageNav call above), the profile avatar, and "Save to your library".
          // The elements are ADOPTED, not cloned - the HUD is not built in this layout,
          // so nothing else holds a claim on them.
          chrome: {
            themeToggle: themeToggle ?? undefined,
            soundToggle: soundToggle ?? undefined,
            saveToLibrary: canSaveSession
              ? () => {
                  renderSaveBtn?.click();
                }
              : undefined,
          },
          // Primary actions as prominent rail icons (the chromeless editor has no
          // bottom pill). Each delegates to the tool's existing handler/button so
          // the export/save/copy/share logic isn't duplicated: Export opens the
          // export popup, Save is the in-place checkpoint save, Copy writes the
          // rendered output, Share copies a shareable link. dirtyRef lets the rail
          // Save icon mirror the render pill's amber "unsaved" cue.
          actions: {
            export: () => renderFab?.click(),
            save: () => renderSaveBtn?.click(),
            copy: () => viewEl.querySelector<HTMLButtonElement>('[data-action="copy"]')?.click(),
            share: () =>
              viewEl.querySelector<HTMLButtonElement>('[data-action="copy-url"]')?.click(),
            // Present the frames as a fullscreen deck (plan 112). Fire-and-forget: the
            // presenter module is lazily imported on first use. An optional frame id starts
            // the deck there - what the navigator's "Present from here" row spends.
            present: (atFrameId?: string) => {
              void openPresenter(atFrameId ? { at: atFrameId } : undefined);
            },
            // Only offered when the tool ships templates (index metadata / inline
            // manifest); a tool with only user-saved templates reaches them via a
            // fresh open, which the chooser gate already covers.
            newFromTemplate: hasTemplates
              ? () => {
                  void openTemplatesMidSession();
                }
              : undefined,
            // The chromeless editor's home for "Bulk from rows" - the sidebar header
            // button that carries it everywhere else does not exist in this layout.
            bulk: canBulk
              ? () => {
                  openBulk();
                }
              : undefined,
            canSave: canSaveSession,
            dirtyRef: renderSaveBtn,
          },
        } as Parameters<typeof initFreeCanvas>[0]);

        // ── The Design chrome: top bar + navigator + inspector (plan 179 M1-M3) ──────
        //
        // Lazily imported alongside the overlay, not statically, so a tool that never
        // mounts an editor pays nothing for three modules it cannot use. Each is mounted
        // through the ports on `fc.design` (see design-ports.ts) - none of them import
        // free-canvas, and none of them reach the model except through those ports, which
        // is why they are unit-testable and why this wiring is the only place that knows
        // both halves. Order matters: the bar measures its own height into
        // `--stage-reserve-top` before the columns report their widths, so the first fit
        // the canvas performs already accounts for all three bands.
        void Promise.all([
          import('./design-topbar.ts'),
          import('./design-navigator.ts'),
          import('./design-inspector.ts'),
          import('./design-inspector-float.ts'),
        ])
          .then(([{ mountDesignTopbar }, { initDesignNavigator }, { initDesignInspector }, { wireDesignInspectorFloat }]) => {
            if (!viewEl.isConnected) return;
            const design = fc.design;
            openDesignMarkMenu = (anchor: HTMLElement) => design.openLollyMenu(anchor);

            // The navigator is the only writer of a stage side reserve, and it writes through
            // the overlay's arbiter - which also owns the docked rail's share of the left
            // band, so a navigator and an open timeline cannot each claim the same edge.
            //
            // The RIGHT number is always 0: the inspector is not a stage child any more but an
            // occupant of the app's one right-hand column (lib/edge-dock.ts), and that column
            // reserves its width by nudging `#view` with `--dock-w`. Passing its width here as
            // well would take the same space twice.
            let navW = 0;
            const pushWidths = (): void => {
              design.setColumnWidths(navW, 0);
            };

            // ── One right-hand panel (Andy, 2026-09-02: "a single left sidebar and a single
            // right sidebar") ───────────────────────────────────────────────────────────
            //
            // The inspector used to append itself to the stage, which put a second right-hand
            // panel INSIDE the canvas surface, beside the edge dock the export sheet was
            // already using - two columns over the artwork, one of them clipping it. It is now
            // an occupant of that one column (lib/edge-dock.ts) like everything else, so
            // "the inspector is open" means the same live panel is either in that column
            // or in its persisted floating box. `setInspectorOpen` is the single writer.
            //
            // The column is the app's, not this view's: it can hand a panel back on its own
            // (the user undocks it, or the window drops below the mobile breakpoint, where the
            // whole dock is inert). That is why the release path - not just the bar's toggle -
            // is what records the state and re-syncs the bar.
            const INSP_KEY = 'lolly-design-inspector';
            let inspectorOpen = false;
            const setInspectorOpen = (open: boolean): void => {
              designInspectorFloat?.setOpen(open);
            };

            // (a) The top bar. Every port is a live read off the overlay or this view; the
            // bar holds no state of its own beyond its own open menu.
            designTopbar = mountDesignTopbar({
              stageEl,
              canvasEl,
              // The Home pill moved out of the view's corner and into the bar's left slot
              // (see the render gate above), so the bar emits it and we wire it here.
              backPillHtml: backHomeHtml(backPillOpts),
              history: { undo: undoHistory, redo: redoHistory, register: registerHistory },
              name: {
                get: getFilename,
                set: setFilename,
                // The export field's own placeholder IS the auto-filename (tool-actions keeps
                // it fresh on every `lolly:export-open`), so reading it here needs no second
                // implementation of the naming rules.
                placeholder: () =>
                  viewEl.querySelector<HTMLInputElement>('[data-action="filename"]')?.placeholder ||
                  '',
              },
              intent: {
                get: () => designIntent,
                set: (value) => {
                  const next = DESIGN_INTENT_OPTIONS.find(
                    (option) => option.value === value
                  )?.value;
                  if (next) setDesignIntent(next, true);
                },
                options: DESIGN_INTENT_OPTIONS,
              },
              zoom: {
                fitAll: () => {
                  stageZoom?.fit();
                },
                // Deliberately the overlay's own focus path (`fc-focus-rect`), not a rect this
                // view converts: the overlay owns the canvas→client mapping, and the navigator
                // and the timeline already frame artboards through exactly this door.
                fitArtboard: () => {
                  const id = design.activeFrameId();
                  if (id) design.artboard.focus(id);
                },
                zoomBy: (f) => {
                  stageZoom?.zoomBy(f);
                },
                zoomTo: (abs) => {
                  stageZoom?.zoomTo(abs);
                },
                actual: () => stageZoom?.actual() ?? 0,
                subscribe: (cb) =>
                  stageZoom?.subscribe(cb) ??
                  (() => {
                    /* no stage nav: nothing to follow */
                  }),
              },
              timeline: {
                toggle: () => design.toggleTimeline(),
                isOpen: () => design.isTimelineOpen(),
              },
              timelineEnabled: () => designTimelineEnabled(designIntent),
              navigator: {
                toggle: () => {
                  const n = designNav;
                  if (n) n.setOpen(!n.isOpen());
                },
                isOpen: () => !!designNav?.isOpen(),
              },
              // The inspector's only show/hide control from outside the panel. Its detachable
              // controller decides whether "open" restores the edge column or the floating
              // box; the top bar only asks for the shared live surface.
              inspector: {
                toggle: () => setInspectorOpen(!inspectorOpen),
                isOpen: () => inspectorOpen,
              },
              // …and the same column's other occupant the bar has to know about: while the
              // compact zoom bar is docked it carries Fit / NN% / ±, so the bar drops its own
              // copy of them rather than showing the five verbs twice.
              dock: {
                // Docked AND on screen: a collapsed column hides its body, so a bar that read
                // occupancy alone dropped Fit / NN% / ± (and the mark, and the avatar) for a
                // compact zoom bar nobody could see.
                zoomDocked: () => isDocked('zoom') && !edgeDockCollapsed(),
                subscribe: (cb) => onDockChange(cb),
              },
              share: () => {
                viewEl.querySelector<HTMLButtonElement>('[data-action="copy-url"]')?.click();
              },
              present: (o) => {
                void openPresenter(o);
              },
              exportSheet: (o) => {
                if (o?.format) actionsApi?.setFormat?.(o.format);
                renderFab?.click();
              },
              // The deck-wide Narrate row (plans/180 section 8). Undefined where the overlay
              // offers no narration - no speech bridge, no frames - and then there is no row.
              narrate: design.narrationActions,
              narrationEnabled: () => designNarrationEnabled(designIntent),
              model: {
                getInput: (id) => runtime.getModel().find((i) => i.id === id)?.value,
                // Caught, not floated: the bar writes doc-level inputs the MANIFEST declares
                // (`autoAdvance`), and a tool that has not declared one yet must leave a log
                // line rather than an unhandled rejection on the page.
                setInput: (id, v) => {
                  markUserDirty(id);
                  void Promise.resolve(runtime.setInput(id, v as InputValue)).catch((e: unknown) =>
                    host.log?.('warn', `top bar could not set "${id}": ${String(e)}`)
                  );
                },
              },
              // Loop is the reserved `?kiosk` flag, not a model field: it describes how the
              // deck is PLAYED, and a shared link is how that travels.
              loop: {
                get: () => presentLoop,
                set: (v) => {
                  presentLoop = v;
                  writePresentUrl((sp) => {
                    if (v) sp.set('kiosk', '');
                    else sp.delete('kiosk');
                  });
                },
              },
              onMarkMenu: (anchor) => design.openLollyMenu(anchor),
              // The avatar is ADOPTED (moved), so exactly one surface holds it at a time. The
              // bar is its home while the right column is closed; when the compact zoom bar
              // takes the column the bar hands the avatar to that bar instead (profileDock
              // below), so the profile menu is always reachable and never doubled.
              profileEl: profileToggle ?? undefined,
              // The docked compact zoom bar is the stage nav's own pill, so its element is
              // where the avatar goes while the column holds it. Null before the pill exists
              // (or on a layout that builds none), which the bar reads as "keep it".
              profileDock: () => stageZoom?.profileHome() ?? null,
              // A document can only be presented (or have an artboard framed) if the tool
              // declares a frame primitive AND the document actually holds one.
              hasFrames: () => {
                if (!frameCfg) return false;
                if (design.activeFrameId()) return true;
                const kindField = (design.model.cfg as { kindField?: string }).kindField || 'kind';
                const frameKind = design.model.frame?.frameKind || frameCfg.frameKind || 'frame';
                return design.model
                  .getBoxes()
                  .some((b) => String(b[kindField] ?? '') === frameKind);
              },
              activeFrameId: () => design.activeFrameId(),
            });
            syncDesignIntentChrome = () => {
              designTopbar?.sync();
              designInspector?.sync();
            };
            applyDesignIntentLayout = (outcome) => {
              if (outcome.openNavigator && !designNav?.isOpen()) designNav?.setOpen(true);
              if (!outcome.openNavigator && designNav?.isOpen()) designNav.setOpen(false);
              if (outcome.openTimeline !== design.isTimelineOpen()) design.toggleTimeline();
            };
            refreshDesignExperience(Boolean(templateParam));
            // No frame primitive at all: there is no deck here and never will be, so the
            // Present split is not disabled - it is not offered.
            if (!frameCfg) {
              const split = designTopbar.el.querySelector<HTMLElement>('.dtb-split');
              if (split) split.hidden = true;
            }
            // The bar's Home pill is not in the DOM when the view-wide mountBackPill() runs
            // (this callback is a dynamic import behind it), so wire the bar's own subtree.
            mountBackPill(designTopbar.el, { intercept: backPillIntercept });
            mountHomeFab(designTopbar.el);
            // An edit made to the filename in the export sheet must show up in the bar. The
            // event is dispatched on the actions panel and does not bubble, so listen there.
            // Both edges of the sheet: it can open on one name and close on another (the field
            // normalises, or an unsaved edit is dropped), and a bar left on the stale one
            // writes it straight back over the sheet's at the next keystroke.
            const onExportOpen = (): void => designTopbar?.sync();
            actionsEl?.addEventListener('lolly:export-open', onExportOpen);
            actionsEl?.addEventListener('lolly:export-close', onExportOpen);
            // …and the OPEN event is not enough: it fires when the sheet opens, so a name
            // typed into the Filename field while it is open left the bar showing the old
            // one for the rest of the session - and the next keystroke in the bar wrote that
            // stale value straight back over the sheet's. `input` bubbles up to the panel, so
            // one delegated listener covers the field however it is rebuilt; the bar's own
            // `sync()` skips an unchanged value, so this is inert while typing in the bar.
            const onFilenameInput = (e: Event): void => {
              if ((e.target as HTMLElement | null)?.closest?.('[data-action="filename"]'))
                designTopbar?.sync();
            };
            actionsEl?.addEventListener('input', onFilenameInput);

            // (b) The navigator column (slides / artboards + the active frame's layers).
            const NAV_KEY = 'lolly-design-nav';
            designNav = initDesignNavigator({
              stageEl,
              canvasEl,
              skin: window.matchMedia?.(
                '(pointer: coarse) and (max-width: 640px), (pointer: coarse) and (max-height: 430px)'
              ).matches
                ? 'strip'
                : 'column',
              model: design.model,
              selection: design.selection,
              artboard: design.artboard,
              thumb: design.thumb,
              actions: design.navigatorActions,
              // Notes to voice (plans/180): undefined on a host with no speech bridge, and
              // then the row's dot is the speaker-notes mark it has always been.
              narration: design.narrationActions,
              initiallyOpen: readColumnPref(NAV_KEY),
              onOpenChange: (open) => {
                writeColumnPref(NAV_KEY, open);
                designTopbar?.sync();
              },
              onWidthChange: (px) => {
                navW = px;
                pushWidths();
              },
            });
            if (!slot && templateParam) applyDesignIntentLayout(currentDesignOutcome());

            // (c) The inspector column, then hand it to the overlay so the object bar's
            // Text / More / Dims / Stroke buttons reveal its sections instead of opening
            // the one-slot popovers.
            //
            // It is built DETACHED and never appended to the stage: `setInspectorOpen` puts
            // it in the one right-hand column, which is also what takes it back out. Its own
            // header close button comes back here through `onClose` for the same reason - so
            // the panel and the bar's toggle can never disagree about where it is.
            designInspector = initDesignInspector({
              stageEl,
              canvasEl,
              model: design.model,
              selection: design.selection,
              artboard: design.artboard,
              actions: design.inspectorActions,
              // The Narrate button under the Speaker notes, and the document's own narration
              // settings. Absent means neither is drawn (plans/180 section 8).
              narration: design.narrationActions,
              narrationEnabled: () => designNarrationEnabled(designIntent),
              fonts: design.fonts,
              // Document health asks the SAME registry vector export uses whether a
              // rendered run has real font bytes. Kept lazy: opening Design without
              // its inspector never pulls the font registry into this chunk.
              resolveFont: async (style, text) => {
                const { resolveVectorFont } = await import('../bridge/font-registry.ts');
                return Boolean(await resolveVectorFont(style, text));
              },
              voices: host.speech?.voices ? () => host.speech!.voices() : undefined,
              fields: design.fields,
              // The panel skips its whole render while closed, and it is built DETACHED - so
              // without this it was constructed "open" and rebuilt its full property column on
              // every selection change and every commit, for a node that was never in the
              // document. The dock's own setOpen(true) forces a fresh sync on the way in.
              initiallyOpen: false,
              // The close button removes the column from the page, which drops focus to
              // <body>; the bar's toggle is the only way back in, so it takes the keyboard.
              onClose: () => {
                setInspectorOpen(false);
                designTopbar?.focusInspectorToggle();
              },
            });
            designInspectorFloat = wireDesignInspectorFloat({
              inspector: designInspector,
              head: designInspector.el.querySelector<HTMLElement>('.fc-insp-headbar')!,
              onOpenChange: (open, reason) => {
                inspectorOpen = open;
                if (reason === 'user') writeColumnPref(INSP_KEY, open);
                designTopbar?.sync();
              },
            });
            // The object bar's Text / More / Dims / Stroke buttons reveal a section, and that
            // can arrive while the column is out of the dock - so the handle the overlay gets
            // asks for a slot FIRST and then scrolls. Wrapped here rather than inside the
            // column, because taking a dock slot is this view's job, not the panel's.
            design.setInspector({
              reveal: (section) => {
                setInspectorOpen(true);
                designInspector?.reveal(section);
              },
            });
            // Restored from the device-local open preference. The detachable controller
            // independently remembers whether that means the edge column or a float box.
            if (readColumnPref(INSP_KEY)) setInspectorOpen(true);
            // BOTH columns are mounted after the bar, and neither announces its state at
            // mount: the navigator fires `onOpenChange` only from its own setOpen, and the
            // inspector's is now a dock request this view makes. So the bar's own `sync()`
            // (which ran inside mountDesignTopbar, when both handles were still null) had
            // every toggle reading `aria-pressed="false"` over an open column: a screen
            // reader told the panel was off while it was on, and the pressed styling never
            // painted. One sync here, once all three exist, with the real state.
            syncDesignIntentChrome();

            const prevChromeCleanup = viewEl._cleanup;
            viewEl._cleanup = () => {
              actionsEl?.removeEventListener('lolly:export-open', onExportOpen);
              actionsEl?.removeEventListener('lolly:export-close', onExportOpen);
              actionsEl?.removeEventListener('input', onFilenameInput);
              // Unregister the inspector BEFORE destroying it, so a late object-bar rebuild
              // cannot reveal a section on a column that is already gone - and take it out of
              // the shared right-hand column, which outlives this view and would otherwise
              // keep a slot for an element nobody owns any more.
              try {
                design.setInspector(null);
              } catch (e) {
                console.error(e);
              }
              try {
                designInspectorFloat?.destroy();
              } catch (e) {
                console.error(e);
              }
              designInspectorFloat = null;
              for (const part of [designInspector, designNav, designTopbar]) {
                try {
                  part?.destroy();
                } catch (e) {
                  console.error(e);
                }
              }
              designInspector = designNav = designTopbar = null;
              syncDesignIntentChrome = () => {};
              applyDesignIntentLayout = () => {};
              prevChromeCleanup?.();
            };
          })
          .catch((err: unknown) => console.error('[design] chrome failed to load:', err));

        // The runtime half of the editor-state API (plans/176 v1): the same wire object
        // a link's `_ui` carries, readable and writable while a canvas editor is mounted.
        // `apply` routes through the exact DeepLinkState routine the mount-time deep link
        // runs, and the message listener gives /embed pages the same door with zero new
        // semantics. Editor state only - selection, playhead, an open panel - so an
        // unvetted sender can wiggle the view but never touch the document.
        const ui = {
          getState: () => ({ v: 1 as const, ...fc.uiState() }),
          apply: (state: unknown) => {
            const s = coerceUiState(state);
            if (s) fc.applyUi(s);
          },
        };
        const w = window as unknown as { lolly?: { ui?: typeof ui } };
        w.lolly = { ...w.lolly, ui };
        const onUiMessage = (e: MessageEvent): void => {
          const d = e.data as { type?: unknown; state?: unknown } | null;
          if (d && d.type === 'lolly:ui') ui.apply(d.state);
        };
        window.addEventListener('message', onUiMessage);
        const prevCleanup = viewEl._cleanup;
        viewEl._cleanup = () => {
          window.removeEventListener('message', onUiMessage);
          if (w.lolly?.ui === ui) delete w.lolly.ui;
          try {
            fc.destroy();
          } catch (e) {
            console.error(e);
          }
          prevCleanup?.();
        };
      })
      .catch((err: unknown) => console.error('[design] editor overlay failed to load:', err));

    // `?present` auto-entry: open the deck once the canvas has rendered its frame pages
    // (the runtime paints on mount asynchronously, so poll a few frames for them).
    if (isPresent) {
      let tries = 0;
      const tryOpen = (): void => {
        if (!viewEl.isConnected || presenter) return;
        if (contentEl.querySelector('.lolly-frame-page')) {
          void openPresenter();
          return;
        }
        if (tries++ < 120) requestAnimationFrame(tryOpen); // ~2s at 60fps, then give up
      };
      requestAnimationFrame(tryOpen);
    }

    // ── Editor keyboard verbs (plan 179 M1 section 4) ────────────────────────────
    //
    // Three document-level chords, and only in this layout - a chromeless editor has no
    // visible pill to reach for, so Save and Export need a key. Each delegates to the
    // button that already owns the behaviour, so there is exactly one implementation.
    //
    // NOT Cmd/Ctrl+Shift+P: Firefox opens a private window on it and will not let a page
    // intercept, so a shortcut printed in a menu would silently do the wrong thing on one
    // browser. Cmd/Ctrl+Return is free everywhere and reads as "go".
    //
    // `z`/`y` stay with onHistoryKey and the canvas keeps its own bare-key chords; nothing
    // here collides. A text field always wins - typing beats every shortcut.
    const onDocKey = (e: KeyboardEvent): void => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      if (isTextEditing()) return;
      const k = e.key.toLowerCase();
      if (k === 's') {
        e.preventDefault();
        renderSaveBtn?.click();
        return;
      }
      if (k === 'e') {
        e.preventDefault();
        renderFab?.click();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        void openPresenter();
      }
    };
    window.addEventListener('keydown', onDocKey);

    // Fold the presenter into teardown so navigating away closes the deck cleanly.
    const prevCleanupPresent = viewEl._cleanup;
    viewEl._cleanup = () => {
      window.removeEventListener('keydown', onDocKey);
      try {
        presenter?.close();
      } catch (e) {
        console.error(e);
      }
      prevCleanupPresent?.();
    };
  }

  // Multi-page rich-text document editor (render.layout:'document'). Mounts the
  // document overlay over the live canvas, reading/writing the flat `content` blocks
  // array through runtime.setInput - the same chromeless-canvas + export scaffolding as
  // the editor layout, but a word-processor UI instead of the free-canvas overlay.
  if (documentLayout && docEditInput && canvasEl && stageEl) {
    if ((urlWidth ?? 0) > 0) canvasEl.style.width = urlWidth + 'px';
    if ((urlHeight ?? 0) > 0) canvasEl.style.height = urlHeight + 'px';
    if ((urlWidth ?? 0) > 0 || (urlHeight ?? 0) > 0) resetView();
    const setCanvasSize = (w: number, h: number, unit = 'px'): void => {
      const pxW = Math.round(unit === 'px' ? w : toCssPx({ value: w, unit: unit as Unit }));
      const pxH = Math.round(unit === 'px' ? h : toCssPx({ value: h, unit: unit as Unit }));
      canvasEl.style.width = pxW + 'px';
      canvasEl.style.height = pxH + 'px';
      actionsApi?.setDims?.({ width: w, height: h, unit });
      markUserDirty('w');
      markUserDirty('h');
      resetView();
    };
    import('./doc-editor.ts')
      .then(({ initDocEditor }) => {
        if (!viewEl.isConnected) return; // navigated away before the chunk loaded
        const dc = initDocEditor({
          viewEl,
          stageEl,
          canvasEl,
          runtime,
          host,
          input: docEditInput,
          inputs: tool.manifest.inputs ?? [],
          nativeW,
          nativeH,
          onDirty: markUserDirty,
          setCanvasSize,
          editTool: (toolUrl: string, mode = 'insert') =>
            openEmbedEditor(host, { editUrl: toolUrl, slotLabel: t('image'), mode }),
          history: {
            undo: undoHistory,
            redo: redoHistory,
            register: (sync: (canUndo: boolean, canRedo: boolean) => void) => {
              historyControls = { sync };
              refreshHistoryUI();
            },
          },
          actions: {
            export: () => renderFab?.click(),
            save: () => renderSaveBtn?.click(),
            canSave: canSaveSession,
            dirtyRef: renderSaveBtn,
          },
        } as Parameters<typeof initDocEditor>[0]);
        const prevCleanup = viewEl._cleanup;
        viewEl._cleanup = () => {
          try {
            dc.destroy();
          } catch (e) {
            console.error(e);
          }
          prevCleanup?.();
        };
      })
      .catch((err: unknown) => console.error('[doc-studio] document editor failed to load:', err));
  }

  // Slide-deck editor (render.layout:'deck', e.g. Deck Builder). Mounts an on-canvas overlay
  // into the stage subtree (a sibling region of #tool-canvas - survives the canvas repaint)
  // that decorates the live deck for in-place editing + thumbnail-rail navigation. Dynamically
  // imported so it's only pulled in for deck-layout tools. The sidebar stays (deck is NOT
  // chromeless), so this ADDS to the sidebar rather than replacing it.
  if (deckLayout && deckEditInput && canvasEl && stageEl) {
    import('./deck-editor.ts')
      .then(({ initDeckEditor }) => {
        if (!viewEl.isConnected) return; // navigated away before the chunk loaded
        const de = initDeckEditor({
          viewEl,
          stageEl,
          canvasEl,
          runtime,
          host,
          input: deckEditInput,
          inputs: tool.manifest.inputs ?? [],
          nativeW,
          nativeH,
          onDirty: markUserDirty,
          editTool: (toolUrl: string, mode = 'insert') =>
            openEmbedEditor(host, { editUrl: toolUrl, slotLabel: t('image'), mode }),
          history: {
            undo: undoHistory,
            redo: redoHistory,
            register: (sync: (canUndo: boolean, canRedo: boolean) => void) => {
              historyControls = { sync };
              refreshHistoryUI();
            },
          },
          actions: {
            export: () => renderFab?.click(),
            save: () => renderSaveBtn?.click(),
            canSave: canSaveSession,
            dirtyRef: renderSaveBtn,
          },
        } as Parameters<typeof initDeckEditor>[0]);
        const prevCleanup = viewEl._cleanup;
        viewEl._cleanup = () => {
          try {
            de.destroy();
          } catch (e) {
            console.error(e);
          }
          prevCleanup?.();
        };
      })
      .catch((err: unknown) => console.error('[deck-builder] deck editor failed to load:', err));
  }

  // Wire the back pill(s) - the full-screen one and/or the sidebar one. When the
  // tool has inputs and they've been touched, take the click over and offer the save
  // dialog first; the pill's own `go` is what finally leaves, so the dialog's exits
  // land exactly where the pill says they will (the launch folder when the session
  // came from one, else the view the user arrived from).
  /**
   * The unsaved-work gate every Home/Back pill in this view shares. A `function`
   * declaration, so it hoists over the whole mount: the Design top bar's pill is wired
   * from inside a dynamic import's callback, which may run either side of the call below.
   * Returns true when it has taken the click (a dialog is up), false to let the pill go.
   */
  function backPillIntercept(go: () => void): boolean {
    if (!hasInputs || !userHasMadeChanges || exportedSinceEdit) return false;
    // Offer "Save & leave" only when the tool actually has a save action.
    const canSave = !!actionsEl?.querySelector('[data-action="save"]') && !!actionsApi?.save;
    // If the session carries heavy embedded bytes (a recorded clip stamps meta.bytes),
    // tell the user how big the save is - the recording is what makes a Record session
    // large, and it's stored on-device.
    const heavy = runtime
      .getModel()
      .map((i) => (i.value as { meta?: { bytes?: number } } | undefined)?.meta?.bytes)
      .find((b): b is number => typeof b === 'number' && b > 0);
    const detail = heavy
      ? t('Includes a {size} video clip, stored on this device.', { size: fmtBytes(heavy) })
      : undefined;
    showUnsavedDialog(
      canSave
        ? async () => {
            if (await actionsApi!.save!()) go();
          }
        : null,
      () => {
        go();
      },
      detail
    );
    return true;
  }

  mountBackPill(viewEl, { intercept: backPillIntercept });

  // Mark model inputs dirty the first time the user touches them.
  // The listener lives on the container so it survives renderInputs re-renders.
  (['change', 'input'] as const).forEach((evt) =>
    inputsEl?.addEventListener(evt, (e) => {
      const id = (e.target as HTMLElement).closest<HTMLElement>('[data-input-id]')?.dataset.inputId;
      if (id) markUserDirty(id);
    })
  );

  // ↑/↓ select scrubbing is handled ONCE, app-wide, by select-preview.ts (installed
  // at boot). Do NOT add a per-view arrow handler here: a second stepper made every
  // press advance TWO options - this one stepped + re-rendered, then the document
  // handler stepped the detached select again, and its input listener still updated
  // the runtime - so options between were unreachable by keyboard.

  // Click-to-edit-in-place: a clicked canvas element whose input has a direct
  // in-place editor (colour swatch, asset thumbnail, select) opens THAT right
  // where the user clicked, instead of jumping to the sidebar - one shared
  // popover per input type, reusing the exact same components/commit path the
  // sidebar uses (colorFieldHtml/wireColorField, host.assets.pick), so the two
  // stay in lockstep and there is nothing new to keep in sync. Every other
  // control (text, sliders, vectors, blocks rows) has no in-place equivalent
  // yet and keeps the sidebar-focus behaviour below.
  const INLINE_EDIT_CONTROLS = new Set(['color-picker', 'select', 'asset-picker']);

  /**
   * "Use as a new image" (plans/148 WP-E): bake a framing into new bytes, save
   * them to the user's library as a child of the source, then point the input at
   * the child and reset the framing.
   *
   * Every piece here already existed and is reused rather than reproduced: the
   * placement maths is the engine's (so the baked pixels match the preview), the
   * signing is lib/derived-asset.ts's - the catalog crop's own path, source as a
   * C2PA ingredient with the genAI backfill intact - and the two setInput calls
   * ride the tool view's undo coalescing, so the whole thing is ONE undo step.
   *
   * `key` is the overlay's marker: a top-level framing input id, or
   * "<blocksId>:<index>:<base>" for a row.
   */
  async function bakeFraming(key: string): Promise<void> {
    const blockRef = /^(.+):(\d+):(.+)$/.exec(key);
    const el = canvasEl?.querySelector<HTMLElement>(`[data-framing="${CSS.escape(key)}"]`);
    if (!el) return;
    const frameW = el.offsetWidth,
      frameH = el.offsetHeight;

    // Read the framing values, the fit, and the asset slot to replace - the same
    // two shapes the overlay resolves, kept here rather than exported from it
    // because this side also needs to WRITE the asset back.
    const model = runtime.getModel();
    const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
    let framing: Record<string, number> = {};
    let fit: 'cover' | 'contain' = 'cover';
    let ref: AssetRef | null = null;
    let apply: (next: AssetRef) => Promise<void>;

    if (!blockRef) {
      const input = model.find((i) => i.id === key);
      const assetId = (input as { framingFor?: string } | undefined)?.framingFor;
      const assetInput = assetId ? model.find((i) => i.id === assetId) : undefined;
      ref = (assetInput?.value ?? null) as AssetRef | null;
      if (!input || !ref?.url) return;
      framing = { ...(input.value as Record<string, number>) };
      fit =
        String(model.find((i) => i.id === key.replace(/Framing$/, '') + 'Fit')?.value) === 'contain'
          ? 'contain'
          : 'cover';
      const defaults: Record<string, number> = {};
      for (const f of input.fields ?? []) defaults[f.id] = f.default ?? 0;
      apply = async (next) => {
        await runtime.setInput(assetId!, next as unknown as InputValue);
        await runtime.setInput(key, defaults as unknown as InputValue);
      };
    } else {
      const [, blocksId, idxStr, base] = blockRef as unknown as [string, string, string, string];
      const input = model.find((i) => i.id === blocksId);
      const index = Number(idxStr);
      const rows = Array.isArray(input?.value)
        ? (input!.value as Array<Record<string, unknown>>)
        : [];
      const row = rows[index];
      if (!input || !row) return;
      const assetField = (
        (input.fields ?? []) as Array<{ id: string; type?: string; framingFor?: string }>
      ).find((f) => f.framingFor === base || (f.type === 'asset' && f.id === base));
      ref = (assetField ? row[assetField.id] : null) as AssetRef | null;
      if (!ref?.url) return;
      for (const f of ['zoom', 'x', 'y', 'rotate', 'pitch', 'yaw']) {
        const v = Number(row[`${base}${cap(f)}`]);
        if (Number.isFinite(v)) framing[f] = v;
      }
      fit = String(row[`${base}Fit`]) === 'contain' ? 'contain' : 'cover';
      apply = async (next) => {
        const live = runtime.getModel().find((i) => i.id === blocksId);
        const out = Array.isArray(live?.value) ? [...(live!.value as unknown[])] : [];
        const cur = out[index];
        if (!cur || typeof cur !== 'object') return;
        const merged: Record<string, unknown> = { ...(cur as Record<string, unknown>) };
        if (assetField) merged[assetField.id] = next;
        for (const f of ['zoom', 'x', 'y', 'rotate', 'pitch', 'yaw']) {
          const spec = ((input.fields ?? []) as Array<{ id: string; default?: number }>).find(
            (s) => s.id === `${base}${cap(f)}`
          );
          if (spec)
            merged[spec.id] =
              spec.default ?? (f === 'zoom' ? 100 : f === 'x' || f === 'y' ? 50 : 0);
        }
        out[index] = merged;
        await runtime.setInput(blocksId, out as unknown as InputValue);
      };
    }

    try {
      const { bakeFraming: bake } = await import('../lib/framing-bake.ts');
      const baked = await bake(host as never, ref.url, framing, fit, frameW, frameH, ref.format);
      if (!baked) {
        announce(t('This image can’t be baked here.'), { assertive: true });
        return;
      }
      const { saveDerivedAsset, derivedName } = await import('../lib/derived-asset.ts');
      // The honest edit history for THIS derivation: a crop (the framing's own
      // window) plus an orientation change whenever it rolled or tilted.
      const tilted = Number(framing.rotate) || Number(framing.pitch) || Number(framing.yaw);
      const saved = await saveDerivedAsset(
        host as never,
        ref,
        baked.blob,
        baked.format,
        'frame',
        {
          edits: [
            { action: 'c2pa.cropped' },
            ...(tilted ? [{ action: 'c2pa.orientation' }] : []),
            { action: 'c2pa.resized' },
          ],
          detail: Object.fromEntries(
            Object.entries(framing).map(([k, v]) => [`framing.${k}`, String(v)])
          ),
          dims: `${baked.width}x${baked.height}`,
        },
        derivedName(ref, t('framed'))
      );
      if (!saved) {
        announce(t('This image can’t be saved to your library here.'), { assertive: true });
        return;
      }
      await apply(saved);
      markUserDirty(key);
      markSessionDirty();
      announce(
        tRaw('Saved as "{name}" in your uploads.', { name: String(saved.meta?.name ?? saved.id) })
      );
    } catch (e) {
      host.log?.('warn', 'framing bake failed', { key, error: String(e) });
      announce(t('That image couldn’t be saved. The framing is unchanged.'), { assertive: true });
    }
  }

  // Colour: a temporary, otherwise-invisible instance of the shared colour-field
  // component, positioned over the clicked swatch and opened programmatically -
  // so the popover it opens (float mode) is byte-for-byte the sidebar's own
  // widget, just anchored at the click instead of docked under a sidebar row.
  // Removed the moment its popover closes (Escape / outside click), detected via
  // the `hidden` attribute the component already flips on close - one signal,
  // whichever of the three ways it happened to close.
  function openColorPopover(anchor: HTMLElement, input: InputModelItem): void {
    const box = document.createElement('div');
    box.className = 'canvas-color-popover-host';
    box.innerHTML = colorFieldHtml(input.id, input.value, {
      swatchesOnly: input.swatchesOnly === true,
      float: true,
    });
    document.body.appendChild(box);
    const trigger = box.querySelector<HTMLElement>('.color-trigger');
    const popover = box.querySelector<HTMLElement>('.color-popover');
    if (!trigger || !popover) {
      box.remove();
      return;
    }
    const ar = anchor.getBoundingClientRect();
    box.style.cssText = `position:fixed;left:${Math.round(ar.left)}px;top:${Math.round(ar.top)}px;width:${Math.round(ar.width)}px;height:${Math.round(ar.height)}px;`;
    wireColorField(box, {
      onChange: (fieldId, value) => {
        runtime.setInput(fieldId, value);
        markUserDirty(fieldId);
      },
    });
    trigger.style.opacity = '0';
    trigger.style.pointerEvents = 'none';
    trigger.click(); // opens the popover via the component's own (tested) logic
    const observer = new MutationObserver(() => {
      if (popover.hidden) {
        observer.disconnect();
        box.remove();
      }
    });
    observer.observe(popover, { attributes: true, attributeFilter: ['hidden'] });
  }

  // Select: no shared floating widget exists for this yet (the sidebar uses a
  // plain native <select>, and a native dropdown can't be opened by script from
  // an unrelated click target) - so this is a small bespoke option-list popover,
  // generic enough it could grow into a shared component if more call sites want
  // one. Picking an option commits and closes immediately (a select's change IS
  // the complete action, unlike a colour field's fiddly controls).
  function openSelectPopover(anchor: HTMLElement, input: InputModelItem): void {
    const options = input.options ?? [];
    const box = document.createElement('div');
    box.className = 'canvas-input-popover';
    box.setAttribute('role', 'listbox');
    box.setAttribute('aria-label', input.label ?? input.id);
    box.innerHTML = options
      .map(
        (o, i) =>
          `<button type="button" class="canvas-input-popover-opt${o.value === input.value ? ' is-current' : ''}" role="option" aria-selected="${o.value === input.value}" data-i="${i}">${escape(o.label ?? String(o.value))}</button>`
      )
      .join('');
    box.style.cssText = 'position:fixed;visibility:hidden;left:-9999px;top:0;';
    document.body.appendChild(box);
    const w = box.offsetWidth,
      h = box.offsetHeight;
    const ar = anchor.getBoundingClientRect();
    const cb = fixedContainingBlockOrigin(box);
    const left = Math.max(6, Math.min(ar.left - cb.x, window.innerWidth - w - 8));
    const top = Math.max(6, Math.min(ar.bottom + 6 - cb.y, window.innerHeight - h - 8));
    box.style.cssText = `position:fixed;left:${Math.round(left)}px;top:${Math.round(top)}px;z-index:10001;`;

    const close = (): void => {
      box.remove();
      document.removeEventListener('pointerdown', onDocDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
    box.querySelectorAll<HTMLElement>('[data-i]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const opt = options[Number(btn.dataset.i)];
        if (!opt) return;
        runtime.setInput(input.id, opt.value);
        markUserDirty(input.id);
        close();
      })
    );
    const onDocDown = (e: PointerEvent): void => {
      if (!box.contains(e.target as Node | null)) close();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close();
    };
    setTimeout(() => {
      document.addEventListener('pointerdown', onDocDown, true);
      document.addEventListener('keydown', onKey, true);
    }, 0);
    (
      box.querySelector<HTMLElement>('.is-current') ?? box.querySelector<HTMLElement>('button')
    )?.focus();
  }

  // Asset: host.assets.pick is already a self-contained modal picker (input-
  // agnostic - the sidebar just calls it with an options object), so a click
  // opens it directly, no intermediate popover chrome needed. Mirrors the
  // sidebar's asset-picker wiring in tool-inputs.ts exactly, including the
  // "edit the tool you're using" prompt for a slot that already holds a live
  // Lolly render.
  async function openAssetPickerInline(input: InputModelItem): Promise<void> {
    const curVal = input.value as AssetRef | null;
    const curToolUrl = asStr(asRow(curVal?.meta as InputValue | undefined).toolUrl);
    if (curToolUrl && host.compose?.renderUrl) {
      const intent = await askLollyIntent(
        asStr(asRow(curVal?.meta as InputValue | undefined).name)
      );
      if (!intent) return;
      if (intent === 'edit') {
        const edited = await openEmbedEditor(host, {
          editUrl: curToolUrl,
          slotLabel: input.label ?? input.id,
        });
        if (edited) {
          runtime.setInput(input.id, edited);
          markUserDirty(input.id);
        }
        return;
      }
    }
    const ref = await host.assets.pick({
      title: tRaw('Choose {name}', { name: input.label ?? input.id }),
      type:
        input.assetType === 'any' ? undefined : (input.assetType as AssetRef['type'] | undefined),
      // Same capability-driven widening as the sidebar picker (tool-inputs.ts):
      // an onFrame tool's image slot also offers the user's video uploads.
      motion: runtime.hasFrameHook === true,
      tags: input.filter?.tags as string[] | undefined,
      namespace: input.filter?.namespace as string | undefined,
      allowUpload: input.allowUpload === true,
      current: curVal?.id,
      currentToolUrl: curToolUrl,
      currentToolName: asStr(asRow(curVal?.meta as InputValue | undefined).name),
      editTool: (toolUrl: string, mode = 'insert') =>
        openEmbedEditor(host, { editUrl: toolUrl, slotLabel: input.label ?? input.id, mode }),
    } as Parameters<WebToolHost['assets']['pick']>[0]);
    if (ref) {
      runtime.setInput(input.id, ref);
      markUserDirty(input.id);
    }
  }

  function openInlineInputEditor(anchor: HTMLElement, input: InputModelItem): void {
    if (input.control === 'color-picker') openColorPopover(anchor, input);
    else if (input.control === 'select') openSelectPopover(anchor, input);
    else if (input.control === 'asset-picker') void openAssetPickerInline(input);
  }

  // Click-to-focus: clicking a rendered canvas element that represents an input
  // focuses the corresponding sidebar control. Tools can suppress this per-element
  // with pointer-events:none. The handler is added once; annotations are re-applied
  // via resolveCanvasAnnotations() after each innerHTML update.
  if (canvasEl)
    canvasEl.addEventListener('click', (e) => {
      if (hideSidebar || !inputsEl) return;
      const target = (e.target as HTMLElement).closest<HTMLElement>('[data-canvas-input]');
      if (!target) return;
      const id = target.dataset.canvasInput!;

      // A FRAMED image belongs to the framing overlay (plans/148): a tap there arms
      // pan/zoom/tilt. It usually also carries data-canvas-input for its asset slot
      // (annotateTemplate tags the tag's first referenced input, which is the src),
      // and that would open the asset picker on top of the arm - two editors from
      // one tap. The overlay wins on its own element; the sidebar row is still one
      // more tap away, and the picker stays reachable from there.
      if ((e.target as HTMLElement).closest('[data-framing]')) return;

      // A plain top-level input (never a "<blocksId>:<index>" block reference -
      // that never matches a top-level model item's id) whose control has an
      // in-place editor opens it right here instead of falling through to the
      // sidebar-focus path below.
      const inlineInput = runtime.getModel().find((i) => i.id === id);
      if (inlineInput && INLINE_EDIT_CONTROLS.has(inlineInput.control)) {
        openInlineInputEditor(target, inlineInput);
        return;
      }

      // Most ids map straight to a sidebar row. A "<blocksInputId>:<index>" id
      // (emitted per rendered block, e.g. data-canvas-input="blocks:0") points at
      // one block inside a blocks input - focus that block and fold the rest.
      let control = inputsEl.querySelector<HTMLElement>(`[data-input-id="${id}"]`);
      let blockIndex: string | null = null;
      const blockRef = !control && id.match(/^(.+):(\d+)$/);
      if (blockRef) {
        const blocksEl = inputsEl.querySelector<HTMLElement>(
          `.blocks-input[data-input-id="${blockRef[1]}"]`
        );
        if (blocksEl) {
          control = blocksEl;
          blockIndex = blockRef[2]!;
        }
      }
      if (!control) return;

      const focus = () => {
        // Reveal the control if it lives inside a collapsed section (mirrors the
        // scrollToInput path), so the focused input is actually visible.
        control!.closest('details.input-section')?.setAttribute('open', '');
        if (blockIndex != null) {
          focusSidebarBlock(control!, blockIndex);
        } else {
          control!.focus(); // lights the CSS :focus-within spotlight
          scrollToControl(control!); // header-aware, reduce-motion-safe, with arrival pulse
        }
      };
      if (layout.dataset.sidebar === 'closed') {
        setSidebarWidth(getRestoreWidth());
        requestAnimationFrame(focus);
      } else {
        focus();
      }
    });

  // Deferred-preview tools (manifest.render.preview): the live canvas is only a
  // placeholder until an explicit, expensive render runs - e.g. url-shot, which
  // screenshots a real page in beforeExport. The template supplies a [data-preview]
  // control; here we drive it (busy/error state) and run the render into the frame.
  // Wired by delegation on the canvas so it survives the innerHTML rebuild that the
  // runtime subscriber does on every input change.
  const previewCfg = tool.manifest.render.preview as
    | { auto?: boolean; format?: string }
    | undefined;
  // Drive a [data-preview] control through a capture. `btn` is the control the user
  // actually clicked (auto-preview passes none → the first control, the placeholder
  // button). Busy/error land on THAT control, and a PERSISTENT control (e.g. a
  // hover-revealed refresh button that outlives the placeholder) is reset to idle on
  // success - a placeholder button, which is hidden with the placeholder, doesn't
  // care. An icon-only control (data-icon-only) keeps its glyph; its state shows via
  // the is-busy / is-error classes (a CSS spinner / colour), never a text swap.
  async function runPreview(btn?: HTMLElement | null): Promise<void> {
    const target = btn ?? contentEl.querySelector<HTMLElement>('[data-preview]');
    const iconOnly = Boolean(target?.dataset.iconOnly);
    if (target) {
      if (target.dataset.busy) return; // re-entrancy guard
      target.dataset.busy = '1';
      target.dataset.idleLabel ??= (target.textContent ?? '').trim();
      target.classList.remove('is-error');
      target.classList.add('is-busy');
      if (!iconOnly) target.textContent = target.dataset.busyLabel || t('Rendering…');
    }
    try {
      await actionsApi!.preview!();
      // Success: a placeholder button is gone with the placeholder; a persistent
      // control survives and must be returned to its idle state so a later hover
      // shows the affordance, not a stuck spinner.
      if (target?.isConnected) {
        target.classList.remove('is-busy');
        if (!iconOnly && target.dataset.idleLabel) target.textContent = target.dataset.idleLabel;
        delete target.dataset.busy;
      }
    } catch (err) {
      // Surface the failure in place; the control stays so the user can retry.
      const b = target ?? contentEl.querySelector<HTMLElement>('[data-preview]');
      if (b) {
        b.classList.remove('is-busy');
        b.classList.add('is-error');
        if (!b.dataset.iconOnly)
          b.textContent =
            (err as { message?: string })?.message || t('Preview failed - tap to retry');
        delete b.dataset.busy;
      }
      throw err;
    }
  }
  if (previewCfg && canvasEl) {
    canvasEl.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-preview]');
      if (!b) return;
      runPreview(b).catch((err) => console.error('Preview failed:', err));
    });
  }

  // File-utility download: a template [data-export-file] button asks the tool's
  // exportFile hook to produce the transformed bytes (the file in → file out
  // shape - EXIF strip, redact, compress, …), then delivers them via
  // host.export.file (no watermark, no provenance - it's the user's own file).
  // Delegated on the persistent content container so it survives the innerHTML
  // rebuild the runtime subscriber does on every input change.
  if (runtime.hasExportFile && contentEl) {
    contentEl.addEventListener('click', async (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-export-file]');
      if (!btn || btn.dataset.busy) return;
      btn.dataset.busy = '1';
      btn.dataset.idleLabel ??= (btn.textContent ?? '').trim();
      btn.classList.remove('is-error');
      btn.classList.add('is-busy');
      btn.textContent = btn.dataset.busyLabel || t('Working…');
      try {
        let transformOpts: Record<string, unknown> = {};
        if (btn.hasAttribute('data-export-password')) {
          const { askExportLock } = await import('../lib/export-lock.ts');
          const lock = await askExportLock(t('this PDF'), true);
          if (!lock.ok) {
            btn.classList.remove('is-busy');
            btn.textContent = btn.dataset.idleLabel!;
            delete btn.dataset.busy;
            return;
          }
          if (!lock.strongPassword) throw new Error(t('Enter a password to lock this PDF.'));
          transformOpts = { password: lock.strongPassword };
        }
        const res = await runtime.exportFile(transformOpts);
        const items = Array.isArray(res) ? res : [res];
        if (items.length === 1) {
          const { bytes, mime, filename } = items[0]!;
          const blob = new Blob([bytes as BlobPart], { type: mime || 'application/octet-stream' });
          await host.export.file(blob, { filename: filename || 'file' });
        } else {
          // Batch (a `multiple` file input): fold every transformed file into ONE
          // zip so the browser delivers a single download (STORED for the already-
          // compressed media these tools emit). Names are disambiguated because
          // storeZip rejects collisions.
          const { storeZip } = await import('@lolly/engine');
          const used = new Map<string, number>();
          const entries = items.map((r, i) => {
            let name = r.filename || `file-${i + 1}`;
            const n = used.get(name) ?? 0;
            used.set(name, n + 1);
            if (n) {
              const dot = name.lastIndexOf('.');
              name =
                dot > 0 ? `${name.slice(0, dot)}-${n + 1}${name.slice(dot)}` : `${name}-${n + 1}`;
            }
            return {
              name,
              bytes: r.bytes instanceof Uint8Array ? r.bytes : new Uint8Array(r.bytes),
            };
          });
          const zip = storeZip(entries);
          await host.export.file(new Blob([zip as BlobPart], { type: 'application/zip' }), {
            filename: btn.dataset.exportArchive || 'transformed-files.zip',
          });
        }
        btn.classList.remove('is-busy');
        btn.textContent = btn.dataset.idleLabel!;
        delete btn.dataset.busy;
      } catch (err) {
        console.error('exportFile failed:', err);
        btn.classList.remove('is-busy');
        btn.classList.add('is-error');
        btn.textContent = (err as { message?: string })?.message || t('Export failed - try again');
        delete btn.dataset.busy;
      }
    });
  }

  // Scripts in template HTML don't execute when set via innerHTML (browser security).
  // Run them once on first render; subsequent renders update data but keep the
  // same script context alive.
  let pendingAutoExport = autoExport;
  let pendingAutoCopy = autoCopy;
  // Auto-generate a preview once the tool settles, so the user lands on a rendered
  // frame rather than the placeholder. Once only (never on every input change - a
  // deferred render must stay deliberate), and skipped when a ?export is already
  // queued so we don't capture the same page twice on load.
  let pendingAutoPreview = Boolean(previewCfg?.auto) && !autoExport;
  // The model the sidebar DOM was last built/synced against. syncInputs uses it to
  // skip the full panel rebuild on a keystroke when the edited field already shows
  // the new value (see syncInputs). Null until the first render.
  let prevInputsModel: InputModelItem[] | null = null;
  // Track the size-driving select's value so a change pushes the option's physical
  // dimensions to the export bar (see exportSizeDriver / actionsApi.setDims).
  let lastDimsSizeVal: InputValue | null | undefined = sizeDriver
    ? runtime.getModel().find((i) => i.id === sizeDriver.id)?.value
    : null;

  // Inline canvas error, shown when a template script throws mid-render. Lives on
  // the stage as a sibling of the canvas, so the per-render innerHTML rebuild
  // doesn't wipe it; cleared on the next successful render.
  function showCanvasError(): void {
    const stage = stageEl || contentEl?.parentElement;
    if (!stage || stage.querySelector(':scope > .canvas-error')) return;
    const box = document.createElement('div');
    box.className = 'canvas-error';
    box.setAttribute('role', 'alert');
    box.textContent = t("Couldn't render this preview - check your inputs.");
    stage.appendChild(box);
  }
  function clearCanvasError(): void {
    (stageEl || contentEl?.parentElement)?.querySelector(':scope > .canvas-error')?.remove();
  }

  let renderGen = 0;
  // Latest embed-hydration promise; exportUnscaled awaits it so an export reads
  // resolved blob URLs rather than the neutralised 1×1 placeholder.
  let embedsPending: Promise<unknown> = Promise.resolve();
  // Latest lottie-mount pass (same contract); the module is loaded lazily the
  // first time a paint emits a [data-lottie-src] marker and kept for reaping.
  let lottiePending: Promise<unknown> = Promise.resolve();
  let lottieModule: LottieModule | null = null;
  // Same contract for the video position-keeper (see video-mount.js): loaded the
  // first paint that emits a keyed <video>, awaited before export so a snapshot
  // reads a decoded frame rather than a blank one.
  let videoPending: Promise<unknown> = Promise.resolve();
  let videoModule: VideoModule | null = null;
  // Same contract for the animated-SVG enhancer (anim-svg-mount.js): loaded the first
  // paint that emits a [data-anim-src] marker, inlining a live, seekable <svg> so it
  // animates in the preview and exports frame-accurately (parallel to Lottie).
  let animSvgPending: Promise<unknown> = Promise.resolve();
  let animSvgModule: AnimSvgModule | null = null;
  // Same contract for the shaped-glyph enhancer (glyph-split-mount.ts, plans/175
  // WP-D): loaded the first paint that emits a letter-tier split box, awaited before
  // export so a still or the compositor's live shots read shaped glyphs, not the
  // half-replaced span tier.
  let glyphPending: Promise<unknown> = Promise.resolve();
  let glyphModule: typeof import('./glyph-split-mount.ts') | null = null;
  // Same contract again for the MilkDrop enhancer (lib/viz-tool-mount.js): the tool
  // renders a placeholder and the shell owns the WebGL canvas inside it, across paints.
  let vizPending: Promise<unknown> = Promise.resolve();
  let vizModule: VizModule | null = null;

  // On-canvas table-cell editing for paginated tools (render.paginate): cells the
  // template stamped data-cell / data-cell-pick become editable / pickable, and
  // every edit bakes straight back to the source table input - the same setInput
  // path a sidebar keystroke rides. Re-wired each paint (the innerHTML swap
  // discards listeners, like every other canvas enhancer).
  const paginateSource = tool.manifest.render.paginate?.source;
  const tableEditOpts: TableEditOpts | null = paginateSource
    ? {
        getTable: () =>
          normalizeTableValue(runtime.getModel().find((i) => i.id === paginateSource)?.value) ?? {
            columns: [],
            rows: [],
          },
        commit: (next) => {
          void runtime.setInput(paginateSource, next);
        },
        pickImage: async (tag) => {
          const ref = await host.assets.pick({
            tags: tag ? [tag] : undefined,
            title: t('Pick an image'),
          });
          if (!ref?.url) return null;
          // A user-upload's blob: URL dies with the session - inline small ones as
          // data: so the markdown ref remains across reloads and the table's Copy button.
          const url = await markdownSafeUrl(ref.url);
          const meta = ref.meta as { name?: unknown } | undefined;
          return { url, alt: typeof meta?.name === 'string' ? meta.name : ref.id };
        },
        pickLabel: t('Pick an image'),
      }
    : null;

  // The RENDER half of the subscriber is coalesced behind requestAnimationFrame:
  // a full canvas rebuild swaps innerHTML, re-walks annotations, and re-executes
  // every template <script> (chart/QR/map libs re-instantiate), so doing it per
  // keystroke is wasteful. We stash the latest emit and paint at most once per
  // frame - the sidebar sync (below) stays synchronous so typed values echo with
  // no lag. The trailing emit is always the one we paint, so the final keystroke
  // never gets dropped; flushRender() forces it out synchronously before exports.
  let rafId = 0;
  let pendingFrame: { model: InputModelItem[]; hydrated: string } | null = null; // latest { model, hydrated } awaiting paint
  let lastPainted: string | null = null; // hydrated source of the last CLEAN paint - skip an identical canvas rebuild
  let lastPaintedBoxes: Box[] | null = null; // baseline for the geometry fast-skip diff (plans/98 section 9)

  function paint(): void {
    rafId = 0;
    if (!pendingFrame) return;
    const { model, hydrated } = pendingFrame;
    pendingFrame = null;
    // Skip the expensive canvas rebuild when the hydrated output is byte-identical to
    // the last clean paint. refresh() and the coalesced double-emit re-emit unchanged
    // HTML, and a live camera/audio frame often traces to the same output - a full
    // innerHTML swap + <script> re-exec (chart/QR/map libs re-instantiate, resolved
    // embeds get wiped and re-fetched) per frame is pure waste. The MODEL can still
    // have moved on an input that doesn't touch the template (e.g. an export-dimension
    // select), so URL sync / size-driver / auto-export below always run. lastPainted
    // is recorded only after a CLEAN paint, so a throwing render retries next emit.
    // ── Geometry fast-skip (plans/98 section 9, opt-in) ────────────────────────────────
    // A proven pure-translation move whose DOM free-canvas already positioned (applyLiveRect
    // during the drag) needs no rebuild - export parity holds via COMPUTED style (the export
    // walker reads getComputedStyle, so raw-attribute formatting is irrelevant). paint()
    // derives the damage itself from consecutive box models (no hint channel), and VERIFIES
    // each moved node is already at committed geometry before skipping; anything unproven
    // (resize/rotate, cross-box, or a non-drag commit that didn't pre-position the DOM) falls
    // through to the full paint below.
    // lastPaintedBoxes advances ONLY after a clean skip or clean full paint (mirroring
    // lastPainted), NEVER unconditionally - so a throwing full paint leaves the baseline at
    // the last cleanly-painted boxes and a later move still diffs against it (catching the
    // un-healed change and forcing a full repaint), preserving the throwing-render self-heal.
    const prevBoxes = lastPaintedBoxes;
    const curBoxes: Box[] | null =
      fastCfgPaint && canvasEditInput
        ? ((model.find((i) => i.id === canvasEditInput.id)?.value as Box[] | undefined) ?? null)
        : null;
    let geomSkipped = false;
    if (fastCfgPaint && prevBoxes && curBoxes) {
      const plan = geometryFastPathPlan(prevBoxes, curBoxes, {
        ...fastCfgPaint,
        connectorEndpointIds: boundEndpointIds(curBoxes, {
          idField: fastCfgPaint.field.idField,
          bindStartField: fastCfgPaint.bindStartField,
          bindEndField: fastCfgPaint.bindEndField,
          kindField: fastCfgPaint.kindField,
        }),
      });
      const esc = (id: string): string =>
        typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id;
      if (
        plan?.every((pt) => {
          // A frame patch targets the artboard PAGE element - its inline left/top are
          // global, exactly what the live drag wrote (plans/141 WP-A item 6). Members
          // that rode the frame have no patch: their frame-local style is unchanged.
          const el = contentEl.querySelector(
            pt.frame
              ? '.lolly-frame-page[data-frame-id="' + esc(pt.id) + '"]'
              : '.lolly-box[data-box-id="' + esc(pt.id) + '"]'
          ) as HTMLElement | null;
          return !!el && parseFloat(el.style.left) === pt.x && parseFloat(el.style.top) === pt.y;
        })
      ) {
        lastPainted = hydrated;
        lastPaintedBoxes = curBoxes;
        geomSkipped = true;
        if (typeof window !== 'undefined') {
          const w = window as unknown as { __lollyGeomFastPath?: { skips: number; fulls: number } };
          (w.__lollyGeomFastPath ??= { skips: 0, fulls: 0 }).skips++;
        }
      }
    }

    let contentPainted = geomSkipped;
    if (!geomSkipped && hydrated !== lastPainted) {
      const gen = ++renderGen;
      // Paged docs scroll the whole document in the canvas surface; a full innerHTML
      // rebuild would otherwise snap the view back to the cover on every keystroke.
      // Capture the surface's scroll offset and restore it after the swap.
      const prevScrollTop = pagedDoc && outerEl ? outerEl.scrollTop : 0;
      try {
        // Neutralise any lolly.tools embed URLs BEFORE insertion so the editor never
        // fires a network request for them; they're resolved to local composed
        // renders (blob URLs) just after the template's own scripts run. The
        // generation guard stops a slow embed render from overwriting a newer one.
        contentEl.innerHTML = neutralizeEmbeds(hydrated);
        // A <style> inside template.html would otherwise apply unscoped and unlayered,
        // beating every app layer - one tool's `*` reset strips the chrome's padding.
        scopeTemplateStyles(contentEl, canvasScope);
        if (!hideSidebar) resolveCanvasAnnotations(contentEl);
        // Keep the canvas's accessible summary current when it's a live a11yLabel.
        if (tool.manifest.a11yLabel) contentEl.setAttribute('aria-label', canvasLabel());
        runTemplateScripts(contentEl);
        // Populate any [data-shell-slot] hooks the freshly-painted template exposes
        // (the app theme toggle, the relocated export pill) - see mountToolbarSlots.
        mountToolbarSlots();
        if (tableEditOpts) mountTableCellEditing(contentEl, tableEditOpts);
        embedsPending = hydrateEmbeds(contentEl, { host, isCurrent: () => gen === renderGen });
        // Lottie markers are mounted by the shell, not the template (tools stay
        // data-only). Once the module has loaded, run the pass even on marker-less
        // paints so players orphaned by the innerHTML swap get reaped.
        if (lottieModule || contentEl.querySelector('[data-lottie-src]')) {
          lottiePending = (
            lottieModule
              ? Promise.resolve(lottieModule)
              : import('./lottie-mount.ts').then((m) => (lottieModule = m))
          )
            .then((m) => m.mountLottiePlayers(contentEl, { isCurrent: () => gen === renderGen }))
            .catch((err) => console.warn('lottie mount failed:', err));
        }
        // Split text's glyph tier (plans/175 WP-D): shape each letter-tier word through
        // host.text and replace its letter spans with per-cluster glyph groups, so the
        // animation keeps kerning, ligatures and Arabic joining. Progressive - a box
        // whose font resolves to no file keeps the span tier.
        if (
          contentEl.querySelector(
            '.lolly-box[data-t-split="letter"] .lly-w, .lolly-box[data-t-split-want="letter"] .lly-u'
          )
        ) {
          glyphPending = (
            glyphModule
              ? Promise.resolve(glyphModule)
              : import('./glyph-split-mount.ts').then((m) => (glyphModule = m))
          )
            .then((m) =>
              m.mountGlyphSplits(contentEl, {
                isCurrent: () => gen === renderGen,
                textApi: host.text,
              })
            )
            .catch((err) => console.warn('glyph split mount failed:', err));
        }
        // Animated-SVG markers, mounted by the shell like Lottie: inline a live,
        // seekable <svg> so a catalog or uploaded animation actually plays in the
        // preview (and can be sampled/exported frame-accurately).
        if (contentEl.querySelector('[data-anim-src]')) {
          animSvgPending = (
            animSvgModule
              ? Promise.resolve(animSvgModule)
              : import('./anim-svg-mount.ts').then((m) => (animSvgModule = m))
          )
            .then((m) => m.mountAnimSvgPlayers(contentEl, { isCurrent: () => gen === renderGen }))
            .catch((err) => console.warn('anim-svg mount failed:', err));
        }
        // Video position-keeper: restore each placed clip to where it was before this
        // rebuild (so it doesn't restart at 0), and settle once frames have decoded so
        // an export reads a real frame. Only paints with a keyed <video> load it.
        if (videoModule || contentEl.querySelector('video[data-video-key]')) {
          videoPending = (
            videoModule
              ? Promise.resolve(videoModule)
              : import('./video-mount.ts').then((m) => (videoModule = m))
          )
            .then((m) => m.mountVideoPlayers(contentEl, { isCurrent: () => gen === renderGen }))
            .catch((err) => console.warn('video mount failed:', err));
        }
        // MilkDrop placeholders. Run the pass on marker-less paints too once the module
        // is loaded, so switching the style away gives the WebGL context back instead of
        // leaving it parked on a canvas nothing is drawing into.
        if (vizModule || contentEl.querySelector('[data-lolly-viz]')) {
          vizPending = (
            vizModule
              ? Promise.resolve(vizModule)
              : import('../lib/viz-tool-mount.ts').then((m) => (vizModule = m))
          )
            .then((m) => m.mountToolViz(contentEl, { isCurrent: () => gen === renderGen }))
            .catch((err) => console.warn('viz mount failed:', err));
        }
        clearCanvasError();
        lastPainted = hydrated;
        contentPainted = true;
        if (curBoxes) lastPaintedBoxes = curBoxes; // clean full paint refreshes the baseline (throw-safe: after the render body)
        if (fastPathOn && typeof window !== 'undefined') {
          const w = window as unknown as { __lollyGeomFastPath?: { skips: number; fulls: number } };
          (w.__lollyGeomFastPath ??= { skips: 0, fulls: 0 }).fulls++;
        }
        // Keep the reader where they were scrolled to (paged docs only).
        if (pagedDoc && outerEl && prevScrollTop) outerEl.scrollTop = prevScrollTop;
        // Slide-sorter filmstrip: mount on the first paged paint, refresh thereafter.
        if (pagedDoc && outerEl && canvasEl) {
          if (!filmstrip) filmstrip = mountFilmstrip(outerEl, canvasEl, inputsEl, filmstripSide);
          else filmstrip.refresh();
        }
      } catch (err) {
        // A throwing template script (charts, QR, fetch-backed tools run in page
        // context - unlike the sandboxed hooks) would otherwise leave a stale or
        // half-built canvas with no signal. Surface it; the sidebar stays editable.
        console.error('Render failed:', err);
        showCanvasError();
      }
    }

    // Mounted Design health must never inspect the previous DOM against a newer
    // boxes model. The inspector invalidates on the synchronous model echo and only
    // resumes its layout/contrast/font checks after this clean-paint signal.
    if (contentPainted) canvasEl?.dispatchEvent(new CustomEvent('lolly-canvas-painted'));

    // The canvas just moved (or was rebuilt outright, taking every annotated node
    // with it) and the sidebar was re-synced a moment ago - so any remote focus ring
    // and cursor is anchored to geometry that no longer exists. Null unless a collab
    // is live, which makes this one nullable read per painted frame (section 11.14).
    collabReanchor?.();

    syncUrl();

    // When a size-driving select changes, set the export dimensions to the chosen
    // option - so picking "A6 landscape" actually exports an A6-landscape page.
    if (sizeDriver) {
      const v = model.find((i) => i.id === sizeDriver.id)?.value;
      if (v !== lastDimsSizeVal) {
        lastDimsSizeVal = v;
        const d = sizeDriver.dims[String(v)];
        // An option with no dims returns the export size to the tool's own
        // render box - otherwise "month then back to the card" kept exporting
        // the card at A4 landscape (calendar-ics, the one partially
        // dimensioned size select; E13 review).
        if (d) actionsApi?.setDims?.(d);
        else
          actionsApi?.setDims?.({
            width: tool.manifest.render.width,
            height: tool.manifest.render.height,
            unit: 'px',
          });
      }
    }

    // When a format-driving select changes (e.g. the filter effect), narrow the
    // export format bar to that option's formats. Runs on the initial emit too, so
    // the bar opens already scoped to the starting effect.
    if (formatDriver) {
      const v = model.find((i) => i.id === formatDriver.id)?.value;
      if (v !== lastFmtDriveVal) {
        lastFmtDriveVal = v;
        const f = formatDriver.formats[String(v)];
        if (f) actionsApi?.setFormats?.(f);
      }
    }

    if (pendingAutoExport) {
      pendingAutoExport = false;
      const fmt = urlFormat || tool.manifest.render.formats[0]!;
      // Brand vars land async (tokens fetch) - await them alongside quiescence so
      // a deep-link export captures the branded canvas, not the fallbacks. The live
      // palette (for CMYK ink substitution) is the same tokens fetch, so it rides
      // along rather than adding its own wait.
      Promise.all([waitForQuiescence(contentEl), brandVarsReady, livePalette(host)]).then(
        ([, , palette]) => {
          const name = urlFilename || tool.manifest.id;
          // Honour ?unit=/?dpi= so a deep link (or CLI) renders the right physical size.
          const u = urlUnit || 'px';
          const dim = (v: number | null, native: number): string | number =>
            (v ?? 0) > 0 ? (u !== 'px' ? `${v}${u}` : v!) : native;
          const expOpts: RunExportOpts = {
            width: dim(urlWidth, nativeW),
            height: dim(urlHeight, nativeH),
          };
          if (u !== 'px') expOpts.dpi = urlDpi || 300;
          // CMYK print formats: carry the chosen press condition (recorded in the
          // PDF's output intent / the TIFF's metadata). The Print PDF also carries the
          // brand palette for exact ink matches; the TIFF does a flat per-pixel pass.
          if (isCmykFmt(fmt)) {
            expOpts.colorProfile = urlProfile || DEFAULT_CMYK_CONDITION;
            if (fmt === 'pdf-cmyk') expOpts.palette = palette;
          }
          // HTML: honour ?nostage so a deep link auto-exports the full-page document
          // (no fixed-size canvas frame) - mirrors the panel's "Full page" toggle.
          if (fmt === 'html' && urlNostage) expOpts.fullPage = true;
          // Standard lock: honour ?password= so a deep link can auto-export a locked
          // PDF or ZIP bundle (basic lock; clear-text in the URL by design - see pdfPassRow).
          if ((fmt === 'pdf' || fmt === 'zip') && urlPassword) expOpts.password = urlPassword;
          // Content Credentials: ?c2pa= wins (on/off + ephemeral-cert lifetime,
          // e.g. c2pa=90 or c2pa=off - see url-mode.js); absent it falls back to
          // a render.c2pa tool's popup default. Never stamped alongside a
          // password (the same exclusion the popup enforces; the bridge would
          // skip it anyway).
          const wantC2pa = urlC2pa ? urlC2pa.on : c2paDefaultOn(tool.manifest);
          if (wantC2pa && C2PA_FORMATS.includes(fmt) && !expOpts.password) {
            expOpts.c2pa = true;
            if (urlC2pa?.days) expOpts.c2paDays = urlC2pa.days;
          }
          // Pixel watermark (?imprint=): on by default for imprint-capable formats,
          // like C2PA - independent of the C2PA credential itself. Covers still rasters
          // AND the container formats (pdf/pdf-cmyk/pptx), whose Lolly-rendered rasters
          // are imprinted as they're composited in (a pure-vector page marks nothing).
          // Only an explicit `imprint=0`/`off` link suppresses it (see url-mode.ts
          // parseImprint; list mirrors tool-actions.ts's isImprintFmt).
          if (
            urlImprint !== false &&
            [
              'png',
              'jpg',
              'jpeg',
              'webp',
              'avif',
              'tiff',
              'bmp',
              'pdf',
              'pdf-cmyk',
              'pptx',
            ].includes(fmt)
          )
            expOpts.imprint = true;
          // Opt-in durable Content Credential (?durable=1): a neural TrustMark mark
          // carrying Lolly's id. Raster-only (no container rasters yet) and a no-op
          // until the encoder model is on-device. See plans/28-durable-content-credentials.md.
          if (urlDurable && ['png', 'jpg', 'jpeg', 'webp', 'avif', 'tiff'].includes(fmt))
            expOpts.durable = true;
          // Opt-in HDR (?hdr=1): Rec.2100 PQ export with brand-colour glow. Raster
          // (PNG/JPEG/AVIF/TIFF - WebP excluded, no working HDR decode) plus the 10-bit
          // video containers (mp4/webm, plan 154 WP-2). urlHdr is null for ?hdr=0, so
          // ?hdr=0 forces SDR and ?hdr=1 forces HDR (tri-state via parseHdr). See engine/src/hdr.ts.
          if (urlHdr && ['png', 'jpg', 'jpeg', 'avif', 'tiff', 'mp4', 'webm'].includes(fmt)) {
            expOpts.hdr = true;
            expOpts.hdrPeakNits = urlHdr.peakNits;
            expOpts.hdrReach = urlHdr.reach;
            expOpts.hdrLift = urlHdr.lift;
            expOpts.hdrRichness = urlHdr.richness;
          }
          // Requested bit depth (?depth=): passed through as-is for every format -
          // 'auto' is the default and carries nothing. NO consumer logic here: the
          // export bridge decides what the provenance chain can honestly carry.
          if (urlDepth !== 'auto') expOpts.depth = urlDepth;
          // Video controls (?fps= ?seconds= ?wait= ?codec= ?vq=): the URL form of the export
          // panel's fields, so `?export=mp4&fps=60&seconds=6` renders the clip the panel
          // would - and the CLI, which is this path under another transport, gets the same
          // knobs. `seconds` is a deliberate length (durationUserSet), so a tool hook that
          // lengthens a clip to its material (the audiogram's analysed bed) stands down.
          if (
            ['mp4', 'webm', 'gif', 'apng', 'webp-anim'].includes(fmt) &&
            hasVideoParams(urlVideo)
          ) {
            if (urlVideo.fps != null) expOpts.fps = urlVideo.fps;
            if (urlVideo.seconds != null) {
              expOpts.duration = urlVideo.seconds;
              expOpts.durationUserSet = true;
            }
            if (urlVideo.wait != null) expOpts.wait = urlVideo.wait;
            if (urlVideo.codec) expOpts.videoCodec = VIDEO_CODEC_STRINGS[urlVideo.codec];
            if (urlVideo.quality) expOpts.videoQuality = urlVideo.quality;
          }
          // Print prep: honour ?bleed= / ?marks= so a deep link auto-exports a
          // print-ready file. Applied only when the link asks for it (never default).
          if (isPrintFmt(fmt) && (urlBleed || urlMarks)) {
            if (urlBleed) expOpts.bleed = urlBleed;
            if (urlMarks) {
              expOpts.cropMarks = urlMarks.crop;
              expOpts.registrationMarks = urlMarks.registration;
              expOpts.bleedMarks = urlMarks.bleed;
              expOpts.colorBars = urlMarks.colorBars;
              expOpts.provenance = urlMarks.provenance;
            }
          }
          exportUnscaled(() =>
            runtime
              .export(exportTargetNode(exportSourceNode), fmt, expOpts)
              .then((blob) => host.export.download(blob, `${name}.${extFor(fmt, blob)}`))
              .catch((err) => console.error('Auto-export failed:', err))
          );
        }
      );
    }

    if (pendingAutoCopy) {
      pendingAutoCopy = false;
      Promise.all([waitForQuiescence(contentEl), brandVarsReady]).then(() =>
        armAutoCopy(actionsEl, actionsApi, urlFormat || undefined)
      );
    }

    if (pendingAutoPreview) {
      pendingAutoPreview = false;
      Promise.all([waitForQuiescence(contentEl), brandVarsReady]).then(() =>
        runPreview().catch((err) => console.error('Auto-preview failed:', err))
      );
    }
  }

  // Paint any queued frame right now (cancelling the scheduled rAF). Used by
  // exportUnscaled so a capture reads the latest keystroke, and harmless if no
  // frame is pending.
  function flushRender(): void {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
      paint();
    }
  }

  // Live frame sources (engine v1.4 camera / v1.113 animated asset): ONE
  // controller (live-controls.ts) owns "Go live" + "Play" and every button
  // placement. SIDEBAR placement is primary - the buttons ride the source asset
  // input's slot-actions row, re-injected by renderInputs on every panel rebuild
  // (mountSidebarLiveControls) - and the floating canvas toggles remain only when
  // there is no sidebar row to ride (canvas layout / no asset input). Picking an
  // animated asset (CSS/SMIL SVG, GIF/APNG via ImageDecoder, video) auto-plays it
  // through the tool's onFrame - the same frame path and drop-overlap throttle as
  // the camera - with `source:'asset'` so provenance never claims a camera
  // capture; pausing freezes the current frame so stills/exports keep working.
  // The sample animation (render.liveDefault) stays manual-start only.
  // Created BEFORE runtime.subscribe so the callback below can never hit the
  // binding in its temporal dead zone.
  const liveControls = createLiveControls({
    runtime,
    host,
    t,
    announce,
    onStart: () => startFrameFps(runtime.manifest.id), // dev-only fps meter (gated)
    onStop: stopFrameFps,
  });
  if (liveControls.enabled) registerLiveControls(runtime, liveControls);

  runtime.subscribe(({ model, hydrated }) => {
    fpsTick(); // dev-only onFrame fps meter (no-op unless lolly.frameFps='1' + live)
    // Sidebar sync is cheap and must stay responsive, so it runs synchronously on
    // every emit; only the expensive canvas rebuild is deferred to the next frame.
    if (inputsEl && !_sliderDragging) {
      prevInputsModel = syncInputs(inputsEl, model, prevInputsModel, runtime, host, markUserDirty);
    }
    // Reflect a source swap in the live controls (auto-play a fresh animated pick,
    // stop playback whose source was swapped away). Cheap: no-op unless the source
    // asset input's value identity changed.
    if (liveControls.enabled) liveControls.syncFromModel(model);
    pendingFrame = { model, hydrated };
    if (!rafId) rafId = requestAnimationFrame(paint);
    // Carousel: a change to the page count / page size reshapes the editing strip.
    // syncStrip no-ops unless the strip dimensions actually changed, so ordinary box
    // edits don't reset the view.
    if (pagesMode) syncStrip();
  });

  if (liveControls.enabled) {
    // Classify the initial source (shows Play for a restored animated pick or the
    // sample; never auto-plays on open).
    liveControls.syncFromModel(runtime.getModel());
    // Put the camera control in the INPUTS BAR wherever there is one (with an
    // asset input it rides that slot's row; without one - a reader like scan-code -
    // it pins a standalone row at the top). This keeps "Use camera" reachable on
    // mobile, where the floating canvas toggle is not. The canvas-stage fallback is
    // only for a genuine canvas layout that hides the inputs panel entirely.
    if (inputsEl && !canvasLayout) mountSidebarLiveControls(inputsEl, runtime);
    else if (stageEl) liveControls.mountStage(stageEl);
  }

  // Authenticated capture (desktop only): a tool declaring the `capture` capability
  // gets a "Sign in to a site" panel so a login/session set up once is ridden by every
  // later screenshot. Self-gating - no-op on the web PWA and for non-capture tools -
  // and mounted as a sidebar sibling so input rebuilds never drop it.
  if (inputsEl && !canvasLayout) mountCaptureSignin({ inputsEl, runtime, t, announce });

  // Device recording (engine v1.17): a tool declaring render.capture gets a Record
  // affordance where this shell exposes host.recorder. Audio tools also surface a live
  // level meter + coaching through their onLevel hook (the runtime drives it); video
  // tools get a host.media framing viewfinder, then the clip feeds the top-&-tail
  // compositor. The runtime owns startMeter/startRecording/stopRecording; here we only
  // drive the UI and route the finished blob.
  const captureMode = (
    runtime.manifest.render as { capture?: 'audio' | 'video' | 'av' | 'screen' } | undefined
  )?.capture;
  if (stageEl && captureMode === 'screen') {
    // Display capture (v1.54) has its own control: the browser's picker replaces the
    // viewfinder + framing + level coaching a camera take needs, so none of that applies.
    // isAvailable('screen') feature-detects getDisplayMedia - where it's absent (an
    // insecure context, an older browser) the tool still mounts and keeps its upload
    // path, rather than showing a Screenshot button that can only fail.
    if (host.recorder?.isAvailable?.('screen')) {
      const { setupScreenCaptureControl } = await import('./screen-capture-control.ts');
      setupScreenCaptureControl({
        stageEl,
        runtime,
        host,
        markSessionDirty,
        canvasEl,
        actionsApi,
        sizeExplicit: Boolean(urlWidth || urlHeight),
      });
    }
  } else if (
    stageEl &&
    captureMode &&
    captureMode !== 'screen' &&
    host.recorder?.isAvailable?.(captureMode === 'audio' ? 'audio' : 'video')
  ) {
    setupRecordControl({ stageEl, runtime, host, mode: captureMode, markSessionDirty });
  }

  // Image framing (plans/148): wherever a tool declares a framing control
  // (`framingFor` on a vector input, or on a blocks asset sub-field), the shell
  // mounts ONE generic on-canvas overlay - pan, zoom, roll, and the perspective
  // pair - plus "Use as a new image", which bakes the framing into a new library
  // asset through the same signed path the catalog crop uses. Declaration-driven:
  // no tool is named here, and a tool with no framing input mounts nothing.
  if (stageEl && canvasEl && !visitorPage) {
    const { hasFramingInputs, setupFramingOverlay } = await import('./framing-overlay.ts');
    if (hasFramingInputs(runtime.getModel())) {
      framingTeardown = setupFramingOverlay({
        stageEl,
        canvasEl,
        runtime,
        onDirty: markUserDirty,
        onBake: (key) => bakeFraming(key),
      });
    }
  }

  // Animation transport (play/pause/scrub): any tool declaring render.video gets a
  // reusable transport bar driven entirely by the tool's window.__lollyAnim clock - it
  // shows itself only while an animation is actually active. Lazy-loaded to stay off the
  // boot critical path; torn down via stageEl._animCleanup in _cleanup above.
  if (stageEl && (runtime.manifest.render as { video?: unknown } | undefined)?.video) {
    const { setupAnimTransport } = await import('./anim-transport.ts');
    (stageEl as HTMLElement & { _animCleanup?: () => void })._animCleanup = setupAnimTransport({
      stageEl,
    });
  }

  // File-input tools: the whole canvas accepts a dropped file - drag-and-drop, or
  // click-to-pick via an explicit [data-file-pick] affordance. In canvas layout the
  // canvas IS the file control; in sidebar layout it complements the sidebar
  // file-picker. The picked file still flows through the normal input model +
  // exportFile hook, so CLI/URL mode are unaffected.
  if (canvasFileInput && contentEl) {
    mountLifecycle.add(
      'canvas file drop',
      setupCanvasFileDrop({
        viewEl,
        contentEl,
        runtime,
        input: canvasFileInput,
        onDirty: markUserDirty,
        fileToRef,
        formatBytes: fmtBytes,
      })
    );
  }
  if (canvasDropInput && contentEl) {
    mountLifecycle.add(
      'canvas blocks drop',
      setupCanvasBlocksDrop({
        viewEl,
        contentEl,
        runtime,
        host,
        input: canvasDropInput,
        onDirty: markUserDirty,
        makeDropper: makeBlocksDropper,
      })
    );
  }

  // Canvas tools can also expose interactive SETTINGS in the template (e.g. a
  // compression level) as ordinary declared inputs. The sidebar - which normally
  // binds inputs to the model - is hidden in canvas layout, so wire any in-canvas
  // control carrying [data-input-id] straight back to runtime.setInput. The values
  // are declared inputs, so URL/CLI parity is automatic (syncUrl writes the dirty
  // param). Bind 'change' (not 'input') so the per-render innerHTML rebuild doesn't
  // fight focus mid-interaction; the template reflects each value so a repaint keeps it.
  if (canvasLayout && contentEl) {
    // Canvas-layout tools have no sidebar, so an asset input must be reachable
    // from the rendered tool itself. A template opts in with
    // data-input-action="pick" + data-input-id="…". Optional declarative
    // follow-ups let a picker switch modes or clear stale hand-drawn data after
    // a successful choice without hard-coding any particular tool here.
    contentEl.addEventListener('click', (e) => {
      const ctl = (e.target as HTMLElement).closest<HTMLElement>(
        '[data-input-action="pick"][data-input-id]'
      );
      if (!ctl) return;
      const id = ctl.dataset.inputId;
      const input = id ? runtime.getModel().find((item) => item.id === id) : undefined;
      if (input?.control !== 'asset-picker') return;
      e.preventDefault();
      void (async () => {
        const before = input.value;
        await openAssetPickerInline(input);
        const picked = runtime.getModel().find((item) => item.id === id)?.value;
        if (!picked || picked === before) return;
        const clearId = ctl.dataset.clearInput;
        if (clearId) {
          runtime.setInput(clearId, '');
          markUserDirty(clearId);
        }
        const activateId = ctl.dataset.activateInput;
        if (activateId) {
          runtime.setInput(activateId, ctl.dataset.activateValue ?? true);
          markUserDirty(activateId);
        }
      })();
    });

    contentEl.addEventListener('change', (e) => {
      const ctl = (e.target as HTMLElement).closest<HTMLInputElement>('[data-input-id]');
      if (!ctl) return;
      const id = ctl.dataset.inputId;
      if (!id) return;
      const value =
        ctl.type === 'checkbox'
          ? ctl.checked
          : ctl.type === 'number'
            ? Number(ctl.value)
            : ctl.value;
      runtime.setInput(id, value);
      markUserDirty(id);
    });
  }

  const clearBtn = viewEl.querySelector<HTMLButtonElement>('#clear-inputs-btn');
  const utils = viewEl.querySelector<HTMLElement>('#sidebar-utils');
  if (clearBtn && utils) {
    const resetToDefaults = async () => {
      dirtyParams.clear();
      markSessionDirty(); // clearing is an edit - flag unsaved + flash the Save pill
      for (const input of runtime.getModel()) {
        // Revoke a picked file's preview URL before clearing it (avoid a leak).
        const prevUrl = asRow(input.value).url;
        if (input.type === 'file' && prevUrl) URL.revokeObjectURL(prevUrl as string);
        // Reset to the tool's DECLARED default - a real "reset to defaults", so a
        // boolean default:true, default `blocks` rows, a default select/colour/asset
        // all come back. Only fall back to a type-appropriate empty when there is no
        // declared default (files never have one). Previously every non-scalar was
        // forced blank regardless of its default.
        const dflt = input.default as InputValue | undefined;
        const value: InputValue =
          dflt !== undefined && dflt !== null
            ? dflt
            : input.type === 'boolean'
              ? false
              : input.type === 'asset'
                ? null
                : input.type === 'file'
                  ? null
                  : input.type === 'blocks'
                    ? []
                    : '';
        await runtime.setInput(input.id, value);
      }
    };
    // Two-step confirm INLINE + full-width in the sidebar (no centred modal). The
    // #sidebar-utils grid is one column, so the confirm/cancel buttons each span the
    // full width; swapping the button's own container in place moves nothing else.
    // The armed confirm is destructive AND persists (its #sidebar-utils host isn't
    // re-rendered by edits), so it must be dismissible passively - Escape, an outside
    // click, or a timeout - mirroring the block-remove two-step confirm's disarm.
    let disarmTimer: ReturnType<typeof setTimeout> | undefined;
    const restore = (): void => {
      utils.classList.remove('is-confirming');
      document.removeEventListener('pointerdown', onOutside, true);
      document.removeEventListener('keydown', onKey, true);
      if (disarmTimer) clearTimeout(disarmTimer);
      utils.replaceChildren(clearBtn);
    };
    const onOutside = (e: PointerEvent) => {
      if (!utils.contains(e.target as Node | null)) restore();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        restore();
      }
    };
    clearBtn.addEventListener('click', () => {
      utils.classList.add('is-confirming');
      utils.innerHTML =
        `<button type="button" class="clear-inputs-confirm">${t('Reset to defaults')}</button>` +
        `<button type="button" class="clear-inputs-cancel">${t('Cancel')}</button>`;
      utils.querySelector('.clear-inputs-confirm')!.addEventListener('click', async () => {
        restore();
        await resetToDefaults();
      });
      utils.querySelector('.clear-inputs-cancel')!.addEventListener('click', restore);
      (utils.querySelector('.clear-inputs-cancel') as HTMLElement | null)?.focus();
      setTimeout(() => document.addEventListener('pointerdown', onOutside, true), 0); // skip the arming click
      document.addEventListener('keydown', onKey, true);
      disarmTimer = setTimeout(restore, 6000);
    });
  }
}

// True only when focus is in a genuinely text-editable field (so Cmd+Z falls
// through to the browser's per-character undo). Deliberately NARROWER than
// isTyping: a focused range slider / colour / checkbox / number IS an <input>
// but has no native undo, so our input-history undo should still fire there.
// Shadow-aware, so a jelly field (real <input> inside a shadow root) is recognised.
const isTextEditing = (): boolean => isTextEditingTarget();

function makeFetchFile(toolId: string): (path: string) => Promise<string> {
  return async (path: string) => {
    const resp = await instanceFetch(instancePath(`/tools/${path}`));
    if (resp.status === 404) throw new Error('tool-not-found');
    // SPA servers return index.html for unknown paths with a 200. Detect that.
    const ct = resp.headers.get('content-type') ?? '';
    // SPA fallback check - but skip for .html files since template.html legitimately returns text/html.
    if (!resp.ok || (ct.includes('text/html') && !path.endsWith('.html')))
      throw new Error('tool-not-found');
    return await resp.text();
  };
}

function mount404(viewEl: HTMLElement, toolId: string): void {
  document.title = t('Not Found - Lolly');
  viewEl.innerHTML = `
    <div class="not-found">
      <div class="not-found-inner">
        <p class="not-found-code">404</p>
        <h1 class="not-found-title">${t('Tool not found')}</h1>
        <p class="not-found-desc">${t("There's no tool at <code>{id}</code>.", { id: toolId })}</p>
        <a href="/" class="not-found-home">${t('Browse all tools')}</a>
      </div>
    </div>
  `;
}

// Shown when a tool is opened in a shell that can't fulfil its capabilities
// (e.g. a 'capture' tool in the web PWA). Mirrors the 404 layout.
function mountUnavailable(
  viewEl: HTMLElement,
  manifest: ToolManifest,
  unmet: readonly string[]
): void {
  document.title = tRaw('{name} - Desktop only', { name: manifest.name });
  const why = unmet.map(capabilityLabel).join(', ');
  viewEl.innerHTML = `
    <div class="not-found">
      <div class="not-found-inner">
        <p class="not-found-code">${t('Desktop')}</p>
        <h1 class="not-found-title">${t('{name} needs the desktop app', { name: manifest.name })}</h1>
        <p class="not-found-desc">${t('This tool uses <strong>{why}</strong>, which the web app can’t provide - a browser can’t screenshot cross-origin pages. Open it in the Lolly desktop app.', { why })}</p>
        <a href="/" class="not-found-home">${t('Browse all tools')}</a>
      </div>
    </div>
  `;
}

// Shown on a Chromium browser for a capture tool when the extension isn't
// installed - the tool CAN run here once the free extension is added.
function mountInstallPrompt(viewEl: HTMLElement, manifest: ToolManifest): void {
  document.title = tRaw('{name} - Add the extension', { name: manifest.name });
  viewEl.innerHTML = `
    <div class="not-found">
      <div class="not-found-inner">
        <p class="not-found-code">${t('Add&#8209;on')}</p>
        <h1 class="not-found-title">${t('Enable {name} in your browser', { name: manifest.name })}</h1>
        <p class="not-found-desc">${t('Add the free Lolly screenshot extension and this tool captures pages right here - no desktop app needed. Install it, then reload this page.')}</p>
        ${/* nosemgrep: lolly-href-escape-is-not-scheme-validation - docsAppHref() over a build-time slug constant, always '#/docs/…' */ ''}
        <a href="${escape(docsAppHref('create/extension'))}" class="not-found-home" target="_blank" rel="noopener">${t('Get the extension')}</a>
        <a href="/#/" class="not-found-back">${t('Back to all tools')}</a>
      </div>
    </div>
  `;
}

// Arms the `?copy` URL action. Clipboard writes require a user gesture
// (navigator.clipboard.write rejects otherwise, and the image path would fall
// back to a surprise download), so we can't copy silently on load. Instead we
// highlight the Copy button and perform the copy on the user's first click -
// which carries the transient activation the clipboard API needs.
function armAutoCopy(
  actionsEl: HTMLElement | null,
  actionsApi: ActionsApi | undefined,
  fmt?: string
): void {
  const copyBtn = actionsEl?.querySelector<HTMLElement>('[data-action="copy"]');
  if (!copyBtn || !actionsApi?.copy) {
    console.warn('[copy] ?copy requested but this tool has no copy action');
    return;
  }

  // The armed affordance is the primary fill. On the native button that's the
  // .copy-armed alias in buttons.css; a jelly-button ignores page box-paint
  // (lib/jelly.ts strips it), so armed flips its variant instead - removing
  // `platinum` falls back to the accent fill, the jelly "primary".
  const jellyArmed = (on: boolean) => {
    if (copyBtn.tagName !== 'JELLY-BUTTON') return;
    if (on) copyBtn.removeAttribute('variant');
    else copyBtn.setAttribute('variant', 'platinum');
  };
  const disarm = () => {
    document.removeEventListener('pointerdown', onGesture, true);
    copyBtn.classList.remove('copy-armed');
    jellyArmed(false);
  };

  const onGesture = (e: PointerEvent) => {
    disarm();
    // If the click targeted the Copy button, its own handler runs the copy -
    // don't double up. Any other first interaction triggers it here.
    if (copyBtn.contains(e.target as Node)) return;
    actionsApi!.copy!(fmt).catch((err) => console.error('Auto-copy failed:', err));
  };

  document.addEventListener('pointerdown', onGesture, true);
  copyBtn.classList.add('copy-armed');
  jellyArmed(true);
}

function matchesDefault(input: { default?: InputValue; type: string }, paramVal: string): boolean {
  const def = input.default;
  if (def == null) return false;
  if (input.type === 'blocks') return false;
  if (input.type === 'boolean') return (paramVal === '1' || paramVal === 'true') === !!def;
  if (input.type === 'number') return Number(paramVal) === Number(def);
  if (input.type === 'color')
    return paramVal.replace(/^#/, '').toLowerCase() === String(def).replace(/^#/, '').toLowerCase();
  return paramVal === String(def);
}

/**
 * Remove URL params from the live address bar that already equal the tool's defaults.
 * Operates on the raw query string to preserve compact encodings (e.g. ~,).
 */
async function shrinkUrl(
  runtime: Runtime,
  manifest: ToolManifest,
  barSeq: BarSeq | null
): Promise<void> {
  // The bar is normally the path form /t/<id>?… by now; tolerate the boot-time hash
  // form too. Keep the route part, rewrite only the query.
  const hashQ = window.location.hash.indexOf('?');
  const rawQs = window.location.search
    ? window.location.search.slice(1)
    : hashQ >= 0
      ? window.location.hash.slice(hashQ + 1)
      : '';
  if (!rawQs) return;
  const base = window.location.pathname + window.location.hash.split('?')[0]!;

  // If the bar is already packed, expand it back to the readable query so the
  // default-stripping below can see individual params (it operates per-key).
  const qs = hasPackedState(rawQs) ? await expandQuery(rawQs) : rawQs;

  const model = runtime.getModel();
  const inputsByKey: Record<string, InputModelItem> = {};
  for (const input of model) {
    inputsByKey[input.id] = input;
    if (input.urlKey) inputsByKey[input.urlKey] = input;
  }

  // `present`/`s`/`kiosk` are engine-reserved; `kiosk` must also survive shrinkUrl
  // here so signage links (`?present&kiosk`) stay whole. See plan 112 and the
  // RESERVED note in engine/src/url-mode.ts (plan 171 renamed the flag from the
  // never-reservable `loop`).
  const RESERVED_KEEP = new Set([
    'format',
    'export',
    'copy',
    'slot',
    'output',
    'full',
    '_v',
    'nostage',
    'lang',
    'present',
    's',
    'kiosk',
  ]);

  const kept: string[] = [];
  for (const part of qs.split('&')) {
    if (!part) continue;
    const eqIdx = part.indexOf('=');
    const key = eqIdx < 0 ? part : part.slice(0, eqIdx);
    const rawVal = eqIdx < 0 ? '' : part.slice(eqIdx + 1);
    const val = decodeURIComponent(rawVal.replace(/\+/g, ' '));

    if (RESERVED_KEEP.has(key)) {
      kept.push(part);
      continue;
    }

    if (key === 'w' || key === 'width') {
      if (parseFloat(val) !== manifest.render.width) kept.push(part);
      continue;
    }
    if (key === 'h' || key === 'height') {
      if (parseFloat(val) !== manifest.render.height) kept.push(part);
      continue;
    }
    if (key === 'filename') {
      if (val !== manifest.name) kept.push(part);
      continue;
    }

    const input = inputsByKey[key];
    if (!input || !matchesDefault(input, val)) kept.push(part);
  }

  const newQs = kept.join('&');
  // Bump the shared guard so an in-flight syncUrl pack can't resolve later and clobber
  // this shrunk bar with the pre-shrink state (barSeq is the same holder syncUrl uses).
  const seq = barSeq ? ++barSeq.v : 0;
  // Re-pack if the shrunk-but-still-large query would still risk the URL ceiling and
  // packing actually wins; otherwise leave the readable form (shorter and editable).
  if (newQs.length >= AUTO_PACK_MIN && isPackAvailable()) {
    const token = await packQuery(newQs);
    if (barSeq && seq !== barSeq.v) return; // a newer bar write happened mid-pack
    const packed = token && `${PACK_PARAM}=${token}`;
    if (packed && packed.length < newQs.length) {
      history.replaceState(null, '', `${base}?${packed}`);
      return;
    }
  }
  history.replaceState(null, '', newQs ? `${base}?${newQs}` : base);
}

// encodeBlocksCompact moved to lib/blocks-url.ts (imported above) so the wire
// format is directly testable and the share dialog + syncUrl share one encoder.

// btnScopeEl - element containing the copy-url button (the actions bar)
// exportScopeEl - element containing format/filename/w/h inputs (actionsEl); optional
function wireUpCopyUrl(
  btnScopeEl: HTMLElement,
  runtime: Runtime,
  exportScopeEl: HTMLElement | null,
  manifest: ToolManifest,
  lolly?: ShareDialogLolly
): void {
  btnScopeEl
    .querySelector<HTMLButtonElement>('[data-action="copy-url"]')
    ?.addEventListener('click', () => {
      showShareDialog(runtime, exportScopeEl ?? btnScopeEl, manifest, lolly);
    });
}

/** The internal assets-bridge methods the `.lolly` builder needs, described by shape -
 *  they are web-only (not on the public HostV1.AssetsAPI), the same reason
 *  data-transfer.ts declares its own `BackupHost`. */
interface LollyAssetsSlice {
  get(id: string): Promise<AssetRef>;
  _getBlob(id: string, opts?: { format?: string; version?: string }): Promise<Blob | null>;
  _exportUserAssets(): Promise<readonly BeamAssetRecord[]>;
}

/** A catalog license that must NOT travel by default - proprietary / brand content
 *  (SUSE `LicenseRef-…-Proprietary`, PremiumBeat music). Open or unmarked catalog art
 *  carries freely; brand-locked tokens are caught separately via `meta.brandLock`. */
function isProprietaryLicense(license: unknown): boolean {
  const l = String(license ?? '').toLowerCase();
  return !!l && /proprietary|all-rights-reserved|licenseref|premiumbeat/.test(l);
}

/**
 * Build the `.lolly` download vehicle for the Share dialog, or undefined when the tool
 * has no saveable session (a pure render-only utility). Reuses the catalog + user-asset
 * bridge to resolve the session's closure, gates proprietary/brand-locked catalog bytes,
 * and assembles the creator block from the profile (identity gated on `useDetails`).
 */
// Tool files fetched as TEXT (the loader-critical set + svg); everything else as bytes.
const TOOL_TEXT_FILE = /\.(html|css|js|json|ics|vcf|csv|md|txt|svg)$/i;

/**
 * A cheap trust class for the "include the tool" default, without fetching every file:
 * a tool the deployment's signed catalog lists is `signed-catalog`; anything else
 * (unsigned build, a tool absent from the envelope, a sideloaded tool) is `custom`.
 */
async function coarseToolTrust(toolId: string): Promise<LollyToolTrust> {
  const integ = await getToolIntegrity().catch(() => null);
  const signed = integ?.envelope?.files;
  return signed && Object.hasOwn(signed, `${toolId}/tool.json`) ? 'signed-catalog' : 'custom';
}

/**
 * Resolve a tool's files for embedding in a `.lolly` and stamp a precise trust class.
 * The file list is the loader-critical set (tool.json/template/styles/hooks/i18n/text
 * templates + icon) UNIONED with every `<toolId>/*` path the signed catalog lists (which
 * adds thumb + tool-local assets for a catalog tool). Each file is fetched, and - when the
 * catalog signed this tool - hashed against the signed digest: `signed-catalog` only when
 * every covered file matched with no tamper, else `custom`. Returns null when the two files
 * a tool cannot open without (tool.json + template.html) can't be fetched.
 */
async function resolveToolBundle(
  toolId: string,
  manifest: ToolManifest
): Promise<LollyToolBundle | null> {
  const integ = await getToolIntegrity().catch(() => null);
  const signed = integ?.envelope?.files ?? null;

  const rels = new Set<string>(['tool.json', 'template.html', 'styles.css', 'icon.svg']);
  const hooks = manifest.hooks as { module?: boolean } | undefined;
  if (hooks && hooks.module !== true) rels.add('hooks.js');
  for (const ext of ['ics', 'vcf', 'csv', 'md'])
    if ((manifest.render?.formats ?? []).includes(ext)) rels.add(`template.${ext}`);
  const lang = currentLang();
  if (lang && lang !== 'en') rels.add(`i18n/${lang}.json`);
  if (signed)
    for (const key of Object.keys(signed))
      if (key.startsWith(`${toolId}/`)) rels.add(key.slice(toolId.length + 1));

  const fetchText = makeFetchFile(toolId);
  const files: Record<string, Uint8Array> = {};
  let covered = 0; // carried files the signed catalog also lists
  let matched = 0; // …of those, how many hashed identically
  for (const rel of rels) {
    let bytes: Uint8Array | null = null;
    try {
      if (TOOL_TEXT_FILE.test(rel)) {
        bytes = new TextEncoder().encode(await fetchText(`${toolId}/${rel}`));
      } else {
        const resp = await instanceFetch(instancePath(`/tools/${toolId}/${rel}`));
        const ct = resp.headers.get('content-type') ?? '';
        if (resp.ok && !ct.includes('text/html')) bytes = new Uint8Array(await resp.arrayBuffer());
      }
    } catch {
      bytes = null;
    } // an optional file that isn't there
    if (!bytes) continue;
    files[rel] = bytes;
    const digest = signed?.[`${toolId}/${rel}`];
    if (digest) {
      covered++;
      if ((await sha256Hex(bytes)) === digest) matched++;
    }
  }
  if (!files['tool.json'] || !files['template.html']) return null;

  const trust: LollyToolTrust =
    signed && Object.hasOwn(signed, `${toolId}/tool.json`) && covered > 0 && matched === covered
      ? 'signed-catalog'
      : 'custom';
  return {
    id: toolId,
    ...(manifest.version != null ? { version: String(manifest.version) } : {}),
    trust,
    files,
  };
}

function makeLollyVehicle(
  host: WebToolHost,
  toolId: string,
  manifest: ToolManifest,
  sessionState: (() => unknown) | undefined,
  canvasEl?: Element | null
): ShareDialogLolly | undefined {
  if (typeof sessionState !== 'function') return undefined;
  const assets = host.assets as unknown as LollyAssetsSlice;
  const appVersion = `Lolly ${ENGINE_VERSION}`;

  const resolveLibrary = async (id: string): Promise<LollyLibraryAsset | null> => {
    try {
      const blob = await assets._getBlob(id);
      if (!blob) return null;
      const ref = await assets.get(id).catch(() => null);
      const meta = (ref?.meta ?? {}) as Record<string, unknown>;
      const licensed = meta.brandLock === true || isProprietaryLicense(meta.license);
      return {
        bytes: new Uint8Array(await blob.arrayBuffer()),
        mime: blob.type || '',
        type: ref?.type ?? 'raster',
        format: ref?.format ?? '',
        label: typeof meta.name === 'string' ? meta.name : id,
        licensed,
      };
    } catch {
      return null;
    }
  };

  const build = async ({
    includeLicensed = false,
    includeTool = false,
  }: {
    includeLicensed?: boolean;
    includeTool?: boolean;
  } = {}) => {
    const session = sessionState() ?? null;
    const profile = await host.profile.get().catch(() => null);
    const userAssets = await assets._exportUserAssets();
    const creator = creatorFromProfile(profile, { appVersion });
    // Carry the tool's own files only on request - resolving them fetches every file.
    // A resolve failure (missing core files) degrades to a tool-less .lolly, never an error.
    const tool = includeTool ? await resolveToolBundle(toolId, manifest).catch(() => null) : null;
    // A raster thumbnail rides in the manifest so an importer - and the desktop
    // file managers' thumbnailer (plans/174 #3) - has a tile without rendering.
    // This closure has no canvas access, so the tile is the newest SAVED slot's
    // thumb for this tool (the same dataURL projects.ts ships) - best-effort,
    // and an unsaved-only session simply ships thumb-less, exactly as before.
    const thumb = session
      ? await host.state
          .list()
          .then((rows) => {
            const mine = (
              rows as unknown as { toolId: string; thumb: string | null; updatedAt?: string }[]
            )
              .filter((r) => r.toolId === toolId && typeof r.thumb === 'string')
              .sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')));
            return mine[0]?.thumb ?? null;
          })
          .catch(() => null)
      : null;
    // Which font faces this render depended on, by identity (lib/session-fonts.ts) - the
    // font half of the reproducibility receipt. Strictly best-effort: no font bytes travel,
    // and a walk that fails costs the receipt its font list, never the share.
    const fonts = await import('../lib/session-fonts.ts')
      .then((m) => m.collectSessionFonts(canvasEl))
      .catch(() => []);
    // The design system this session wore, so the receiving studio's "Add from a
    // file" can install the same look (bridge/tokens.ts readUserDesignSystem).
    const designSystem = await import('../bridge/tokens.ts')
      .then((m) =>
        m.readUserDesignSystem(host as unknown as Parameters<typeof m.readUserDesignSystem>[0])
      )
      .catch(() => null);
    const { blob, filename, summary } = await buildLollyFile({
      session,
      toolId,
      ...(designSystem ? { designSystem } : {}),
      ...(fonts.length ? { fonts } : {}),
      ...(typeof thumb === 'string' && thumb.startsWith('data:image/') ? { thumb } : {}),
      toolVersion: manifest.version != null ? String(manifest.version) : undefined,
      name: String((manifest as { name?: unknown }).name ?? toolId),
      userAssets,
      resolveLibrary,
      includeLicensed,
      creator,
      ...(tool ? { tool } : {}),
      appVersion,
      engineVersion: ENGINE_VERSION,
    });
    return { blob, filename, summary };
  };

  // The "include the tool" offer: resolved lazily by the dialog after it opens (a coarse
  // trust read, no file fetches), so a `custom` tool - one the deployment can't vouch for,
  // e.g. a fork or a private-brand tool a recipient likely lacks - defaults the toggle ON.
  const toolOffer = async () => {
    const trust = await coarseToolTrust(toolId).catch(() => 'custom' as LollyToolTrust);
    return { trust, suggested: trust === 'custom' };
  };

  // "Send to…" is offered ONLY where a real OS share will happen - host.export.canShare
  // probes the shell (web: navigator.canShare for the .lolly type, which Chromium's fixed
  // safelist rejects → hidden there; Tauri mobile: the native ACTION_SEND bridge present).
  // So the button never silently degrades to a download while claiming a share.
  const canOsShare =
    typeof host.export.canShare === 'function' &&
    host.export.canShare({ mime: LOLLY_MIME, filename: `share${LOLLY_EXT}` });
  const share = canOsShare
    ? (blob: Blob, filename: string) =>
        host.export.share!(blob, { filename, mime: LOLLY_MIME, title: filename })
    : undefined;
  return {
    build,
    toolOffer,
    save: (blob: Blob, filename: string) => host.export.file(blob, { filename }),
    share,
  };
}

// Reads the export-panel controls (format, dimensions, colour profile, password, print
// marks, the provenance toggles) into the share-link's export parts. Extracted from
// buildShareParams so ONE DOM read feeds both the copied link AND the URL-budget gauge
// (costUrlState's exportParts) - the two can never drift. Returns already-formed
// `key=value` (and bare-flag) strings; byte-identical to the block it replaced. The
// share-parity guard scans THIS function for those literal pushes.
function collectExportParams(exportScope: HTMLElement | null): string[] {
  const parts: string[] = [];
  const fmtEl = exportScope?.querySelector<HTMLSelectElement>('[data-action="format"]');
  if (fmtEl?.value) parts.push(`format=${encodeURIComponent(fmtEl.value)}`);
  const fname = exportScope
    ?.querySelector<HTMLInputElement>('[data-action="filename"]')
    ?.value?.trim();
  if (fname) parts.push(`filename=${encodeURIComponent(fname)}`);
  const w = parseFloat(
    exportScope?.querySelector<HTMLInputElement>('[data-action="export-width"]')?.value ?? ''
  );
  const h = parseFloat(
    exportScope?.querySelector<HTMLInputElement>('[data-action="export-height"]')?.value ?? ''
  );
  if (w > 0) parts.push(`w=${w}`);
  if (h > 0) parts.push(`h=${h}`);
  const u = exportScope?.querySelector<HTMLSelectElement>('[data-action="export-unit"]')?.value;
  if (u && u !== 'px') {
    parts.push(`unit=${u}`);
    const d = parseInt(
      exportScope?.querySelector<HTMLInputElement>('[data-action="export-dpi"]')?.value ?? '',
      10
    );
    if (d > 0) parts.push(`dpi=${d}`);
  }
  // Colour profile is only meaningful for the CMYK print formats (Print PDF / Print
  // TIFF); carry it only when one is selected and it isn't the default condition.
  const prof = urlProfileValue(
    exportScope?.querySelector<HTMLSelectElement>('[data-action="cmyk-profile"]')?.value
  );
  if (isCmykFmt(fmtEl?.value) && prof && prof !== DEFAULT_CMYK_CONDITION) {
    parts.push(`profile=${encodeURIComponent(prof)}`);
  }
  // Open-password - standard-tier lock only (PDF or ZIP), only when set. Clear-text by
  // design so a shared link can carry the lock; never used for confidential files.
  const pdfPass = exportScope?.querySelector<HTMLInputElement>(
    '[data-action="pdf-password"]'
  )?.value;
  const pdfStrong =
    exportScope?.querySelector<HTMLSelectElement>('[data-action="pdf-lock-tier"]')?.value ===
    'strong';
  if ((fmtEl?.value === 'pdf' || fmtEl?.value === 'zip') && pdfPass && !pdfStrong) {
    parts.push(`password=${encodeURIComponent(pdfPass)}`);
  }
  // Print marks & bleed - print formats (pdf / pdf-cmyk / cmyk-tiff) only, and only
  // when the card is on.
  if (isPrintFmt(fmtEl?.value) && printEnabled(exportScope)) {
    const bleed = readBleed(exportScope);
    if (bleed) parts.push(`bleed=${encodeURIComponent(bleed)}`);
    const marks = readMarks(exportScope);
    if (marks) parts.push(`marks=${encodeURIComponent(marks)}`);
  }

  // The provenance / output-mode toggles. These mirror syncUrl's branches exactly
  // (same controls, same on/off encoding), because a copied link that disagrees
  // with the address bar the user is looking at is the bug this block fixes.
  //
  // Each is guarded on the control EXISTING, not just on its checked state: the
  // toggles are rendered per-format, so a missing control means "not applicable
  // here". Reading `.checked` off a null would look like a deliberate opt-out and
  // would stamp e.g. `imprint=0` onto every link from a format that has no imprint.
  const fullPageEl = exportScope?.querySelector<HTMLInputElement>('[data-action="full-page"]');
  if (fmtEl?.value === 'html' && fullPageEl?.checked) parts.push('nostage');

  // Pixel watermark is ON by default, so only the explicit opt-out travels.
  const imprintEl = exportScope?.querySelector<HTMLInputElement>('[data-action="imprint"]');
  if (imprintEl && !imprintEl.checked) parts.push('imprint=0');

  // Durable credential and HDR are both OFF by default, so only the opt-in travels.
  const durableEl = exportScope?.querySelector<HTMLInputElement>('[data-action="durable"]');
  if (durableEl?.checked) parts.push('durable=1');

  const hdrEl = exportScope?.querySelector<HTMLInputElement>('[data-action="hdr"]');
  if (hdrEl?.checked) {
    // serializeHdr emits the bare `1` when every dial is default, and the compact
    // tuned form otherwise - so a tuned link carries its dials instead of
    // collapsing to defaults on the recipient's side.
    const dial = (a: string, d: number): number => {
      const v = Number(exportScope?.querySelector<HTMLInputElement>(`[data-action="${a}"]`)?.value);
      return Number.isFinite(v) ? v : d;
    };
    parts.push(
      `hdr=${encodeURIComponent(
        serializeHdr({
          peakNits: dial('hdr-peak', HDR_DEFAULTS.peakNits),
          reach: dial('hdr-reach', HDR_DEFAULTS.reach),
          lift: dial('hdr-lift', HDR_DEFAULTS.lift),
          richness: dial('hdr-focus', HDR_DEFAULTS.richness),
        })
      )}`
    );
  }
  return parts;
}

// Builds the base share-link query parts (tool inputs + the chosen export
// settings) - WITHOUT the on-visit behaviour flags (full/options/export/copy/_v),
// which the share dialog appends per the user's toggles.
function buildShareParams(
  runtime: Runtime,
  exportScope: HTMLElement | null
): { parts: string[]; fidelity: ShareFidelity } {
  const parts: string[] = [];
  // What a URL can't carry, recorded as we drop it, so the Share dialog can tell the
  // user what won't travel instead of dropping it silently (the "link has no content"
  // bug). Each `continue`-with-a-drop below records here.
  const droppedScalars: { id: string; label: string }[] = [];
  const droppedBlocks: { id: string; label: string }[] = [];
  const excludedAssets: { id: string; label: string }[] = [];

  // The per-param share-link encoding lives in lib/url-budget.ts (encodeModelParam),
  // so the copied link and the URL-budget gauge are the SAME bytes by construction -
  // one decision primitive, two consumers. The fidelity RECORDING stays here (literal,
  // and visible to the share-parity guard); the encoding DECISION (the 150/8000 caps,
  // the user/* and default skips, the hex-strip) lives in the primitive, unit-tested
  // in url-budget.test.ts. Byte-exact to the loop it replaces (pinned there).
  for (const input of runtime.getModel()) {
    for (const p of encodeModelParam(input)) {
      if (p.status === 'kept') parts.push(p.emit);
      else if (p.status === 'dropped-asset') excludedAssets.push({ id: p.id, label: p.label });
      else if (p.status === 'dropped-len') droppedScalars.push({ id: p.id, label: p.label });
      else if (p.status === 'dropped-blocks') droppedBlocks.push({ id: p.id, label: p.label });
    }
  }

  // The export-panel settings - the SAME reader the URL-budget gauge uses (see
  // collectExportParams), so the copied link and the gauge count identical export bytes.
  parts.push(...collectExportParams(exportScope));

  const fidelity: ShareFidelity = {
    faithful:
      excludedAssets.length === 0 && droppedScalars.length === 0 && droppedBlocks.length === 0,
    droppedScalars,
    droppedBlocks,
    excludedAssets,
  };
  return { parts, fidelity };
}

// The Share button opens the shared dialog (components/share-dialog.js): a ready-to-copy
// link plus the on-visit behaviour toggles. This thin wrapper feeds it the live tool
// state; the Projects view reuses the same dialog for a saved session.
function showShareDialog(
  runtime: Runtime,
  exportScope: HTMLElement | null,
  manifest: ToolManifest,
  lolly?: ShareDialogLolly
): void {
  // Resolve the tool id from the address bar (path or hash form) so the link is the
  // crawler-visible /t/<id> shape. The dialog itself lives in components/share-dialog.js,
  // shared with the Projects view's per-session "Share link". buildShareParams stays here
  // (it reads the live runtime + export-panel DOM); the session path passes its own parts.
  const toolId =
    window.location.pathname.match(/^\/t\/([^/?]+)/)?.[1] ??
    window.location.hash.match(/^#\/tool\/([^/?]+)/)?.[1];
  const currentFormat =
    exportScope?.querySelector<HTMLSelectElement>('[data-action="format"]')?.value || '';
  const { parts, fidelity } = buildShareParams(runtime, exportScope);
  openShareDialog({ toolId, baseParts: parts, manifest, currentFormat, fidelity, lolly });
}

// Re-create <script> elements so the browser executes them.
// Walk the canvas DOM for HTML comment markers left by annotateTemplate, convert
// them into data-canvas-input attributes, then remove the comments.
// Block-element outputs (e.g. <p> from {{markdown}}) are marked directly.
// Plain text outputs get wrapped in a transparent <span> so they're clickable.
function resolveCanvasAnnotations(canvasEl: HTMLElement): void {
  const comments: Comment[] = [];
  const walker = document.createTreeWalker(canvasEl, NodeFilter.SHOW_COMMENT);
  let node: Node | null;
  while ((node = walker.nextNode())) comments.push(node as Comment);

  for (const comment of comments) {
    if (!comment.parentNode) continue;
    const text = (comment.nodeValue ?? '').trim();
    const m = text.match(/^ci:(.+)$/);
    if (!m) continue;
    const id = m[1]!;

    // Collect siblings until the matching closing comment.
    const between: Node[] = [];
    let closing: ChildNode | null = null;
    let cur: ChildNode | null = comment.nextSibling;
    while (cur) {
      if (cur.nodeType === Node.COMMENT_NODE && (cur.nodeValue ?? '').trim() === `/ci:${id}`) {
        closing = cur;
        break;
      }
      between.push(cur);
      cur = cur.nextSibling;
    }

    const elements = between.filter((n) => n.nodeType === Node.ELEMENT_NODE);
    if (elements.length > 0) {
      for (const el of elements) (el as HTMLElement).dataset.canvasInput = id;
    } else {
      // Pure text - wrap in a span so it's individually clickable.
      const span = document.createElement('span');
      span.dataset.canvasInput = id;
      comment.parentNode.insertBefore(span, comment);
      for (const n of between) span.appendChild(n);
    }

    comment.remove();
    closing?.remove();
  }
}

// onSave: optional async () => void that performs the save and navigates on
// success (the caller owns both). We invoke and await it directly (from the
// modal's onClose, after the dialog has been dismissed) rather than firing a
// button click, so "Save & leave" reliably saves *then* leaves instead of
// trusting a fire-and-forget click + timer. Built on the shared mountModal
// lifecycle (components/modal.ts) - Escape and a backdrop click dismiss as
// Cancel like every other app dialog.
function showUnsavedDialog(
  onSave: (() => Promise<void> | void) | null,
  onLeave: () => void,
  detail?: string
): void {
  // Under the jelly flag the three actions become soft-body buttons (accent
  // "Save & leave", neutral platinum for the two exits), mirroring the confirm-
  // dialog.ts actionBtn mapping. The jelly host must NOT carry the box-painting
  // .unsaved-* classes (they'd paint a second capsule behind its canvas) - the
  // delegated [data-act] click handler retargets composed shadow clicks to the
  // host, so it fires unchanged; a layout-only .unsaved-btn-jelly class stays.
  const btn = (act: 'save' | 'leave' | 'cancel', label: string): string => {
    const nativeClass = { save: 'unsaved-save', leave: 'unsaved-leave', cancel: 'unsaved-cancel' }[
      act
    ];
    return jellyActive()
      ? `<jelly-button class="unsaved-btn-jelly"${act === 'save' ? '' : ' variant="platinum"'} data-act="${act}">${label}</jelly-button>`
      : `<button type="button" class="${nativeClass}" data-act="${act}">${label}</button>`;
  };
  const content = `
    <div class="unsaved-dialog-body">
      <h2>${t('Unsaved changes')}</h2>
      <p>${t('You have unsaved changes. <br>Would you like to save before leaving?')}</p>
      ${detail ? `<p class="unsaved-dialog-detail">${detail}</p>` : ''}
      <div class="unsaved-dialog-actions">
        ${onSave ? btn('save', t('Save &amp; leave')) : ''}
        ${btn('leave', t('Leave without saving'))}
        ${btn('cancel', t('Cancel'))}
      </div>
    </div>
  `;
  const modal = mountModal<'save' | 'leave' | undefined>(content, {
    className: 'unsaved-dialog',
    onClose: async (result) => {
      if (result === 'save') await onSave?.();
      else if (result === 'leave') onLeave();
      else playSfx('land'); // Cancel / Escape / backdrop - reverse-liftoff settle
    },
  });
  modal.el.dataset.sfxClose = 'off'; // this dialog owns its dismiss cue ('land' on Cancel), not the generic shoo
  playSfx('crystal'); // a light glass-elevator lift as the save decision rises up
  modal.el.addEventListener('click', (e) => {
    const act =
      e.target instanceof Element
        ? e.target.closest<HTMLElement>('[data-act]')?.dataset.act
        : undefined;
    if (act === 'save') modal.close('save');
    else if (act === 'leave') modal.close('leave');
    else if (act === 'cancel') modal.close(undefined);
  });
}
