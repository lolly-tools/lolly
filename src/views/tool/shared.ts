// SPDX-License-Identifier: MPL-2.0
/**
 * Module-level declarations of tool.ts that its feature modules use: the types,
 * constants and pure helpers that used to sit above mountTool(). Moved here verbatim so
 * no feature module has to import the orchestrator file. The tool view: one mounted tool - sidebar, canvas, actions bar, history and collab.
 */
import type { ClipboardAPI, ComposeAPI, HostV1, StateAPI } from '@lolly-tools/core/host-v1';
import { DEFAULT_CMYK_CONDITION, ENC_PARAM, HDR_DEFAULTS, PACK_PARAM, expandQuery, hasPackedState, isPackAvailable, packQuery, serializeHdr, unpackEncrypted } from '@lolly/engine';
import type { DepthSetting, HdrSettings, VideoUrlSettings } from '@lolly/engine';
import type { InputModelItem, InputValue } from '../../../../../engine/src/inputs.js';
import type { ExportAudio } from '../../bridge/audio-envelope.ts';
import { promptDialog } from '../../components/confirm-dialog.ts';
import { mountModal } from '../../components/modal.ts';
import type { ToolDesignSystemRegistry } from '../tool-design-system-context.ts';
import { jellyActive } from '../../lib/jelly.ts';
import { t } from '../../i18n.ts';
import { urlProfileValue } from '../../lib/press-profile-embed.ts';
import { playSfx } from '../../lib/sfx.ts';
import { openShareDialog } from '../../components/share-dialog.ts';
import type { ShareDialogLolly } from '../../components/share-dialog.ts';
import { AUTO_PACK_MIN, encodeModelParam } from '../../lib/url-budget.ts';
import type { ShareFidelity } from '../../lib/url-budget.ts';
import type { ToolManifest, ToolRenderSpec } from '../../../../../engine/src/loader.js';
import type { Runtime } from '../../../../../engine/src/runtime.js';
import { isTextEditingTarget } from '../../lib/typing-target.ts';
import { isCmykFmt, isPrintFmt, printEnabled, readBleed, readMarks } from '../tool-actions.ts';

// ── Shell-side type aliases (all erased at build; no runtime effect) ──────────

/** The view root; the router reads back a `_cleanup` teardown hook off it. */
export type ViewEl = HTMLElement & { _cleanup?: () => void };

/** `render.transcribe` - the manifest's speech-to-text declaration (v1.150). */
export type TranscribeSpec = NonNullable<ToolRenderSpec['transcribe']>;

/**
 * The declaration a mounted tool's Transcribe affordance acts on, or null when
 * it must not mount: no declaration, a shell without on-device speech (the
 * CLI), or a spec naming inputs the manifest does not declare (a typo - the
 * button would write nowhere). A module-scope helper rather than an IIFE in
 * mountTool: the team-origin contract test forbids bare returns between the
 * origin consume and the teardown hook (tool-team-origin.test.ts).
 */
export function resolveTranscribeSpec(
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
export interface HistoryControls {
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
  copy?: (fmtOverride?: string) => Promise<{ method: string } | undefined>;
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
  history?: import('../automatic-history.ts').AutomaticHistory;
  /** Tear down the cost-authoring slot: unsubscribe the registry-change listener
   *  and run the hydrated extension's disposer. Called from mountTool's cleanup. */
  dispose?: () => void;
  /** Release the last export's retained file (plans/236); the mount lifecycle calls it. */
  releaseDelivery?: () => void;
}

/** Optional outcome guidance layered over the generic export pipeline. */
export interface ExportExperience {
  recommendedFormats?: readonly string[];
  summary?: string;
  downloadLabel?: string;
}

/** A shared monotonic bar-write guard (a holder object so shrinkUrl can share it). */
export interface BarSeq {
  v: number;
}

/** The lottie-mount module, loaded lazily and kept for reaping. */
export type LottieModule = typeof import('../lottie-mount.ts');
/** The video-mount module, loaded lazily the first paint that emits a keyed <video>. */
export type VideoModule = typeof import('../video-mount.ts');
/** The animated-SVG enhancer, loaded lazily the first paint that emits a [data-anim-src]
 *  marker (fetch + DOMPurify are its own chunk). */
export type AnimSvgModule = typeof import('../anim-svg-mount.ts');
/** The MilkDrop enhancer, loaded lazily the first paint that emits a [data-lolly-viz]
 *  placeholder - butterchurn and the preset builders are a chunk of their own. */
export type VizModule = typeof import('../../lib/viz-tool-mount.ts');

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

export function marksFromCsv(csv: string | null | undefined): PrintMarks | null {
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
export const ICON_UNDO =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11"/></svg>';
export const ICON_REDO =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5 5.5 5.5 0 0 0 9.5 20H13"/></svg>';

// Prompt (client-side, no server) for the password on an encrypted `zx` link and
// return the decrypted READABLE query. Loops on a wrong password; on cancel returns
// the original query unchanged (zx is reserved → parseUrlState ignores it → the tool
// loads at defaults). Readable params riding alongside zx (on-visit flags) are
// re-appended after the decoded state so they still apply - mirroring expandQuery.
// One navigation can mount twice (popstate + hashchange), so the prompt is shared
// per token via this in-flight map - the user never sees two stacked dialogs.
export const zxInFlight = new Map<string, Promise<string>>();
export async function decryptEncryptedLink(query: string): Promise<string> {
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

// True only when focus is in a genuinely text-editable field (so Cmd+Z falls
// through to the browser's per-character undo). Deliberately NARROWER than
// isTyping: a focused range slider / colour / checkbox / number IS an <input>
// but has no native undo, so our input-history undo should still fire there.
// Shadow-aware, so a jelly field (real <input> inside a shadow root) is recognised.
export const isTextEditing = (): boolean => isTextEditingTarget();

// Arms the `?copy` URL action. Clipboard writes require a user gesture
// (navigator.clipboard.write rejects otherwise, and the image path would fall
// back to a surprise download), so we can't copy silently on load. Instead we
// highlight the Copy button and perform the copy on the user's first click -
// which carries the transient activation the clipboard API needs.
export function armAutoCopy(
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

export function matchesDefault(input: { default?: InputValue; type: string }, paramVal: string): boolean {
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
export async function shrinkUrl(
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
      history.replaceState(history.state, '', `${base}?${packed}`);
      return;
    }
  }
  history.replaceState(history.state, '', newQs ? `${base}?${newQs}` : base);
}

// encodeBlocksCompact moved to lib/blocks-url.ts (imported above) so the wire
// format is directly testable and the share dialog + syncUrl share one encoder.

// btnScopeEl - element containing the copy-url button (the actions bar)
// exportScopeEl - element containing format/filename/w/h inputs (actionsEl); optional
export function wireUpCopyUrl(
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
// Reads the export-panel controls (format, dimensions, colour profile, password, print
// marks, the provenance toggles) into the share-link's export parts. Extracted from
// buildShareParams so ONE DOM read feeds both the copied link AND the URL-budget gauge
// (costUrlState's exportParts) - the two can never drift. Returns already-formed
// `key=value` (and bare-flag) strings; byte-identical to the block it replaced. The
// share-parity guard scans THIS function for those literal pushes.
export function collectExportParams(exportScope: HTMLElement | null): string[] {
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
export function buildShareParams(
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
export function showShareDialog(
  runtime: Runtime,
  exportScope: HTMLElement | null,
  manifest: ToolManifest,
  lolly?: ShareDialogLolly
): void {
  openShareDialog(shareDialogOptions(runtime, exportScope, manifest, lolly));
}

export function shareDialogOptions(
  runtime: Runtime,
  exportScope: HTMLElement | null,
  manifest: ToolManifest,
  lolly?: ShareDialogLolly,
): import('../../components/share-dialog.ts').ShareDialogOpts {
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
  return { toolId, baseParts: parts.filter(part => part !== 'format=lolly'), manifest,
    currentFormat: currentFormat === 'lolly' ? '' : currentFormat, fidelity, lolly };
}

// Re-create <script> elements so the browser executes them.
// Walk the canvas DOM for HTML comment markers left by annotateTemplate, convert
// them into data-canvas-input attributes, then remove the comments.
// Block-element outputs (e.g. <p> from {{markdown}}) are marked directly.
// Plain text outputs get wrapped in a transparent <span> so they're clickable.
export function resolveCanvasAnnotations(canvasEl: HTMLElement): void {
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
export function showUnsavedDialog(
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
export type ExportReport = (done: number, total: number) => void;

// Motion preview-generation hook - scripts/build-animated-previews.ts calls this to
// export the LIVE animating canvas as a short, small looping clip (apng/gif) for an
// animated tool's gallery tile / example look. Like __lollyCaptureThumb it reuses the
// app's OWN export path (runtime.export → the shell's renderApng/renderGif), so a
// generated APNG is byte-faithful to a real user export - no second capture path to drift.
// Returns a base64 data-URL, or null on failure. Build-tool only; no in-app UI calls it.
export type MotionCaptureOpts = {
  width?: number;
  height?: number;
  duration?: number;
  wait?: number;
  repeat?: number;
  fps?: number;
};
