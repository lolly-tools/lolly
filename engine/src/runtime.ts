// SPDX-License-Identifier: MPL-2.0
/**
 * Runtime - orchestrates the 5-step lifecycle for a single mounted tool.
 *
 *   1. Request tool & template      → loader.ts (done before runtime exists)
 *   2. Present inputs               → buildInputModel + host UI
 *   3. Hydrate template             → hydrate()
 *   4. Stage for render             → host configures the render target
 *   5. Render to format             → host.export.render()
 *
 * The runtime is platform-agnostic. It receives a host (the capability bridge)
 * and emits state updates. The shell renders them.
 *
 * Hooks (if the tool declares any) are loaded via `new Function` with the host
 * bridge injected as closure scope - a portability contract, NOT a security
 * boundary (see getHookFactory). The runtime invokes them at the right
 * lifecycle points, time-boxes their async results (HOOK_BUDGET_MS), and
 * merges their effects.
 *
 * Patch semantics:
 *   Hooks return a plain object. Keys that match a declared input id update
 *   that input's value. Keys with no matching input go into `extras` - a
 *   parallel store of hook-computed values the template can reference directly.
 *   This is how QR module lists, chart data, etc. reach the template without
 *   being declared as user-facing inputs in the manifest.
 */

import { assertDesignValues, designExportSize } from './design-tool/policy.ts';
import { missingRequires, type HostApiName } from '@lolly-tools/core';
import type { EmojiStyleV1 } from '@lolly-tools/core';
import type { EmojiSetInfoV1 } from '@lolly-tools/core/emoji-v1';
import { defaultEmojiStyle } from './emoji-default.ts';
import { emojiSourceIngredients, emojiWorksAndUses, emojiCreditsText } from './emoji-rights.ts';
import { sourceIngredientsFor } from './rights-attribution.ts';
import type { SourceDetailV1 } from './rights-attribution.ts';
import { evaluateCreativeUses } from './rights-evaluate.ts';
import { outputLicenceId, outputLicenceNotice } from './rights-profiles.ts';
import { buildInputModel, updateInput, modelToValues, modelForHooks, flattenValue, summarizeInputs, normalizeTableValue, tokenBindingsOf } from './inputs.ts';
import { hydrate, resolvePaintBindings } from './template.ts';
import { buildExportMeta } from './metadata.ts';
import { isTokenValue, isAlias, colorToHex } from './tokens.ts';
import { resolveNestedRenders } from './compose.ts';
import { isToolUrl } from './tool-url.ts';
import { isBakedRef } from './bake.ts';
import type { InputModelItem, InputValue } from './inputs.ts';
import type { LoadedTool, ToolManifest } from './loader.ts';
import type { ComposeMemo } from './compose.ts';
import type { EmojiDomNode, EmojiDomResult } from './emoji-dom.ts';
import type { EmojiArtworkCache, EmojiTextIO } from './emoji-inline.ts';
import type { EmojiLineSource } from './emoji-line.ts';
import type { VerifiedEmojiPack } from './emoji-pack.ts';
import type { C2paSourceIngredient } from './c2pa.ts';
import type {
  HostV1, AssetRef, ExportFormat, ExportOpts, MediaFrame, TokenSet,
  AudioLevel, RecordOpts, RecordSession, IngredientCredential, SourceIngredient,
} from './bridge/host-v1.ts';
import type {
  AttributionReceiptV1, CreativeUseV1, CreativeWorkRecordV1, DeliveryRouteV1,
  RightsDecisionV1, RightsEvaluationV1, UseContextV1,
} from '@lolly-tools/core/rights-v1';
import { parseProviderRef } from './asset-provider.ts';
import { assetVersionPin, decodeAssetVersion, unavailablePinnedAsset, type AssetVersionPin } from './asset-version.ts';

/** One state emission: the current model plus the hydrated template. */
export interface RuntimeState {
  model: InputModelItem[];
  hydrated: string;
}

/** A hook failure recorded for the shell (currently onInit). */
export interface HookError {
  hook: string;
  message: string;
}

/**
 * What the emoji pass knows right now, for a shell's chrome to read and show.
 * `present` is only "this host can supply pinned packs at all" - it says nothing
 * about whether a set has been chosen or whether the render contains any emoji.
 */
export interface RuntimeEmojiState {
  /** The host offers `host.emoji`. False on a shell with no pack storage. */
  present: boolean;
  /** Pinned pack assets carried by saves, templates and portable files. */
  assets?: import('@lolly-tools/core/host-v1').AssetRef[];
  /** Glyphs drawn from the chosen set in the last pass. */
  replaced: number;
  /** Clusters the last pass left as the neutral placeholder. */
  unresolved: number;
  /** The style in force, or null while no set has been chosen. */
  style: EmojiStyleV1 | null;
  /** The sets this host can load, once the runtime has listed them. */
  sets?: EmojiSetInfoV1[];
}

/** One pass over a rendered tree, plus whether the host could serve it at all. */
export interface RuntimeEmojiResult extends EmojiDomResult {
  present: boolean;
}

/**
 * What one pass is FOR. The default is the render: the tree becomes the one a
 * later set change redraws, and its counts become what the chrome reads.
 *
 * Chrome that draws emoji of its own - a sidebar table cell, the picker grid, the
 * specimen row in the Emoji section - passes `track: false`. Such a pass draws
 * artwork and reports what it drew, and changes nothing the chrome can see: a
 * one-cell walk must not become the answer to "does this render carry emoji", and
 * it must not steal the tree a set change is supposed to redraw.
 */
export interface RuntimeEmojiPassOpts {
  /** Record this pass as the render. Default true. */
  track?: boolean;
  /**
   * The letter every placement id in this pass starts with. Default `e`, which is
   * the canvas. Two roots walked into ONE document need different scopes, or both
   * start counting at the beginning and one root's gradient or clip path paints
   * the other's glyph.
   */
  idScope?: string;
}

/**
 * What a caller knows about the delivery it is evaluating (plan 253). Every
 * field is optional, and the delivery is a partial of its own, so a shell that
 * knows only the format says only the format. An unstated audience stays
 * `unknown`: a private draft and a public post ask different things of a
 * ShareAlike source, and guessing either way would be an answer nobody gave.
 */
export interface RuntimeRightsContext extends Partial<Omit<UseContextV1, 'delivery'>> {
  delivery?: Partial<UseContextV1['delivery']>;
}

/** An asset ref (saved session / URL) that no longer resolves. */
export interface DroppedAsset {
  inputId: string;
  label: string;
  id: string;
  /** Why it dropped: 'render-failed' | 'not-found' | 'baked-bytes-lost'. */
  reason?: string;
}

/** Export options accepted by runtime.export - the host contract's ExportOpts
 *  plus the engine-level 'Convert paths' toggle the bridge reads. */
export interface RuntimeExportOpts extends ExportOpts {
  convertPaths?: boolean;
  /** The shell's Content-Credentials render intent. The runtime only reads it to
   *  decide whether to derive the input digest (summarizeInputs) for provenance;
   *  the actual stamping lives in each shell's export bridge. */
  c2pa?: boolean;
}

/** What a tool's `exportFile` hook must produce (the transform output path). */
export interface ExportFileResult {
  bytes: Uint8Array | ArrayBuffer;
  mime?: string;
  filename?: string;
}

/**
 * What a tool's `exportStill` hook may return to OWN a raster still export - the
 * tool computes its own encoded bytes for the requested format (e.g. a float
 * grading pipeline → 16-bit PNG / OpenEXR the 8-bit DOM raster path cannot
 * produce) and the runtime returns them verbatim, skipping host.export.render.
 * Return null/undefined (or omit bytes) to decline and fall through to the
 * normal DOM raster path for this format - so a tool owns only the formats it
 * has real precision for and every other export is byte-identical to before.
 * Like the exportFile transform path, tool-supplied bytes carry NO watermark and
 * NO engine-stamped provenance (the tool owns what it wrote).
 *
 * Not only deep RASTER: the bytes are whatever the requested format is, so a tool
 * may own a non-raster binary here too - e.g. the color-palette tool returns an
 * Adobe `.ase` swatch file for `format === 'ase'` (host.color.paletteExportBytes)
 * and declines every other format. The runtime just wraps the bytes with `mime`.
 */
export interface ExportStillResult {
  frame?: import('@lolly-tools/core/host-v1').CodecFrame;
  bytes?: Uint8Array | ArrayBuffer;
  mime?: string;
}

/** What runtime.stopRecording resolves to - the captured media + its MIME type
 *  (the container the shell actually encoded, which may differ from the request). */
export interface RecordResult {
  blob: Blob;
  mimeType: string;
  /** Whether a microphone track was actually captured (v1.54) - a granted mic, not a
   *  requested-but-denied one. Lets the shell keep the saved take's provenance honest
   *  (never claim "with microphone narration" on a silent screen recording). Undefined
   *  when the session doesn't report it. */
  micActive?: boolean;
}

/** What runtime.startRecording resolves to - whether the take started, and (v1.54)
 *  whether a mic was actually acquired, so a screen-capture UI can warn the user at
 *  the START of a long take that their narration isn't being recorded. */
export interface StartRecordingResult {
  started: boolean;
  micActive?: boolean;
}

/**
 * Per-hook time budgets (ms) for the runtime's async time-box. A hook that
 * returns a Promise is RACED against its budget: on overrun the runtime logs
 * the timeout and applies NO patch now - but the hook itself keeps executing
 * (there is no in-realm preemption; a SYNCHRONOUS overrun can only be measured
 * and warned after the fact). For onInit/onInput (v1.146) the late resolution
 * still applies WHEN it resolves, provided no newer onInit/onInput run has started
 * since - so a slow first analysis heals instead of leaving the card stale
 * forever, while a superseding keystroke still wins. Export-path hooks never
 * late-apply (their overrun fails that export visibly). `onFrame`/`onLevel`
 * are deliberately absent: they run once per frame/sample and are throttled by
 * dropping overlapping samples instead (see startLive/driveLevels).
 * `exportFile` gets a larger budget because it's a real-work path (e.g. PDF
 * re-encode of a large file). Every key here has a real invocation site - a
 * budget for a hook that never fires is how `beforeRender` looked implemented
 * for as long as it existed (removed 2026-07-30). Exported mutable so tests (and
 * shells with unusual needs, e.g. a long page-capture beforeExport) can adjust
 * it; the defaults are the documented contract.
 */
export const HOOK_BUDGET_MS = {
  onInit: 5000,
  onInput: 2000,
  beforeExport: 5000,
  afterExport: 5000,
  exportFile: 10000,
  exportStill: 10000,
};

/** The lifecycle context every hook receives. */
interface HookContext {
  lang?: string;
  model: InputModelItem[];
  host: HostV1;
  /** Publish an intermediate onInit/onInput patch. Ignored after a newer run. */
  report?: (patch: Record<string, unknown>) => void;
}

type OnInitHook = (ctx: HookContext) => unknown;
type OnInputHook = (ctx: HookContext & { id: string; value: InputValue }) => unknown;
type OnFrameHook = (ctx: HookContext & { frame: MediaFrame }) => unknown;
type OnLevelHook = (ctx: HookContext & { level: AudioLevel }) => unknown;
type ExportLifecycleHook =
  (ctx: { lang?: string; model: InputModelItem[]; node: unknown; format: string; opts: RuntimeExportOpts; host: HostV1 }) => unknown;
type ExportFileHook = (ctx: HookContext & { opts: Record<string, unknown> }) => unknown;
type ExportStillHook = ExportLifecycleHook; // same ctx as beforeExport; returns ExportStillResult | null

/**
 * The hooks record produced by loading a tool's hooks.js - one entry per
 * lifecycle point, null when the tool doesn't declare it.
 */
export interface Hooks {
  onInit: OnInitHook | null;
  onInput: OnInputHook | null;
  onFrame: OnFrameHook | null;
  onLevel: OnLevelHook | null;
  beforeExport: ExportLifecycleHook | null;
  afterExport: ExportLifecycleHook | null;
  exportFile: ExportFileHook | null;
  exportStill: ExportStillHook | null;
  /**
   * Optional teardown an executor may attach - called from runtime.destroy() when
   * the shell unmounts the tool. The in-realm executor has nothing to release (GC
   * reclaims the compiled closure); the Worker executor uses it to tell its worker
   * to drop this mount's run and to release the main-side host reference, so a
   * shared singleton worker doesn't accumulate one run per mount for the session.
   */
  dispose?: () => void;
}

/** The mounted-tool API createRuntime resolves to. Shells drive this. */
export interface Runtime {
  getModel(): InputModelItem[];
  getHydrated(): string;
  /** Hydrate an arbitrary template string against the same context (e.g. manifest.a11yLabel). */
  getHydratedString(str: string | null | undefined): string;
  /**
   * Same context, WITHOUT HTML escaping - for reading non-HTML hook extras out of
   * the runtime (e.g. `{{videoLook}}`, darkroom's baked-look JSON that the shell's
   * Apply-to-video hands to the video-grade job). The escaping variant above would
   * entity-encode the JSON's quotes.
   */
  getHydratedText(str: string): string;
  /**
   * Draw every emoji in a rendered tree from the chosen set, in place. A runtime
   * service every tool gets: no manifest opt-in, no tool code, so one recipe
   * covers the design tool's text boxes and every other canvas alike.
   *
   * Idempotent and safe to call after each paint. The packs a style pins are
   * loaded once per runtime and the prepared artwork is cached, so a repaint
   * costs a walk rather than a download. A host with no `host.emoji` answers
   * `present: false` and touches nothing.
   *
   * `opts` is for a caller that is NOT the render: chrome drawing its own emoji
   * passes `track: false` and an `idScope` of its own. See RuntimeEmojiPassOpts.
   */
  applyEmojiToDom(node: unknown, opts?: RuntimeEmojiPassOpts): Promise<RuntimeEmojiResult>;
  /** Put the characters back, so a caret and input composition work on plain text. */
  revertEmojiDom(node: unknown): Promise<number>;
  /** Choose the set and treatment, and re-draw the last tree the pass ran on. */
  setEmojiStyle(style: EmojiStyleV1 | null): Promise<void>;
  /** What the emoji pass knows right now (a fresh snapshot on every read). */
  readonly emoji: RuntimeEmojiState;
  /** Called whenever the state above changes. Returns the unsubscribe. */
  onEmojiChange(fn: (state: RuntimeEmojiState) => void): () => void;
  /**
   * The Content Credentials source ingredients for the artwork the last pass
   * placed, one per distinct glyph. `export()` already appends these to the
   * ingredients it hands the host, so this is for a shell whose export bridge
   * stamps the credential itself (the CLI does, in buildExportC2paOpts).
   */
  emojiIngredients(): C2paSourceIngredient[];
  emojiCredits(): string;
  /** The document-scoped composer shares its selected emoji pins with tool hooks. */
  layoutText(request: import('@lolly-tools/core').TextLayoutRequestV1): Promise<import('@lolly-tools/core').TextLayoutV1>;
  /** A synchronous receipt exists only for the exact settled source, geometry and emoji pins. */
  peekTextLayout(request: import('@lolly-tools/core').TextLayoutRequestV1): import('./text-layout-cache.ts').TextLayoutReceipt | null;
  /**
   * What the recorded sources in this render ask of the person delivering it
   * (plan 253): the reviewed licence rules applied to the works this render
   * placed, the delivery it is headed for, and the decisions a person made.
   *
   * Deterministic and free of I/O, so a shell may call it on every paint. The
   * caller supplies whatever it knows about the delivery; what it leaves out
   * falls back to this tool's first declared format, a file route, and an
   * audience of `unknown`, which is the honest answer before anyone says where
   * the file is going.
   */
  rights(context?: RuntimeRightsContext): RightsEvaluationV1;
  /**
   * Record a choice a person made about one work - a licence for an adaptation
   * they share, or a permission they hold separately. Kept per runtime, so the
   * next evaluation and the next export both see it, and readable through
   * {@link Runtime.rightsDecisions} for the session record. A decision replaces
   * an earlier one for the same work and kind.
   */
  setRightsDecision(decision: RightsDecisionV1): void;
  /** Every decision recorded on this runtime, oldest first. A copy, not the store. */
  rightsDecisions(): RightsDecisionV1[];
  /** Restore decisions from a saved session. Replaces whatever is held. */
  setRightsDecisions(decisions: readonly RightsDecisionV1[]): void;
  /**
   * The licence the person declared for their own export (an id from
   * `OUTPUT_LICENCE_CHOICES`), or null for no declaration. Every later
   * evaluation reads it as `outputLicence` unless a context names its own, and
   * an export writes its notice into the file's licence field when the tool's
   * own inputs did not already supply one. An unknown id clears it.
   */
  setOutputLicence(id: string | null): void;
  outputLicence(): string | null;
  /**
   * What the last export actually delivered, as the host measured it by reading
   * the written bytes back. Null until a host reports one: an unread export is
   * not a confirmed one, so nothing here ever says credits are included before
   * a reader found them.
   */
  readonly lastReceipt: AttributionReceiptV1 | null;
  manifest: ToolManifest;
  styles: string | null;
  /** Asset refs (saved session / URL) that no longer resolve - read once after mount. */
  droppedAssets: DroppedAsset[];
  /** Hook failures (currently onInit); empty when every hook ran cleanly. */
  hookErrors: HookError[];
  setInput(id: string, value: InputValue): Promise<void>;
  /**
   * Apply MANY input values as ONE batch - the multi-input counterpart to
   * setInput (plans/100 section 5: a remote collaboration op arrives as a set of values;
   * also useful to /multi and URL hydration). Unknown ids and values the
   * constraints reject are dropped key by key - never the batch, never a throw
   * mid-apply. `onInput` still runs per changed id, sequentially in the object's
   * insertion order; what coalesces is the render: subscribers are notified
   * exactly once, after the last hook.
   */
  applyPatch(values: Record<string, unknown>): Promise<void>;
  /**
   * Re-resolve unresolved asset + token refs in the CURRENT model, then re-emit if
   * anything changed. createRuntime resolves these once from the initial seed, but a
   * batch applied AFTER mount (a template/preset picked mid-doc, via applyPatch or a
   * setInput loop) arrives with its `{color.*}` token aliases and tool-URL asset stubs
   * still unresolved - setInput/applyPatch deliberately never re-render a child or hit
   * the token set per keystroke. Call this ONCE after such a batch so a picked template
   * renders exactly like one opened fresh. Both underlying resolvers no-op when there is
   * nothing to resolve (and resolveTokenRefs is a no-op without host.tokens).
   */
  resolveRefs(): Promise<void>;
  subscribe(fn: (state: RuntimeState) => void): () => void;
  /** Re-notify subscribers with the CURRENT model - no value change. */
  refresh(): void;
  /** True when this tool declares an `onFrame` hook. */
  hasFrameHook: boolean;
  /** Whether the live frame loop (camera or animated-asset) is currently running. */
  isLive(): boolean;
  /**
   * DETERMINISTIC export drive: run `onFrame` once with a caller-supplied frame and return
   * the freshly hydrated output (the same string a live render would paint), WITHOUT the rAF
   * loop and WITHOUT notifying subscribers - the caller paints it and captures. This is the
   * frame-accurate render the live preview showed: the shell walks the source frame-by-frame
   * (host.media.renderFrameAt) and feeds each through here. Returns null with no onFrame hook.
   * Mutates the render's `extras` (the effect output), so trigger a normal render afterwards
   * to restore the live preview.
   */
  applyFrameForExport(frame: MediaFrame): Promise<string | null>;
  /**
   * Pause / resume the live repaint loop WITHOUT tearing down the media source (unlike
   * stopLive, which calls host.media.stop()). Holds the preview still while a deterministic
   * export drive owns the canvas - `renderFrameAt` keeps working because the source stays
   * armed and running. isLive() stays true. Idempotent; harmless when not live.
   */
  pauseLive(): void;
  resumeLive(): void;
  /**
   * Start driving `onFrame` from the host frame source. `source` declares what is
   * feeding the frames: 'camera' (default) marks each rendered frame as a live
   * device capture for export provenance; 'asset' - a shell replaying an animated
   * asset (SVG/GIF/APNG/video) through the same loop - must NOT, because claiming
   * digitalCapture for a decoded file would be a false statement in a signed
   * manifest (1.113).
   */
  startLive(opts?: { source?: 'camera' | 'asset'; facingMode?: 'user' | 'environment' }): Promise<boolean>;
  stopLive(): void;
  /** True when this tool declares an `onLevel` hook (it CAN react to live audio levels). */
  hasLevelHook: boolean;
  /**
   * Start driving the tool's `onLevel` hook from the host mic level meter - a
   * pre-record "sound check". Resolves true once levels flow; rejects if permission
   * is denied or there's no mic (the shell shows that error). No-op (false) if
   * already metering, the tool has no onLevel, or the shell provides no host.recorder.
   */
  startMeter(opts?: { deviceId?: string }): Promise<boolean>;
  /** Stop the level-meter loop and release the mic reference (idempotent). */
  stopMeter(): void;
  /**
   * Begin a recording session (mic, optionally camera) via host.recorder, driving
   * the tool's `onLevel` hook - if any - from the session's live levels. Resolves
   * true once recording; rejects on denial / missing device. No-op (false) if
   * already recording or no host.recorder. Stops any pre-record meter first so the
   * take and the sound-check share the one mic the shell opened.
   */
  startRecording(opts?: RecordOpts): Promise<StartRecordingResult>;
  /**
   * Finalise the current recording and resolve the captured media (Blob + the MIME
   * type actually encoded), or null if not recording. The shell routes the bytes: a
   * video clip becomes a template asset (setInput); an audio clip downloads via
   * host.export.file (the user's own content - never watermarked).
   */
  stopRecording(): Promise<RecordResult | null>;
  /** Discard the current recording and release the devices (idempotent). */
  cancelRecording(): void;
  /** True when output flows through the transform path (exportFile hook). */
  hasExportFile: boolean;
  exportFile(opts?: Record<string, unknown>): Promise<ExportFileResult | ExportFileResult[]>;
  export(renderedNode: unknown, format: string, opts?: RuntimeExportOpts): Promise<Blob>;
  /** Release resources held for this mount (currently: a Worker-isolated executor's
   *  run). Idempotent; safe to call even with no executor teardown. The shell calls
   *  it from the tool view's unmount cleanup. */
  destroy(): void;
}

/**
 * @param tool          from loader.ts
 * @param host          capability bridge implementation
 * @param initialState  from URL params or saved slot
 * @param opts.composeStack  tool ids already on the compose path - set by the
 *        compose bridge when rendering a child, so nested composition
 *        (A embeds B embeds C) carries cycle/depth detection downward.
 */
// Raster formats that carry an alpha channel - the ones a transparent background is
// meaningful for. SVG keeps its transparency through a fill:none bg rect, so it needs no
// help here; JPEG has no alpha at all.
const ALPHA_EXPORT_FORMATS = new Set(['jxl', 'jxl-lossless', 'png', 'webp', 'avif', 'apng', 'webp-anim', 'gif']);

export async function createRuntime(
  tool: LoadedTool,
  host: HostV1,
  initialState: Record<string, InputValue> = {},
  opts: { composeStack?: readonly string[]; hookExecutor?: HookExecutor } = {},
): Promise<Runtime> {
  if (host.version !== '1') {
    throw new Error(`Tool requires host bridge v1, got v${host.version}`);
  }
  // Manifest `requires`: the optional host.* APIs the tool calls unguarded.
  // Refuse here, before any hook runs, instead of letting the first hook throw
  // inside its time box on a shell that lacks the API.
  const unmetApis = missingRequires(tool.manifest.requires, host as Partial<Record<HostApiName, unknown>>);
  if (unmetApis.length) {
    throw new Error(
      `"${tool.manifest.id}" requires host.${unmetApis.join(', host.')} and this ${host.shell} shell does not provide ` +
      `${unmetApis.length === 1 ? 'it' : 'them'}`,
    );
  }
  // Seed before onInit so tool-owned text rendering uses the same default as the
  // DOM pass. The listing is metadata only; artwork stays on demand.
  let emojiSets: EmojiSetInfoV1[] | undefined = host.emoji ? await host.emoji.sets().catch(() => []) : undefined;
  let emojiStyle: EmojiStyleV1 | null = defaultEmojiStyle(emojiSets ?? []);
  type ToolEmoji = ReturnType<typeof import('./emoji-tool-text.ts')['createEmojiToolText']>;
  let toolEmoji: ToolEmoji | null = null;
  const emojiApi = host.emoji, textApi = host.text;
  let toolEmojiPending: Promise<ToolEmoji> | undefined;
  const toolEmojiService = () => toolEmojiPending ??= import('./emoji-tool-text.ts').then(mod => {
    toolEmoji = mod.createEmojiToolText(emojiApi!,textApi,() => emojiStyle); return toolEmoji;
  });
  if (emojiApi) host = { ...host, emoji: { ...emojiApi,
    renderText: async value => (await toolEmojiService()).renderText(value),
    renderSvg: async value => (await toolEmojiService()).renderSvg(value),
  } };
  if (textApi?.layoutRuns && emojiApi) host = { ...host, text: { ...textApi, layoutRuns: async request => (await toolEmojiService()).layoutRuns(request) } };
  let textLayoutCache: ReturnType<typeof import('./text-layout-cache.ts')['createTextLayoutCache']> | undefined;
  const scopedLayout = host.text?.layoutRuns;
  if (scopedLayout) host = { ...host,text:{...host.text!,layoutRuns:async request => {
    const cache = await import('./text-layout-cache.ts'); textLayoutCache ??= cache.createTextLayoutCache();
    const key = cache.textLayoutKey(request), dependency = JSON.stringify(emojiStyle);
    const result = await scopedLayout(request); textLayoutCache.remember(key,dependency,result); return result;
  }} };
  const composeStack = opts.composeStack ?? [];
  // Per-runtime memo so resolveNestedRenders skips re-rendering a child whose
  // bound inputs are unchanged across keystrokes.
  const composeMemo: ComposeMemo = new Map();
  // Monotonic id so an out-of-order (slow) nested render from an earlier
  // setInput can't overwrite a newer value's render - see setInput below.
  let setInputSeq = 0;

  const profile = await host.profile.get();
  const hookLang = tool.lang || profile.lang || 'en';
  // buildInputModel reads the profile as a string-keyed lookup (bindToProfile);
  // Profile is an interface (no implicit index signature), so hand it over as a
  // fresh ProfileValues object. Read-only downstream, so the copy is a no-op.
  // The person's saved templates ride the same record (plans/226) but are never
  // a bind target, and their shape is not an input value, so they stay out. The
  // emoji preference (plans/252) is the same: a seed the shell reads when it
  // opens new work, never a value a tool input can bind to.
  const { userTemplates: _templates, emoji: _emojiPref, ...profileValues } = profile;
  void _templates;
  void _emojiPref;
  const pendingDesignIssues = new Map<string, string>();
  if (tool.manifest.designTool) {
    const bound: Record<string, unknown> = {};
    for (const input of tool.manifest.inputs) if (input.bindToProfile && Object.hasOwn(profileValues,input.bindToProfile)) bound[input.id] = profileValues[input.bindToProfile as keyof typeof profileValues];
    assertDesignValues(tool.manifest.designTool, {...bound,...initialState});
  }
  let model = buildInputModel(tool.manifest, { profile: profileValues, initial: initialState });

  // The set of declared input ids is fixed for the life of the runtime (only
  // values change across keystrokes), so build it once here and reuse it in
  // mergePatch rather than rebuilding a Set on every hook patch.
  const inputIds = new Set(model.map(i => i.id));

  // Hook failures recorded for the shell: onInit blanking the canvas was
  // previously only logged, so a shell had no way to show its error banner.
  // The array is exposed on the runtime; entries: { hook, message }.
  const hookErrors: HookError[] = [];

  // Resolve any unresolved asset refs (from URL mode or a saved session). Any
  // that no longer resolve (e.g. a user deleted an image a saved design used) are
  // collected so the shell can tell the user the field was left blank.
  const droppedAssets: DroppedAsset[] = [];
  model = await resolveAssetRefs(model, host, droppedAssets, composeStack, tool.manifest.id);
  if (tool.manifest.designTool) assertDesignValues(tool.manifest.designTool, modelToValues(model));

  // Resolve token-referenced colour values (from URL mode or a saved session)
  // against the live token set, refreshing each cached hex so a token edit
  // propagates. Mirrors resolveAssetRefs; a no-op on shells without host.tokens.
  model = await resolveTokenRefs(model, host);

  // extras: hook-computed values that have no matching input id.
  // Available to templates alongside input values.
  let extras: Record<string, unknown> = {};

  // Run one lifecycle hook under its HOOK_BUDGET_MS budget. An async result is
  // raced: a timeout rejects HERE (the caller logs/records it and applies no
  // patch NOW). The hook itself is NOT cancelled (no in-realm preemption). A
  // synchronous hook has already finished by the time we can look at the clock,
  // so a sync overrun is just measured and logged as a warning; its result
  // still counts. A sync throw propagates to the caller's handler, same as before.
  //
  // `onLate` (v1.146, onInit/onInput only): when the raced-out hook eventually
  // RESOLVES, its patch is applied after all - but only if no newer onInit/
  // onInput run has started since (hookRunSeq). Before this, a first analysis
  // that outran its budget (e.g. the audiogram's cold audio decode) left the
  // card permanently stale with nothing to retry it; now it heals the moment
  // the work resolves, while a superseding keystroke still wins. Export hooks
  // never late-apply: a budget overrun there fails that export visibly.
  let hookRunSeq = 0;
  function runHook(
    name: keyof typeof HOOK_BUDGET_MS,
    invoke: (report?: (patch: Record<string, unknown>) => void) => unknown,
    onLate?: (patch: unknown) => void,
  ): Promise<unknown> {
    const budget = HOOK_BUDGET_MS[name];
    const started = Date.now();
    // Every onInit/onInput invocation - sync or async - supersedes earlier
    // pending late patches; a sync run that skipped the bump would let a stale
    // async result land on top of it.
    const seq = onLate ? ++hookRunSeq : 0;
    let finished = false;
    const report = onLate ? (patch: Record<string, unknown>) => {
      if (!finished && seq === hookRunSeq) onLate(patch);
    } : undefined;
    const out = invoke(report);
    if (out == null || typeof (out as { then?: unknown }).then !== 'function') {
      const elapsed = Date.now() - started;
      if (elapsed > budget) {
        host.log('warn', `${name} ran ${elapsed}ms synchronously (budget ${budget}ms - sync hooks can't be preempted)`, { toolId: tool.manifest.id });
      }
      return Promise.resolve(out);
    }
    const p = Promise.resolve(out).then(patch => {
      finished = true;
      return onLate && seq !== hookRunSeq ? null : patch;
    }, error => { finished = true; throw error; });
    if (!onLate) return withTimeout(p, budget, tool.manifest.id);
    return withTimeout(p, budget, tool.manifest.id).catch((err: unknown) => {
      // Timed out (a hook REJECTION reaches this catch too, but then the late .then
      // below never fires). Keep listening for the real result.
      p.then((patch) => {
        if (seq !== hookRunSeq || !patch) return;
        host.log('info', `${name} finished ${Date.now() - started}ms in (budget ${budget}ms) - applying late, still the newest run`, { toolId: tool.manifest.id });
        onLate(patch);
      }, () => { /* the timeout already told the story */ });
      throw err;
    });
  }

  const listeners = new Set<(state: RuntimeState) => void>();
  // Hydrate ONCE per change, not once per subscriber: every listener gets the same
  // immutable snapshot (both current subscribers are read-only). A two-subscriber
  // editor (design, carousel-maker) otherwise ran a full template render twice.
  // Declared above the hooks block because a LATE onInit patch (runHook's onLate)
  // has to re-emit; it only ever runs after mount, when getHydrated exists.
  const emit = () => {
    const state = { model, hydrated: getHydrated() };
    listeners.forEach(fn => fn(state));
  };
  // Shared late-patch application for onInit/onInput: merge, then repaint.
  const applyLatePatch = (patch: unknown): void => {
    ({ model, extras } = mergePatch(model, extras, patch, inputIds));
    // During onInit template caches are not initialized and there are no listeners.
    if (listeners.size) emit();
  };

  let hooks: Hooks | null = null;
  if (tool.hooksSource && tool.manifest.hooks) {
    // The executor produces the Hooks object. Default = in-realm `new Function`
    // (unchanged). A shell may inject a Worker-isolated one via opts.hookExecutor
    // (plans/86-worker-isolation-hooks.md M2); its slots return Promises that
    // runHook time-boxes exactly like async in-realm hooks. The engine never
    // constructs a Worker - it only accepts an executor.
    hooks = await (opts.hookExecutor ?? inRealmHookExecutor)(tool, host);
    const onInit = hooks.onInit;
    if (onInit) {
      try {
        const patch = await runHook('onInit', report => onInit({ model: modelForHooks(model), lang: hookLang, host, report }), applyLatePatch);
        if (patch) ({ model, extras } = mergePatch(model, extras, patch, inputIds));
      } catch (e) {
        // Record the failure (not just log it) so the shell can show a canvas-error
        // banner instead of silently hydrating against missing extras. Still don't
        // throw - the lifecycle stays resilient and the canvas renders what it can.
        hookErrors.push({ hook: 'onInit', message: (e as Error).message });
        host.log('error', `onInit ${(e as Error).message}`, { toolId: tool.manifest.id });
      }
    }
  }

  // Nested renders (manifest `composes`): render referenced tools to embeddable
  // assets and expose them as extras for `{{asset <id>}}`. Awaited here so the
  // first paint already carries the embed. A no-op without host.compose.
  extras = { ...extras, ...await resolveNestedRenders(tool, model, extras, host, composeStack, composeMemo) };

  // ── Live media (onFrame) ────────────────────────────────────────────────────
  // When a shell drives a camera (host.media) AND the tool declares an `onFrame`
  // hook, the runtime can run that hook once per camera frame so the render reacts
  // to live motion. The SHELL owns the camera + the grab loop and hands us plain
  // RGBA frames (no DOM types), so the engine stays platform-agnostic; we just run
  // onFrame → merge its patch → emit, exactly like a keystroke. Overlapping frames
  // are DROPPED (a new frame is processed only once the previous onFrame settled),
  // so a slow per-frame trace self-throttles instead of piling up.
  let liveUnsub: (() => void) | null = null;
  let liveGeneration = 0;
  let liveStarting = false;
  let destroyed = false;
  // Re-applies the live working-frame resolution while the camera is running, when the
  // input named by `render.liveMaxEdgeInput` changes (a user resolution slider). Set in
  // startLive, cleared in stopLive; null when not live.
  let liveResubscribe: (() => void) | null = null;
  let framePending = false;
  // Set while a deterministic export DRIVE runs (applyFrameForExport per frame): the live
  // subscribe stays wired (media source + refcount intact, so renderFrameAt still works)
  // but its callback stops repainting, so a real-time frame can't clobber the exact frame
  // the export is capturing. isLive() stays true throughout - this is a pause, not a stop.
  let livePaused = false;
  const isLive = () => liveUnsub != null;
  function stopLive(): void {
    // A permission/device request can settle after navigation. Invalidate it even
    // before there is a subscription; its continuation releases its own reference.
    liveGeneration++;
    liveStarting = false;
    const unsubscribe = liveUnsub;
    liveUnsub = null;
    liveResubscribe = null;
    if (!unsubscribe) return;
    try { unsubscribe(); }
    finally { try { host.media?.stop(); } catch { /* already torn down */ } }
  }

  // Working long-edge (px) for live-camera frames. A tool can expose it as a normal
  // input via `render.liveMaxEdgeInput` so the user scrubs resolution live; otherwise
  // the static `render.liveMaxEdge` hint. Undefined → the shell's own default. The
  // shell clamps whatever we pass to the native frame and its own ceiling.
  const liveEdge = (): number | undefined => {
    const inputId = tool.manifest.render?.liveMaxEdgeInput as string | undefined;
    if (inputId) {
      const v = Number(model.find(i => i.id === inputId)?.value);
      if (Number.isFinite(v) && v > 0) return Math.round(v);
    }
    return tool.manifest.render?.liveMaxEdge;
  };

  // ── Live-capture provenance (C2PA) ────────────────────────────────────────────
  // Whether the CURRENT render's essence came from a device sensor, so the export
  // can declare it honestly (IPTC digitalCapture) instead of assuming software
  // creation. `liveCameraShown` tracks a filter tool's live frame: set when onFrame
  // drives a render, cleared when the user swaps the image SOURCE (an asset/file/url
  // input) - a scalar tweak keeps it (while live, the next frame re-sets it anyway).
  // `recordedCamera`/`recordedMic` are sticky once a recorder tool finalises a take
  // (the recording IS the content, re-composited across edits); a fresh take re-sets
  // them per the captured MIME + the tool's declared capabilities.
  let liveCameraShown = false;
  let recordedCamera = false;
  let recordedMic = false;
  // A SCREEN take is a distinct origin from a camera take - IPTC screenCapture, not
  // digitalCapture. Tracked separately so a screenshot exported after a screen recording
  // never inherits the camera's "captured live from the camera" claim (which would be a
  // false statement in a signed manifest). `recordSource` is the source of the in-flight
  // take; `recordMicActive` is whether that take actually got a mic (a screen take can be
  // denied the mic and still record), so provenance/UX reflect what was captured.
  let recordedScreen = false;
  let recordSource: 'device' | 'screen' | undefined;
  let recordMicActive: boolean | undefined;
  const toolCaps = new Set(tool.manifest.capabilities ?? []);

  // ── Audio level meter + recording (onLevel) ───────────────────────────────────
  // The audio counterpart to the onFrame camera loop. host.recorder pushes plain
  // AudioLevel numbers (no DOM), the runtime runs the tool's `onLevel` hook per
  // sample and merges its patch → emit, exactly like onFrame. Overlapping samples
  // are DROPPED so a slow coaching hook self-throttles. Two entry points share one
  // driver: startMeter (a pre-record sound-check off host.recorder.meter) and
  // startRecording (off the live RecordSession, so the sound-check and the take use
  // the single mic the shell opened - no double prompt). A video tool with NO
  // onLevel still records; driveLevels just becomes a no-op subscription.
  let meterUnsub: (() => void) | null = null;      // active onLevel subscription (either source)
  let stopMeterSource: (() => void) | null = null; // release the mic ref (meter.stop) - meter path only
  let meterGeneration = 0;
  let meterStarting = false;
  let levelGeneration = 0;
  let recordGeneration = 0;
  let recordStarting = false;
  let recordSession: RecordSession | null = null;

  // Subscribe onLevel to any level source ({ subscribe(cb) }) - the mic meter or a
  // live RecordSession - with the same drop-overlap throttle as onFrame. Returns the
  // unsubscribe. A no-op subscription when the tool declares no onLevel.
  function driveLevels(source: { subscribe(cb: (l: AudioLevel) => void): () => void }): () => void {
    const generation = ++levelGeneration;
    let pending = false;
    const onLevel = hooks?.onLevel;
    if (!onLevel) return () => {};
    return source.subscribe((level) => {
      if (pending || generation !== levelGeneration || destroyed) return;
      pending = true;
      Promise.resolve(onLevel({ level, model: modelForHooks(model), lang: hookLang, host }))
        .then((patch) => {
          if (patch && meterUnsub && generation === levelGeneration && !destroyed) {
            ({ model, extras } = mergePatch(model, extras, patch, inputIds)); emit();
          }
        })
        .catch((e: unknown) => host.log('warn', `onLevel ${(e as Error).message}`, { toolId: tool.manifest.id }))
        .finally(() => { pending = false; });
    });
  }

  // Stop the level-meter loop + release the mic reference (idempotent). Recording
  // uses its own session teardown (see stopRecording/cancelRecording), so this only
  // calls meter.stop() when the meter path opened the mic.
  function stopMeterLoop() {
    ++meterGeneration;
    meterStarting = false;
    stopLevels();
    const stop = stopMeterSource;
    stopMeterSource = null;
    try { stop?.(); } catch { /* already torn down */ }
  }

  function stopLevels() {
    ++levelGeneration;
    const unsubscribe = meterUnsub;
    meterUnsub = null;
    try { unsubscribe?.(); } catch { /* already torn down */ }
  }

  function cancelRecording() {
    ++recordGeneration;
    recordStarting = false;
    const session = recordSession;
    recordSession = null;
    if (!session) return;
    stopLevels();
    try { session.cancel(); } catch { /* already torn down */ }
  }

  // The template context (flattened input values + hook extras) is rebuilt only
  // when `model` or `extras` is replaced. Both are swapped wholesale on every
  // mutation - updateInput/mergePatch/resolve* return fresh objects, never patch
  // in place - so reference equality is a sound cache key. This avoids
  // re-flattening the whole model on every render/emit (one emit per keystroke),
  // and Handlebars never mutates the data object so the cached one is safe to
  // share across the main template + data-format (raw) hydrations.
  let ctxCache: Record<string, unknown> | null = null;
  let ctxModel: InputModelItem[] | null = null;
  let ctxExtras: Record<string, unknown> | null = null;
  function templateContext(): Record<string, unknown> {
    if (ctxModel !== model || ctxExtras !== extras) {
      ctxCache = { ...modelToValues(model), ...extras };
      ctxModel = model;
      ctxExtras = extras;
    }
    // First call always rebuilds (ctxModel starts null !== model), so ctxCache
    // is set before any return - the assertion just erases the nullable type.
    return ctxCache!;
  }

  // Resolve the `data-lolly-paint` markers annotateTemplate left into
  // `data-lolly-bind` token bindings using the model's still-linked colour inputs
  // (plans/222), so an inherited colour survives the flatten-to-hex into the DOM
  // the export reads. A single indexOf no-ops the common (no markers) case.
  function bindPaint(html: string): string {
    return resolvePaintBindings(html, tokenBindingsOf(model));
  }

  function getHydrated(): string {
    const pag = tool.manifest.render?.paginate;
    const html = pag?.source ? hydratePaginated(pag.source) : bindPaint(hydrate(tool.template, templateContext()));
    return tool.presentationSource && tool.trustClass !== 'remote-untrusted' && tool.trustClass !== 'sideloaded-consented'
      ? html + '<script data-tool-presentation>' + tool.presentationSource.replace(/<\/script/gi, '<\\/script') + '</script>'
      : html;
  }

  // Engine-driven pagination (render.paginate): hydrate the template once per
  // row of the named table input, each wrapped in its own [data-pdf-page] box,
  // so the tool authors ONE page and the paged export/preview paths see N.
  // Each hydration's context gains a `page` object:
  //   index/number/count - 0-based, 1-based, total pages
  //   first              - the row's first cell (the natural page title)
  //   cells              - [{ column, value, col }] for every column (col is the
  //                        original column index, so a template can address the
  //                        cell - e.g. a data-cell="row:col" edit marker - even
  //                        when it renders only a subset of the columns)
  //   fields             - cells minus the first (the labelled body fields)
  //   byColumn           - trimmed lower-cased column name → the row's cell, for
  //                        by-name lookup ({{lookup page.byColumn "icon"}}); the
  //                        first matching column wins. Null-prototype, so a column
  //                        the user names "constructor" can't shadow a real key.
  // Zero rows (or a non-table source) still emits one page so the canvas is
  // never blank while the user is assembling their table.
  function hydratePaginated(sourceId: string): string {
    const base = templateContext();
    const t = normalizeTableValue(model.find(i => i.id === sourceId)?.value);
    const rows = t && t.rows.length ? t.rows : [[]];
    const columns = t?.columns ?? [];
    const count = rows.length;
    return rows.map((row, index) => {
      const cells = columns.map((column, i) => ({ column, value: row[i] ?? '', col: i }));
      const byColumn: Record<string, string> = Object.create(null);
      columns.forEach((column, i) => {
        const k = column.trim().toLowerCase();
        if (k && !(k in byColumn)) byColumn[k] = row[i] ?? '';
      });
      const page = {
        index, number: index + 1, count,
        first: row[0] ?? '', cells, fields: cells.slice(1), byColumn,
      };
      const body = bindPaint(hydrate(tool.template, { ...base, page }));
      return `<section data-pdf-page class="lolly-page" data-page-index="${index}">${body}</section>`;
    }).join('');
  }

  // Hydrate an arbitrary template string against the SAME context as the main
  // template (input values + hook extras). Used by shells for things like a
  // live accessible-label summary of the current render (manifest.a11yLabel).
  function getHydratedString(str: string | null | undefined): string {
    return str ? hydrate(str, templateContext()) : '';
  }

  // Same context, but WITHOUT HTML escaping - for non-HTML data templates
  // (template.ics/.vcf/.csv). Each data format escapes via its own helper.
  function getHydratedText(str: string): string {
    return str ? hydrate(str, templateContext(), { raw: true }) : '';
  }

  // ── Emoji: pinned pack artwork over every rendered tree ────────────────────
  // The runtime owns this so no tool has to. The shell calls the pass after each
  // paint (a live canvas) and export() calls it again on the node it is about to
  // render, so a mount site that forgot the live call still exports artwork
  // rather than whatever font the machine happened to have.

  let emojiCensus: EmojiLineSource[] = [];
  let emojiReplaced = 0, emojiUnresolved = 0;
  // The last tree the pass ran on, so changing the set re-draws what is on screen.
  let emojiNode: unknown = null;
  // Prepared plus treated artwork, keyed by pack pin, meaning and treatment, so a
  // glyph used a hundred times is prepared once and a repaint prepares nothing.
  const emojiArtwork: EmojiArtworkCache = new Map();
  // One admission per pin for the life of this mount.
  const emojiPacks = new Map<string, Promise<VerifiedEmojiPack | null>>();
  const emojiListeners = new Set<(state: RuntimeEmojiState) => void>();
  let emojiChain: Promise<unknown> = Promise.resolve();

  /**
   * Cheapest possible gate, and the reason a plain Latin render pays nothing for
   * this feature: the pinned Unicode tables are half a megabyte, so they are
   * loaded on demand, and no character at or above U+00A9 means no emoji of any
   * kind. U+00A9 (copyright) is the lowest scalar the pass's own pre-check looks
   * for, so this is a true superset of it and never hides a real emoji. Written
   * as an escaped range, so this file carries no invisible characters.
   */
  const EMOJI_MAYBE = /[\u00A9-\uFFFF]/;

  let emojiAssets: import('@lolly-tools/core/host-v1').AssetRef[] = [];
  let emojiStyleGeneration = 0;
  const emojiSnapshot = (): RuntimeEmojiState => ({
    assets: structuredClone(emojiAssets),
    present: Boolean(host.emoji),
    replaced: emojiReplaced,
    unresolved: emojiUnresolved,
    style: emojiStyle ? structuredClone(emojiStyle) : null,
    ...(emojiSets ? { sets: structuredClone(emojiSets) } : {}),
  });

  function notifyEmoji(): void {
    if (!emojiListeners.size) return;
    const state = emojiSnapshot();
    for (const listener of [...emojiListeners]) {
      try { listener(state); } catch (e) { host.log('warn', `onEmojiChange ${(e as Error).message}`, { toolId: tool.manifest.id }); }
    }
  }

  /** One pass at a time: two paints in flight must not rewrite one tree together. */
  function queueEmoji<T>(fn: () => Promise<T>): Promise<T> {
    const run = emojiChain.then(fn, fn);
    emojiChain = run.then(() => undefined, () => undefined);
    return run;
  }

  /** Admit the style's primary pin and its ordered fallbacks, once each. */
  async function emojiPacksFor(style: EmojiStyleV1): Promise<VerifiedEmojiPack[]> {
    const api = host.emoji;
    if (!api) return [];
    const { emojiPackPinKey, readEmojiPack } = await import('./emoji-pack.ts');
    const out: VerifiedEmojiPack[] = [];
    for (const pin of [style.primary, ...style.fallbacks]) {
      const key = emojiPackPinKey(pin);
      let pending = emojiPacks.get(key);
      if (!pending) {
        pending = (async () => {
          const bytes = await api.manifest(pin);
          // A host that does not have this exact release answers null, never a
          // substitute, so the pass draws its placeholder instead of a different
          // picture. That refusal is the whole point of pinning. It is said out
          // loud, because a link naming a set this device does not hold otherwise
          // degrades to a page of placeholder squares with nothing to read.
          if (!bytes) {
            host.log('warn', `emoji set ${pin.id} ${pin.pin.version} is not on this device - drawing placeholders`, { toolId: tool.manifest.id });
            return null;
          }
          const read = await readEmojiPack(bytes, pin);
          if (read.ok) return read.pack;
          host.log('warn', `emoji set ${pin.id}: ${read.issue.message}`, { toolId: tool.manifest.id });
          return null;
        })().catch((e: unknown) => {
          host.log('warn', `emoji set ${pin.id}: ${(e as Error).message}`, { toolId: tool.manifest.id });
          return null;
        });
        emojiPacks.set(key, pending);
      }
      const pack = await pending;
      if (pack) out.push(pack);
    }
    return out;
  }

  /** Listed once per mount, in the background, so the chrome can offer a choice. */
  async function loadEmojiSets(): Promise<void> {
    const api = host.emoji;
    if (!api || emojiSets) return;
    try { emojiSets = await api.sets(); } catch { emojiSets = []; }
    notifyEmoji();
  }

  async function runEmojiPass(
    node: unknown, opts: RuntimeEmojiPassOpts = {},
  ): Promise<RuntimeEmojiResult> {
    const api = host.emoji;
    // A pass queued before the shell unmounted must not run now, and above all
    // must not take a fresh reference to a tree destroy() just let go of.
    if (destroyed) return { present: true, replaced: 0, unresolved: 0, census: [] };
    const root = node as { textContent?: string | null } | null | undefined;
    if (!root || typeof root !== 'object') return { present: true, replaced: 0, unresolved: 0, census: [] };
    const portableNodes=(root as {querySelectorAll?:(selector:string)=>ArrayLike<{getAttribute(name:string):string|null;closest?:(selector:string)=>unknown}>}).querySelectorAll?.('[data-emoji-vector-sources]');
    let portable:EmojiLineSource[]=[];
    if(portableNodes?.length){const {readEmojiSourceRecords,mergeEmojiSourceRecords}=await import('./emoji-source-records.ts');portable=mergeEmojiSourceRecords(Array.from(portableNodes).filter(element=>!element.closest?.('[data-export-hide]')).flatMap(element=>readEmojiSourceRecords(element.getAttribute('data-emoji-vector-sources'))));}
    if(!api){if(opts.track!==false)emojiCensus=portable;return {present:false,replaced:0,unresolved:0,census:portable};}
    // A tracked pass IS the render. An untracked one (chrome drawing its own
    // emoji) draws artwork, reports what it drew and records nothing: it neither
    // becomes the tree a set change redraws nor rewrites the counts the Emoji
    // section reads, so a one-cell walk cannot hide the section over a canvas
    // full of emoji.
    const track = opts.track !== false;
    const nothing: EmojiDomResult = { replaced: 0, unresolved: 0, census: [] };
    const record = (result: EmojiDomResult): void => {
      const geometrySources=(root as {querySelectorAll?:(selector:string)=>ArrayLike<{getAttribute(name:string):string|null;closest?:(selector:string)=>unknown}>}).querySelectorAll?.('[data-emoji-tool-source]');
      const combined=[...result.census,...portable,...(toolEmoji?.censusFor(Array.from(geometrySources??[]).filter(element=>!element.closest?.('[data-export-hide]')).map(element=>element.getAttribute('data-emoji-tool-source')??''))??[])];
      const distinct=new Map<string,EmojiLineSource>();for(const source of combined){const key=`${source.pack.checksum}:${source.assetId}:${source.canonicalChecksum}`;if(!distinct.has(key))distinct.set(key,source);}
      result.census=[...distinct.values()];
      if (!track) return;
      emojiReplaced = result.replaced;
      const missingParagraph = (root as {querySelectorAll?: (selector:string) => ArrayLike<{getAttribute(name:string):string|null}>}).querySelectorAll?.('[data-text-emoji-missing]');
      emojiUnresolved = result.unresolved + Array.from(missingParagraph ?? []).reduce((count, el) => count + Math.max(0, Number(el.getAttribute('data-text-emoji-missing')) || 0), 0);
      emojiCensus = result.census;
      notifyEmoji();
    };
    if (track) emojiNode = root;
    if (!EMOJI_MAYBE.test(root.textContent ?? '') && !(root as {querySelector?: (selector:string) => unknown}).querySelector?.('[data-emoji-tool-source]')) {
      record(nothing);
      return { present: true, ...nothing };
    }
    // One read, held across every await below. setEmojiStyle assigns
    // synchronously and queues its own pass, so a swap landing during the pack
    // load would otherwise resolve the NEW style's pin against the OLD style's
    // packs and draw the whole tree as placeholders for a frame.
    const style = emojiStyle;
    // Nothing to choose means nothing to prompt for. With no set chosen AND no
    // set on the device, the placeholder would mark every emoji with a mark
    // nobody can clear, so the characters are left exactly as they are. A set
    // that exists but has not been chosen, and a chosen set that lacks a glyph,
    // both still draw the placeholder: those are choices a person can act on.
    if (!style) {
      await loadEmojiSets();
      if (!emojiSets?.length) {
        record(nothing);
        return { present: true, ...nothing };
      }
    }
    const packs = style ? await emojiPacksFor(style) : [];
    const { applyEmojiToDom } = await import('./emoji-dom.ts');
    const io: EmojiTextIO = {
      async loadArtwork(pin, asset) {
        const bytes = await api.artwork(pin, asset);
        if (!bytes) throw new Error(`emoji artwork missing: ${asset.id}`);
        return bytes;
      },
      // The contract types the parser's result as unknown so the SDK carries no
      // DOM types; the engine is where it is narrowed, and the static subset
      // refuses anything the parser hands back that is not a real SVG document.
      parseXml: api.parseXml as EmojiTextIO['parseXml'],
    };
    const result = await applyEmojiToDom(
      root as EmojiDomNode, style, packs, io, { cache: emojiArtwork, idScope: opts.idScope },
    );
    const { applyEmojiToSvgText } = await import('./emoji-svg-text.ts');
    const svg = await applyEmojiToSvgText(root, style, packs, io, host.text, { cache: emojiArtwork, idScope: opts.idScope });
    result.replaced += svg.replaced; result.unresolved += svg.unresolved;
    for (const source of svg.census) {
      const prior = result.census.find(item => item.pack.checksum === source.pack.checksum && item.assetId === source.assetId && item.canonicalChecksum === source.canonicalChecksum);
      if (prior) prior.occurrences.push(...source.occurrences); else result.census.push(source);
    }
    record(result);
    // Only list the sets once this render has shown it cares - a set was chosen,
    // or the text carries emoji somebody may want to choose a set for.
    if (!emojiSets && (style || result.replaced || result.unresolved)) void loadEmojiSets();
    return { present: true, ...result };
  }

  // ── Creative rights: what the recorded sources ask of this delivery ────────
  // The emoji census is the first producer of works and uses; others (a placed
  // catalog illustration, a LUT) join the same list without changing anything
  // downstream. The rules are pure data in rights-profiles.ts, the evaluation
  // reads no clock and no file, and the decisions a person made live here for
  // the life of the mount so a session can save them.
  let rightsChoices: RightsDecisionV1[] = [];
  let declaredLicence: string | null = null;
  let lastRightsReceipt: AttributionReceiptV1 | null = null;

  /** The delivery a context describes, with this tool's own defaults underneath. */
  function rightsContext(context: RuntimeRightsContext | undefined, fallbackFormat?: string): UseContextV1 {
    const given = context?.delivery ?? {};
    const format = given.format ?? fallbackFormat ?? tool.manifest.render?.formats?.[0] ?? 'png';
    // A credential is promised only where one is actually being written, which
    // is why this asks the tool's own provenance default rather than a list of
    // formats: promising an ingredient a route never carries is the one thing
    // section 4.3 forbids. The receipt measures the truth afterwards either way.
    const carriesCredential = !['lottie', 'jxl', 'jxl-lossless'].includes(format) && (given.canCarryCredential ?? (tool.manifest.render?.c2pa !== false && tool.manifest.privacy !== 'on-device'));
    const route: DeliveryRouteV1 = given.route ?? (format === 'lottie' ? 'package' : carriesCredential ? 'file-with-c2pa' : 'file-without-c2pa');
    return {
      operation: context?.operation ?? 'render',
      delivery: {
        format,
        route,
        canCarryCredential: !['lottie', 'jxl', 'jxl-lossless'].includes(format) && (given.canCarryCredential ?? (route === 'file-with-c2pa' || route === 'package')),
        // A clipboard carries pixels and nothing beside them; every other route
        // here has somewhere a reader can find the credit.
        canCarryReadableCredit: !['jxl', 'jxl-lossless'].includes(format) && (given.canCarryReadableCredit ?? route !== 'clipboard'),
      },
      audience: context?.audience ?? 'unknown',
      ...(context?.commercial !== undefined ? { commercial: context.commercial } : {}),
      ...(context?.outputLicence !== undefined ? { outputLicence: context.outputLicence }
        : declaredLicence ? { outputLicence: declaredLicence } : {}),
      ...(context?.evaluatedAt !== undefined ? { evaluatedAt: context.evaluatedAt } : {}),
    };
  }

  /**
   * One evaluation over one census, and the records it was made from. An export
   * freezes the census first and hands the same answer to both the credential
   * and the plan, so the bytes and the credits can never describe two states.
   */
  function evaluateRights(census: readonly EmojiLineSource[], context: RuntimeRightsContext | undefined, fallbackFormat?: string): {
    evaluation: RightsEvaluationV1; works: CreativeWorkRecordV1[]; uses: CreativeUseV1[]; details: Record<string, SourceDetailV1>;
  } {
    const { works, uses, details } = emojiWorksAndUses(census);
    const evaluation = evaluateCreativeUses({ works, uses, details, context: rightsContext(context, fallbackFormat), decisions: rightsChoices });
    return { evaluation, works, uses, details };
  }

  return {
    getModel: () => model,
    getHydrated,
    getHydratedString,
    getHydratedText,

    applyEmojiToDom: (node, opts) => queueEmoji(() => runEmojiPass(node, opts)),
    revertEmojiDom: (node) => queueEmoji(async () => {
      if (!node || typeof node !== 'object') return 0;
      const { revertEmojiDom } = await import('./emoji-dom.ts');
      return revertEmojiDom(node as EmojiDomNode);
    }),
    async setEmojiStyle(style) {
      if (style) { const issue = (await import('./emoji-pack.ts')).validateEmojiStyle(style); if (issue) throw new Error(issue.message); }
      const generation = ++emojiStyleGeneration;
      const next = style ? structuredClone(style) : null;
      const assets = next && host.emoji?.dependencies ? await host.emoji.dependencies([next.primary, ...next.fallbacks]) : [];
      if (generation !== emojiStyleGeneration) return;
      emojiAssets = assets;
      emojiStyle = next;
      if (toolEmoji?.used && hooks?.onInput) {
        const seq = setInputSeq;
        const patch = await runHook('onInput', report => hooks!.onInput!({id:'__emoji', value:null, model:modelForHooks(model), host, report}), late => {
          if (generation === emojiStyleGeneration && seq === setInputSeq) applyLatePatch(late);
        });
        if (generation !== emojiStyleGeneration || seq !== setInputSeq) return;
        if (patch) { ({model, extras} = mergePatch(model,extras,patch,inputIds)); emit(); }
      }
      // The prepared-artwork cache is keyed by pin, meaning and treatment, so the
      // old style's entries stay valid and switching back costs nothing.
      if (emojiNode) await queueEmoji(() => runEmojiPass(emojiNode));
      else notifyEmoji();
    },
    get emoji() { return emojiSnapshot(); },
    onEmojiChange(fn) {
      emojiListeners.add(fn);
      return () => { emojiListeners.delete(fn); };
    },
    emojiIngredients: () => emojiSourceIngredients(emojiCensus),
    emojiCredits: () => emojiCreditsText(emojiCensus),
    async layoutText(request) { if (!host.text?.layoutRuns) throw new Error('This host cannot compose text paragraphs.'); return host.text.layoutRuns(request); },

    peekTextLayout: request => textLayoutCache?.peek(request,JSON.stringify(emojiStyle)) ?? null,

    rights: (context) => evaluateRights(emojiCensus, context).evaluation,
    setRightsDecision(decision) {
      rightsChoices = [
        ...rightsChoices.filter((held) => !(held.work === decision.work && held.kind === decision.kind)),
        { ...decision },
      ];
    },
    rightsDecisions: () => rightsChoices.map((decision) => ({ ...decision })),
    setOutputLicence(id) { declaredLicence = outputLicenceId(id); },
    outputLicence: () => declaredLicence,
    setRightsDecisions(decisions) {
      // Deduped by work and kind, keeping the last, exactly as setRightsDecision
      // does. A restored list that named one work twice would otherwise let the
      // order of a stored array decide which choice applies.
      // Keyed through JSON, because a work id is arbitrary text out of a pack
      // manifest and a key glued together with a separator could be made to
      // collide with another pair.
      const held = new Map<string, RightsDecisionV1>();
      for (const decision of decisions) held.set(JSON.stringify([decision.work, decision.kind]), { ...decision });
      rightsChoices = [...held.values()];
    },
    get lastReceipt() { return lastRightsReceipt; },

    manifest: tool.manifest,
    styles: tool.styles,
    // Asset refs (from a saved session / URL) that no longer resolve. The shell
    // reads this once after mount to surface a "left blank" notice.
    droppedAssets,
    // Hook failures (currently onInit) so a shell can show a canvas-error banner
    // instead of a silently-blank canvas. Empty when every hook ran cleanly.
    hookErrors,

    // Deterministic export drive (see the interface doc): onFrame → mergePatch → hydrate,
    // with no rAF loop and no subscriber emit. Mirrors the live onFrame handling in
    // startLive, minus the drop-guard and the provenance flag (never a sensor here).
    async applyFrameForExport(frame) {
      const onFrame = hooks?.onFrame;
      if (!onFrame) return null;
      try {
        const patch = await onFrame({ frame, model: modelForHooks(model), lang: hookLang, host });
        if (patch) ({ model, extras } = mergePatch(model, extras, patch, inputIds));
        return getHydrated();
      } catch (e) {
        host.log('warn', `onFrame (export) ${(e as Error).message}`, { toolId: tool.manifest.id });
        return null;
      }
    },
    pauseLive() { livePaused = true; },
    resumeLive() { livePaused = false; },

    async setInput(id, value) {
      if (tool.manifest.designTool) {
        if (!tool.manifest.inputs.some(i => i.id === id)) throw new Error('This property is fixed by the designer.');
        try { assertDesignValues(tool.manifest.designTool, { ...modelToValues(model), [id]: value }); pendingDesignIssues.delete(id); }
        catch (error) { pendingDesignIssues.set(id, (error as Error).message); throw error; }
      }
      // Swapping the image SOURCE retires any live-camera capture flag - the render
      // no longer shows camera essence. Scalar tweaks keep it (while live, the next
      // onFrame re-sets it within a frame). Recorded takes stay sticky: a recorder
      // stores its clip through this same path, so clearing them here would erase
      // the capture the moment it's committed.
      const priorType = model.find(i => i.id === id)?.type;
      if (priorType === 'asset' || priorType === 'file' || priorType === 'url') liveCameraShown = false;
      model = updateInput(model, id, value);
      // A live-camera resolution slider (render.liveMaxEdgeInput) re-applies to the
      // running stream without a camera stop/start - the grab loop just starts
      // producing frames at the new working edge. No-op unless currently live.
      if (liveResubscribe && id === tool.manifest.render?.liveMaxEdgeInput) liveResubscribe();
      const seq = ++setInputSeq;
      // Paint the keystroke immediately, BEFORE awaiting the onInput hook (which may
      // do IndexedDB asset reads). Blocking the visible update on the hook made every
      // keystroke feel laggy. A hook that rewrites the just-typed input (e.g. quote
      // capitalisation) then triggers a one-frame correction on the re-emit below -
      // acceptable per the perf plan; the FINAL state is always the post-hook value.
      emit();
      const onInput = hooks?.onInput;
      if (onInput) {
        try {
          const patch = await runHook('onInput', report => onInput({ id, value: flattenValue(value), model: modelForHooks(model), lang: hookLang, host, report }), applyLatePatch);
          if (patch) {
            ({ model, extras } = mergePatch(model, extras, patch, inputIds));
            emit(); // re-emit with the hook's patch so the final state is correct
          }
        } catch (e) {
          host.log('warn', `onInput ${(e as Error).message}`, { toolId: tool.manifest.id });
        }
      }
      // Re-resolve nested renders OFF the critical path. Commit + re-emit only if
      // this is still the latest setInput (so an out-of-order child render can't
      // clobber a newer value, M5) and the resolved refs actually changed.
      if (host.compose && tool.manifest.composes?.length) {
        const composeOut = await resolveNestedRenders(tool, model, extras, host, composeStack, composeMemo);
        const changed = Object.keys(composeOut).some(k => extras[k] !== composeOut[k]);
        if (seq === setInputSeq && changed) {
          extras = { ...extras, ...composeOut };
          emit();
        }
      }
    },

    /**
     * Atomic multi-input apply (plans/100 section 5). Every value goes through EXACTLY
     * setInput's constraint path (updateInput → constrain), so a batch can never
     * put anything in the model a keystroke couldn't. A key naming no declared
     * input - version skew between peers - or one whose value the constraints
     * reject is DROPPED on its own; the rest of the batch still applies and
     * nothing throws mid-apply (section 11.11).
     *
     * What "reject" covers is exactly what the input model can decide from the
     * MANIFEST (see constrain in inputs.ts): a select value outside its declared
     * options, a non-boolean boolean, NaN/out-of-range numbers, an over-long
     * string, a non-array `blocks`, a malformed table/vector/file. It does NOT
     * type-check `asset` or `color`, whose legitimate values are object-shaped and
     * completed later in the lifecycle - a caller taking values from an untrusted
     * peer gates those at its own boundary (the web shell's collab plumbing does).
     * Nor is it a size/depth cap on hostile payloads: that is inbound-transport
     * hardening (section 11.21, wave 2.4), which belongs where the bytes arrive.
     *
     * `onInput` runs per CHANGED id, sequentially in the object's insertion
     * order, under setInput's time-box and warn-don't-throw handling: the hook
     * contract is per-input and must not change meaning just because the values
     * arrived together. Only the RENDER coalesces - one emit after the last
     * hook instead of one per key (a batch where nothing landed emits nothing).
     * Each hook is told the value that actually entered the model (post-constrain,
     * flattened), captured at apply time so an earlier hook's patch can't change
     * what a later id reports. One deliberate divergence from setInput, which
     * hands its hook the caller's RAW argument: a batch arrives from a peer, a URL
     * or `/multi`, where "what the user typed" has no meaning and the model value
     * is the honest one. A hook that branches on out-of-range input sees it on the
     * keystroke path only.
     */
    async applyPatch(values) {
      if (tool.manifest.designTool) {
        if (Object.keys(values).some(id => !tool.manifest.inputs.some(i => i.id === id))) throw new Error('This property is fixed by the designer.');
        try { assertDesignValues(tool.manifest.designTool, { ...modelToValues(model), ...values }); for (const id of Object.keys(values)) pendingDesignIssues.delete(id); }
        catch (error) { for (const id of Object.keys(values)) pendingDesignIssues.set(id, (error as Error).message); throw error; }
      }
      const applied: { id: string; value: InputValue }[] = [];
      for (const [id, value] of Object.entries(values ?? {})) {
        const before = model.find(i => i.id === id);
        if (!before) continue; // no such input on this build - dropped, not an error
        // Trust boundary, the one setInput already has: the value is whatever the
        // caller (a peer, a URL, /multi) sent; constrain() decides what may enter.
        const next = updateInput(model, id, value as InputValue);
        const after = next.find(i => i.id === id)!;
        // constrain() returns the PRIOR value when it rejects one, so an unchanged
        // value is exactly the rejected case (and a genuine no-op write): leave the
        // model alone rather than churn isDirty and run a hook for nothing.
        if (Object.is(after.value, before.value)) continue;
        // Same live-capture retirement as setInput - swapping the image SOURCE
        // means the render no longer shows camera essence.
        if (before.type === 'asset' || before.type === 'file' || before.type === 'url') liveCameraShown = false;
        model = next;
        applied.push({ id, value: flattenValue(after.value) });
      }
      if (!applied.length) return;
      const liveEdgeInput = tool.manifest.render?.liveMaxEdgeInput;
      if (liveResubscribe && liveEdgeInput && applied.some(a => a.id === liveEdgeInput)) liveResubscribe();
      const seq = ++setInputSeq;
      const onInput = hooks?.onInput;
      if (onInput) {
        for (const { id, value } of applied) {
          try {
            const patch = await runHook('onInput', report => onInput({ id, value, model: modelForHooks(model), lang: hookLang, host, report }), applyLatePatch);
            if (patch) ({ model, extras } = mergePatch(model, extras, patch, inputIds));
          } catch (e) {
            host.log('warn', `onInput ${(e as Error).message}`, { toolId: tool.manifest.id });
          }
        }
      }
      emit(); // ONE render for the whole batch, hooks included
      // Nested renders off the critical path, superseded by any newer
      // setInput/applyPatch - the same tail (and the same later emit) setInput has.
      if (host.compose && tool.manifest.composes?.length) {
        const composeOut = await resolveNestedRenders(tool, model, extras, host, composeStack, composeMemo);
        const changed = Object.keys(composeOut).some(k => extras[k] !== composeOut[k]);
        if (seq === setInputSeq && changed) {
          extras = { ...extras, ...composeOut };
          emit();
        }
      }
    },

    subscribe(fn) {
      listeners.add(fn);
      fn({ model, hydrated: getHydrated() });
      return () => listeners.delete(fn);
    },

    // Re-notify subscribers with the CURRENT model - no value change. For shell
    // state that lives outside the input model but still affects the render (e.g.
    // export dimensions): a shell can force the canvas to re-hydrate through the
    // one render path instead of mutating the DOM itself. Used to invalidate a
    // deferred preview (manifest.render.preview) when the capture geometry changes.
    refresh: emit,

    // Re-resolve asset + token refs the mount already ran once (see the top of
    // createRuntime), for values applied AFTER mount. A template/preset picked
    // mid-doc pushes its `{color.*}` backdrop tokens and tool-URL image stubs in through
    // applyPatch/setInput, neither of which resolves them; without this a picked
    // template renders black colours + a placeholder image where a freshly-opened one
    // renders the real gradient. Both resolvers return the same model reference when
    // nothing needed resolving, so a call that changed nothing skips the re-emit.
    async resolveRefs() {
      const before = model;
      model = await resolveAssetRefs(model, host, droppedAssets, composeStack, tool.manifest.id);
      model = await resolveTokenRefs(model, host);
      if (model !== before) emit();
    },

    // True when this tool declares an `onFrame` hook - i.e. it CAN react to a live
    // camera. The shell still gates the actual "go live" affordance on host.media
    // being present, so a tool without a camera shell just runs as a still tool.
    hasFrameHook: Boolean(hooks?.onFrame),

    /** Whether the camera-driven loop is currently running. */
    isLive,

    /**
     * Start driving the tool's `onFrame` hook from the host frame source - the
     * camera by default, or (source:'asset') a shell-armed animated asset replayed
     * through the same loop. Resolves once frames can flow; rejects if permission
     * is denied or there's no camera (the shell shows that error). No-op (returns
     * false) if already live, the tool has no onFrame, or there's no host.media.
     */
    async startLive(opts?: { source?: 'camera' | 'asset'; facingMode?: 'user' | 'environment' }) {
      // Capture the hook + media locals so the deferred subscribe callback keeps
      // its narrowed (non-null) types; `hooks` is a mutable closure variable.
      const onFrame = hooks?.onFrame;
      const media = host.media;
      if (liveUnsub || liveStarting || destroyed || !onFrame || !media) return false;
      const generation = ++liveGeneration;
      liveStarting = true;
      // Provenance: only a real sensor feed may mark renders as a live camera
      // capture. A shell replaying an ANIMATED ASSET through the same frame loop
      // passes source:'asset' so the export never over-claims digitalCapture.
      const sensorSource = opts?.source !== 'asset';
      // Which camera: the explicit request, else the tool's manifest default
      // (render.liveFacing - a code reader wants 'environment', the rear camera).
      // Honoured only when this start() creates the stream (media is refcounted;
      // a flip is stop() then start()).
      const facingMode = opts?.facingMode
        ?? (tool.manifest.render as { liveFacing?: 'user' | 'environment' } | undefined)?.liveFacing;
      try {
        await media.start(facingMode ? { facingMode } : undefined);
      } finally {
        if (generation === liveGeneration) liveStarting = false;
      }
      if (generation !== liveGeneration || destroyed) {
        // Balance only this successful start. Another runtime or a newer attempt
        // may already own the same refcounted source.
        try { media.stop(); } catch { /* already torn down */ }
        return false;
      }
      // A raster-output tool can ask for higher-resolution frames than the shell's
      // default vector-trace working size (render.liveMaxEdge, or a live slider via
      // render.liveMaxEdgeInput - see liveEdge()); the shell clamps it to the native
      // camera frame. Shells that ignore the opt fall back to default.
      const subscribeLive = () => media.subscribe((frame) => {
        if (framePending || livePaused) return; // busy, or an export drive owns the canvas → drop
        framePending = true;
        Promise.resolve(onFrame({ frame, model: modelForHooks(model), lang: hookLang, host }))
          .then((patch) => {
            // Guard liveUnsub so a frame in flight when stopLive() ran can't repaint.
            // A SENSOR frame drove the render → its essence is now a live camera
            // capture; an animated-asset frame is decoded file content and is not.
            if (patch && liveUnsub && generation === liveGeneration) { ({ model, extras } = mergePatch(model, extras, patch, inputIds)); if (sensorSource) liveCameraShown = true; emit(); }
          })
          .catch((e: unknown) => host.log('warn', `onFrame ${(e as Error).message}`, { toolId: tool.manifest.id }))
          .finally(() => { framePending = false; });
      }, { maxEdge: liveEdge() });
      liveUnsub = subscribeLive();
      // Re-subscribe with the current working edge when the resolution input changes.
      // The grab loop sizes frames to the largest edge any subscriber wants, so simply
      // swapping our subscription re-sizes the stream live - no stop/start of the camera.
      liveResubscribe = () => { if (liveUnsub) { liveUnsub(); liveUnsub = subscribeLive(); } };
      return true;
    },

    /**
     * Stop the camera-driven loop (idempotent). The shell calls this on toggle-off
     * AND on unmount, so no camera track ever outlives the tool.
     */
    stopLive,

    // True when this tool declares an `onLevel` hook - i.e. it CAN react to live
    // audio levels. The shell still gates the actual meter/record affordance on
    // host.recorder being present.
    hasLevelHook: Boolean(hooks?.onLevel),

    /**
     * Start driving the tool's `onLevel` hook from the host mic meter (a pre-record
     * sound check). Rejects if permission is denied or there's no mic (the shell
     * catches). No-op (false) if already metering, no onLevel, or no host.recorder.
     */
    async startMeter(opts) {
      const onLevel = hooks?.onLevel;
      const recorder = host.recorder;
      if (meterUnsub || meterStarting || recordStarting || recordSession || destroyed || !onLevel || !recorder) return false;
      const generation = ++meterGeneration;
      meterStarting = true;
      // The sound-check MUST open the same mic the take will (opts.deviceId ===
      // the startRecording opts.audioDeviceId), or its levels describe a different
      // device. The caller (record-control) passes the chosen mic to both.
      try {
        await recorder.meter.start(opts?.deviceId ? { deviceId: opts.deviceId } : undefined);
      } finally {
        if (generation === meterGeneration) meterStarting = false;
      }
      // Permission may finish after stop/destroy or after a new take has started.
      // Release only this successful acquisition; it never owned a subscription.
      if (generation !== meterGeneration || destroyed) {
        try { recorder.meter.stop(); } catch { /* already torn down */ }
        return false;
      }
      stopMeterSource = () => recorder.meter.stop();
      try { meterUnsub = driveLevels(recorder.meter); }
      catch (error) { stopMeterLoop(); throw error; }
      return true;
    },

    stopMeter: stopMeterLoop,

    /**
     * Begin a recording session via host.recorder and (if the tool has onLevel)
     * drive its coaching hook from the session's live levels. Rejects on denial /
     * missing device. No-op (false) if already recording or no host.recorder.
     */
    async startRecording(opts = {}) {
      const recorder = host.recorder;
      if (recordSession || recordStarting || destroyed || !recorder) return { started: false };
      const generation = ++recordGeneration;
      recordStarting = true;
      // Share the single mic: drop any pre-record sound-check meter first.
      stopMeterLoop();
      let session: RecordSession;
      try { session = await recorder.record(opts); }
      finally { if (generation === recordGeneration) recordStarting = false; }
      if (generation !== recordGeneration || destroyed) {
        try { session.cancel(); } catch { /* already torn down */ }
        return { started: false };
      }
      recordSession = session;
      // Remember what this take IS, so stopRecording/export stamp the right origin and the
      // shell can warn at once if a requested mic was actually denied.
      recordSource = opts.source === 'screen' ? 'screen' : 'device';
      recordMicActive = session.micActive;
      // Drive onLevel from the live session so coaching keeps updating during the take.
      try { meterUnsub = driveLevels(session); }
      catch (error) { cancelRecording(); throw error; }
      return { started: true, micActive: session.micActive };
    },

    /**
     * Finalise the current recording. Stops the level loop first so no in-flight
     * onLevel repaints after stop, then resolves the media Blob + its MIME type.
     */
    async stopRecording() {
      const session = recordSession;
      if (!session) {
        if (recordStarting) cancelRecording();
        return null;
      }
      const generation = recordGeneration;
      const source = recordSource, micActive = recordMicActive;
      stopLevels();
      recordSession = null;
      const blob = await session.stop();
      if (destroyed || generation !== recordGeneration) return null;
      // Mark the capture for export provenance. Sticky - the take IS the content,
      // re-composited across later edits. A video take from the DISPLAY is a screen
      // capture (screenCapture), NOT a camera one - so a still exported afterwards
      // through the export bar never falsely claims the camera. The mic flag reflects
      // what was ACTUALLY captured (recordMicActive), not the tool's declared
      // capability: a screen take whose mic was denied is silent, and the credential
      // must not claim narration. Fall back to the declared capability only when the
      // session didn't report (older shells / undefined).
      const micGot = micActive ?? toolCaps.has('microphone');
      if (/^video\//i.test(blob.type)) {
        if (source === 'screen') { recordedScreen = true; if (micGot) recordedMic = true; }
        else { recordedCamera = true; if (micGot) recordedMic = true; }
      } else if (/^audio\//i.test(blob.type)) {
        recordedMic = true;
      }
      return { blob, mimeType: blob.type, micActive };
    },

    cancelRecording,

    // Whether this tool produces output via the transform path (a user file in →
    // transformed file out) rather than the DOM-render path. Shells use it to wire
    // a "download the result" action to runtime.exportFile instead of export().
    hasExportFile: Boolean(tool.manifest.hooks?.exportFile),

    /**
     * Produce a transformed file from the tool's own inputs (the file-utility
     * shape: bytes in → bytes out). Runs the tool's `exportFile` hook, which
     * reads the picked file's bytes (input.value.bytes) and returns the result as
     * a plain { bytes, mime, filename } record. The shell wraps it in a Blob and
     * delivers it via host.export.file. NEVER watermarked and NO provenance is
     * embedded - the bytes are the user's own content, not a generated artifact.
     */
    async exportFile(opts = {}) {
      const exportFileHook = hooks?.exportFile;
      if (!exportFileHook) {
        throw new Error(`Tool "${tool.manifest.id}" has no exportFile hook`);
      }
      // Hook trust boundary: the result's shape is the tool's own
      // { bytes, mime, filename } contract, verified for bytes presence below.
      // Errors (including a HOOK_BUDGET_MS timeout) propagate - the shell shows
      // the transform's failure to the user; there's no degraded fallback here.
      const out = await runHook('exportFile',
        () => exportFileHook({ model: modelForHooks(model), lang: hookLang, host, opts }),
      ) as ExportFileResult | ExportFileResult[] | null | undefined;
      const placed = toolEmoji?.census;
      if (placed?.length) emojiCensus = [...emojiCensus.filter(source => !placed.some(next => next.pack.checksum === source.pack.checksum && next.assetId === source.assetId)), ...placed];
      // Batch tools (a `multiple` file input) may return one result per input file;
      // single-file tools return one record. Both are validated for bytes presence.
      if (Array.isArray(out)) {
        const items = out.filter((r): r is ExportFileResult => Boolean(r && r.bytes != null));
        if (!items.length) {
          throw new Error(`exportFile produced no bytes (${tool.manifest.id})`);
        }
        return items;
      }
      if (!out || out.bytes == null) {
        throw new Error(`exportFile produced no bytes (${tool.manifest.id})`);
      }
      return out; // { bytes: Uint8Array|ArrayBuffer, mime, filename }
    },

    async export(renderedNode, format, opts = {}) {
      const composedSource = model.some(item => item.id === 'textDocument' && item.value) || !!extras.__lollyTextPreflight;
      const exportRevision = composedSource ? JSON.stringify([modelToValues(model), emojiStyle]) : null;
      const checkTextRevision = (): void => {
        if (exportRevision !== null && exportRevision !== JSON.stringify([modelToValues(model), emojiStyle]))
          throw new Error('The text changed while its export was prepared. Wait for layout, then export again.');
      };
      if ((format === 'html' || format === 'zip') && tool.manifest.render.portable) {
        if (!tool.presentationSource) throw new Error('The portable presentation runtime is missing. Reload the tool before exporting.');
        if (tool.trustClass === 'remote-untrusted' || tool.trustClass === 'sideloaded-consented') throw new Error('Interactive HTML export requires a trusted installed tool.');
        opts = { ...opts, portableDocument: {
          markup: bindPaint(hydrate(tool.template, templateContext())), styles: tool.styles ?? '',
          script: tool.presentationSource, title: String(model.find(i => i.id === 'title')?.value || tool.manifest.name), lang: hookLang,
        } };
      }
      if (format === 'lottie') opts = { ...opts, width: opts.width ?? tool.manifest.render?.width, height: opts.height ?? tool.manifest.render?.height, sourceDocument: { toolId: tool.manifest.id, values: structuredClone(modelToValues(model)) } };
      if (tool.manifest.designTool) {
        if (tool.manifest.designTool.sourceTool && extras.__lollySourceError) throw new Error(String(extras.__lollySourceError));
        if (tool.manifest.designTool.sourceTool) {
          const captured = (extras.__lollySourceExportOptions as Record<string,{background?:string}> | undefined)?.[format];
          if(captured?.background!==undefined)opts={...opts,background:captured.background};
        }
        if (pendingDesignIssues.size) throw new Error([...pendingDesignIssues.values()].join('\n'));
        const size = designExportSize(tool.manifest.designTool, modelToValues(model), format, opts.width === undefined ? undefined : Number(opts.width), opts.height === undefined ? undefined : Number(opts.height));
        opts = { ...opts, ...size };
        if (!host.export.checkLayout) throw Object.assign(new Error('This tool needs a browser for text layout checks before export.'), { code: 'NEEDS_BROWSER' });
        if (extras.__lollyTextPreflight) {
          const { checkDesignTextReceipt } = await import('./design-tool/text-preflight.ts');
          checkDesignTextReceipt(extras.__lollyTextPreflight, modelToValues(model), renderedNode);
        }
        const check = await host.export.checkLayout(renderedNode as Element);
        if (!check.ok) throw new Error(check.issues.join('\n'));
        if (hookErrors.length) throw new Error('The tool could not render. Resolve its reported errors before export.');
      }
      const beforeExport = hooks?.beforeExport;
      if (beforeExport) {
        // Time-boxed via HOOK_BUDGET_MS, but errors (including the timeout)
        // PROPAGATE and fail this export visibly - beforeExport is where tools
        // raise user-facing preconditions (e.g. url-shot's "enter a URL"), and
        // exporting an unstaged canvas silently would be worse than failing.
        await runHook('beforeExport', () => beforeExport({ model: modelForHooks(model), lang: hookLang, node: renderedNode, format, opts, host }));
      }
      // Emoji, after the tool has finished staging the node and before anything
      // reads it. Running it here rather than only at each mount site is what
      // makes the promise hold on every shell: an export sees pinned artwork even
      // where the live canvas never ran the pass. Idempotent, so a canvas the
      // shell already drew is walked and left alone.
      checkTextRevision();
      const emojiPass = await queueEmoji(() => runEmojiPass(renderedNode));
      // Central transparent-background default - the counterpart to a tool's own beforeExport.
      // A tool whose synthesised `transparentBg` input is ON wants a transparent backdrop, but
      // many only omit the SVG bg rect and never clear the RASTER canvas, so their PNG/WebP
      // exported composited onto opaque white (the gap d3 carried). Honour the input here for
      // alpha-capable formats when neither the caller nor the tool's beforeExport set a
      // background - a tool's explicit background always wins, since this runs only while
      // opts.background is still unset. Effect tools with a prefixed toggle (filter's
      // ht_transparentBg) clear the canvas in their own beforeExport and are untouched.
      if (opts.background == null && ALPHA_EXPORT_FORMATS.has(format)
          && model.find(i => i.id === 'transparentBg')?.value === true) {
        opts.background = 'transparent';
      }
      // Tool-owned still: a tool that computes its own high-precision bytes for
      // this format (e.g. a float grading pipeline → 16-bit PNG / OpenEXR the
      // 8-bit DOM raster path cannot produce) intercepts HERE, before any of the
      // provenance/render machinery. Errors propagate and fail the export
      // visibly (like beforeExport). Returning bytes short-circuits to a Blob and
      // skips host.export.render entirely; declining (null / no bytes) falls
      // through to the normal path, so a tool owns only the formats it truly has
      // depth for and every other export stays byte-identical.
      const exportStill = hooks?.exportStill;
      if (exportStill) {
        // afterExport is the cleanup guarantee that pairs with a mutating
        // beforeExport. Since the owned-bytes path returns before the normal
        // try/finally below, run it here on EVERY exit - success OR a throw/
        // timeout from exportStill - so a failed deep export can't leave the DOM
        // stuck in the export configuration. (On decline we DON'T run it: the
        // fall-through hits the normal finally, which runs it exactly once.)
        const runAfterExport = async (): Promise<void> => {
          const afterExport = hooks?.afterExport;
          if (!afterExport) return;
          try {
            await runHook('afterExport', () => afterExport({ model: modelForHooks(model), lang: hookLang, node: renderedNode, format, opts, host }));
          } catch (e) {
            host.log('warn', `afterExport ${(e as Error).message}`, { toolId: tool.manifest.id });
          }
        };
        let still: ExportStillResult | null | undefined;
        try {
          still = await runHook('exportStill',
            () => exportStill({ model: modelForHooks(model), lang: hookLang, node: renderedNode, format, opts, host })) as ExportStillResult | null | undefined;
        } catch (e) {
          await runAfterExport();
          throw e;
        }
        if (still?.frame) {
          const { validateDeepFrame } = await import('./deep-image.ts');
          validateDeepFrame({ ...still.frame, space: still.frame.space ?? 'srgb-linear' });
          opts = { ...opts, deepFrame: still.frame };
        }
        if (still && still.bytes && !still.frame) {
          const bytes = (still.bytes instanceof Uint8Array ? still.bytes : new Uint8Array(still.bytes)) as BlobPart;
          await runAfterExport();
          return new Blob([bytes], { type: still.mime || 'application/octet-stream' });
        }
      }
      // Surface the 'Convert paths' export toggle (a synthetic export-group input)
      // to the bridge as opts.convertPaths, unless the caller set it explicitly.
      // When a tool suppresses the toggle (render.convertPaths:false) there's no
      // input to read, so honour the manifest opt-out directly - otherwise the
      // bridge's default would outline text anyway.
      if (opts.convertPaths === undefined) {
        const cp = model.find(i => i.id === 'convertPaths');
        if (cp) opts = { ...opts, convertPaths: Boolean(cp.value) };
        else if (tool.manifest?.render?.convertPaths === false) opts = { ...opts, convertPaths: false };
      }
      const isExperimental = tool.manifest.status === 'experimental';
      // On-device utilities (privacy:'on-device') process the user's OWN content,
      // so we must NOT stamp anything into the output: no provenance metadata
      // (it would be ironic to *add* identifying metadata while claiming to scrub
      // it) and no watermark. This also covers render-path utilities (crop/resize);
      // the exportFile transform path never embeds either way.
      const isOnDevice = tool.manifest.privacy === 'on-device';
      // Provenance: stamp authorship into the asset itself (per-format, in the
      // bridge). Auto-assembled from the host profile + tool unless the caller
      // supplied its own `meta` or opted out (e.g. thumbnails) with embedMeta:false.
      let meta = opts.meta;
      if (meta === undefined && opts.embedMeta !== false && !isOnDevice) {
        // Pass the input model so bindToMeta inputs (the artist's author/copyright/
        // licence declaration) merge over the profile-derived provenance.
        meta = await buildExportMeta(host, tool.manifest, profile, model);
        // The licence the person picked in the export panel. A tool input bound to
        // the licence field is the more specific declaration, so it wins.
        const notice = outputLicenceNotice(declaredLicence);
        if (meta && notice && !meta.license) meta = { ...meta, license: notice };
      }
      // Data/text formats are produced from the input model (and optional sibling
      // text templates), not the rendered DOM. The engine hydrates the text here
      // and hands it to the host, which only has to wrap it in a Blob (one MIME
      // per format). This keeps the single export entry point - every shell that
      // calls runtime.export gets these formats for free.
      const dataExtra = buildDataPayload(tool, format, model, getHydratedText);
      // Preserve the Content Credentials of any credentialed image the user
      // PLACED into this design - carried into the export's provenance chain as
      // an ingredient (engine c2pa.ts), so an AI-generated or camera-signed
      // source is never laundered away. Only when we're stamping (never the
      // on-device utility path). Covers user uploads (credential captured at
      // ingest) and library/catalog assets (the host may extract one from the
      // asset's own bytes - v1.31). A credential we can't read is skipped,
      // never fatal to the export.
      let ingredients: (IngredientCredential | SourceIngredient)[] | undefined;
      if (!isOnDevice && meta !== undefined && host.assets?.credential) {
        const ids = new Set<string>();
        const note = (v: unknown): void => {
          if (v && typeof v === 'object') {
            const { id, source } = v as { id?: unknown; source?: unknown };
            if (typeof id === 'string' && (source === 'user' || source === 'library')) ids.add(id);
          }
        };
        for (const input of model) {
          if (input.type === 'asset') note(input.value);
          else if (input.type === 'blocks' && Array.isArray(input.value)) {
            const assetFields = (input.fields ?? []).filter(f => f.type === 'asset').map(f => f.id);
            for (const item of input.value) {
              if (item && typeof item === 'object') for (const fid of assetFields) note((item as Record<string, unknown>)[fid]);
            }
          }
        }
        const prepared: IngredientCredential[] = [];
        for (const id of ids) {
          try {
            const cred = await host.assets.credential(id);
            // Lazy: the C2PA read side (c2pa-verify → c2pa-extract → containers)
            // is ~7K lines that only an export with placed credentials needs.
            const ing = cred?.store ? (await import('./c2pa-verify.ts')).prepareC2paIngredientFromStore(cred.store, cred.format) : null;
            if (ing) prepared.push(ing);
          } catch { /* unreadable credential - skip, don't fail the export */ }
        }
        if (prepared.length) ingredients = prepared;
      }
      // Emoji artwork this render placed: one source ingredient per distinct
      // glyph, recording the set's own licence and creator and the exact bytes
      // Lolly drew from. A CC BY source stays CC BY in the record. Same two gates
      // as the credentialed ingredients above, so an on-device utility and an
      // unstamped thumbnail still carry nothing.
      //
      // ONE evaluation is frozen here, over the census this export's own pass
      // returned, and the same census produces both the ingredients and the
      // plan handed to the host - so the bytes and the credits can never
      // describe two different states (plan 253 section 8.1). The ingredients
      // are byte-identical to what emojiSourceIngredients wrote before this
      // route existed; tests/rights-runtime.test.ts holds that.
      let rightsPlan: RightsEvaluationV1 | null = null;
      if (!isOnDevice && meta !== undefined && emojiPass.census.length) {
        const frozen = evaluateRights(emojiPass.census, { delivery: { canCarryCredential: Boolean(opts.c2pa) } }, format);
        rightsPlan = frozen.evaluation;
        ingredients = [...(ingredients ?? []), ...sourceIngredientsFor(frozen.works, frozen.uses, frozen.details)];
      }
      // When stamping Content Credentials (never the on-device utility path),
      // record a compact digest of the scalar inputs this render came from -
      // surfaced by the shell in the tools.lolly.export assertion so an inspected
      // asset shows what it was made from. Cheap + best-effort; skipped otherwise.
      const stampProvenance = opts.c2pa && !isOnDevice;
      const c2paInputs = stampProvenance ? summarizeInputs(model) : undefined;
      // Live-capture provenance: declare the origin honestly when this session's
      // render came from a device sensor (a filter's live camera frame, or a
      // recorder take). Biased against over-claiming - see the flag tracking above.
      // Screen capture is its own IPTC origin and takes precedence: a screenshot exported
      // after a screen recording must read screenCapture, never "captured from the camera".
      // exportActionSteps checks cap.screen first, so screen + mic → a narrated screen
      // capture, not a camera one.
      const capCamera = liveCameraShown || recordedCamera;
      const c2paCapture = stampProvenance && (recordedScreen || capCamera || recordedMic)
        ? {
            ...(recordedScreen ? { screen: true as const } : {}),
            ...(capCamera ? { camera: true as const } : {}),
            ...(recordedMic ? { microphone: true as const } : {}),
          }
        : undefined;
      // Text-added provenance: honest ONLY when rendered text sits over an OPENED
      // asset (an ingredient is present) - a genuine edit on someone else's image.
      // From-scratch text is the work's own content; it rides in the digest above,
      // never as a fabricated edit step. `sample` teases the step; the full copy is
      // in the digest. bindToProfile text (a pre-filled name) is attribution, not
      // added content - excluded, matching summarizeInputs.
      let c2paTextAdded: { sample?: string } | undefined;
      if (stampProvenance && ingredients?.length) {
        const textItem = model.find(i =>
          (i.type === 'text' || i.type === 'longtext') && !i.bindToProfile &&
          String(flattenValue(i.value) ?? '').trim());
        if (textItem) {
          const s = String(flattenValue(textItem.value)).trim();
          c2paTextAdded = { sample: s.length > 48 ? s.slice(0, 47) + '…' : s };
        }
      }
      // AI-upscale provenance: a placed asset produced on-device by host.upscale
      // carries { model, version } on its meta (a user asset - toAssetRef passes
      // its meta through verbatim). Declare it honestly so the OUTPUT's credential
      // names the model that enlarged it (created → compositeWithTrainedAlgorithmicMedia
      // + an "AI-upscaled with <model> <version>" edit step). Only when stamping; the
      // ingredient path above independently chains the upscaled asset's OWN embedded
      // credential where one is present, so the disclosure survives either way.
      let c2paAiUpscale: { model: string; version: string } | undefined;
      if (stampProvenance) {
        const readUpscale = (v: unknown): { model: string; version: string } | undefined => {
          const up = (v as { meta?: { aiUpscale?: { model?: unknown; version?: unknown } } } | null | undefined)?.meta?.aiUpscale;
          return up && typeof up.model === 'string' && typeof up.version === 'string'
            ? { model: up.model, version: up.version } : undefined;
        };
        // Walk top-level asset inputs AND blocks asset sub-fields - the same descent
        // the ingredient collector above does - so an upscaled image placed into a
        // repeating-field grid (logo wall, carousel) still declares its AI origin.
        for (const input of model) {
          if (input.type === 'asset') {
            c2paAiUpscale = readUpscale(input.value);
          } else if (input.type === 'blocks' && Array.isArray(input.value)) {
            const assetFields = (input.fields ?? []).filter(f => f.type === 'asset').map(f => f.id);
            for (const item of input.value) {
              if (item && typeof item === 'object') {
                for (const fid of assetFields) {
                  c2paAiUpscale = readUpscale((item as Record<string, unknown>)[fid]);
                  if (c2paAiUpscale) break;
                }
              }
              if (c2paAiUpscale) break;
            }
          }
          if (c2paAiUpscale) break;
        }
      }
      // AI-declared ingredients (plans/126 WP-B3): the user's own Origins
      // assertion (or an ingest-read declaration) on any placed asset travels
      // into the export's FRESH credential - a composite created step, a
      // c2pa.placed step naming each piece, and a section 18.28 ai-disclosure. The
      // shared collector walks the same asset descent as the aiUpscale scan.
      const c2paAiIngredients = stampProvenance ? (await import('./c2pa.ts')).collectAiIngredientDeclarations(model) : [];
      let blob;
      try {
        checkTextRevision();
        blob = await host.export.render(renderedNode as Element, format as ExportFormat, {
          ...opts,
          watermark: opts.watermark ?? (isExperimental && !isOnDevice),
          meta,
          ...(ingredients ? { ingredients } : {}),
          ...(c2paInputs && Object.keys(c2paInputs).length ? { c2paInputs } : {}),
          ...(c2paCapture ? { c2paCapture } : {}),
          ...(c2paTextAdded ? { c2paTextAdded } : {}),
          ...(c2paAiUpscale ? { c2paAiUpscale } : {}),
          ...(c2paAiIngredients.length ? { c2paAiIngredients } : {}),
          // The attribution this export promised, and the way back for what it
          // delivered. A host that reads its own bytes back calls onReceipt
          // once; a host that does not leaves lastReceipt null, which reads as
          // "prepared, not measured" rather than as a confirmed delivery.
          ...(rightsPlan ? {
            rights: {
              plan: rightsPlan.plan,
              fingerprint: rightsPlan.fingerprint,
              onReceipt: (receipt: AttributionReceiptV1) => { lastRightsReceipt = receipt; },
            },
          } : {}),
          // Tag output with a colour profile by default (sRGB for raster, the
          // default press condition for CMYK PDF). Thumbnails stay untagged.
          colorProfile: opts.colorProfile ?? (opts.thumbnail ? 'none' : 'srgb'),
          ...dataExtra,
        });
      } finally {
        // afterExport is a cleanup guarantee (e.g. tools that mutate the live node
        // in beforeExport) - run it even if render throws, so a failed export
        // can't leave hook state / the DOM in the export configuration. Its errors
        // and timeouts are logged, NOT rethrown (a throw from a finally would mask
        // the render's own error); the budget only bounds how long we WAIT - the
        // cleanup itself is never cancelled, so a slow afterExport still finishes.
        const afterExport = hooks?.afterExport;
        if (afterExport) {
          try {
            await runHook('afterExport', () => afterExport({ model: modelForHooks(model), lang: hookLang, node: renderedNode, format, opts, host }));
          } catch (e) {
            host.log('warn', `afterExport ${(e as Error).message}`, { toolId: tool.manifest.id });
          }
        }
      }
      return blob;
    },

    // Release per-mount executor resources. In-realm hooks have no teardown
    // (`hooks?.dispose` is undefined); the Worker executor drops its run. Guarded
    // so a shell that never wired destroy - or calls it twice - is harmless.
    destroy() {
      if (destroyed) return;
      destroyed = true;
      try { stopLive(); } catch (e) { host.log('warn', `live dispose ${(e as Error).message}`, { toolId: tool.manifest.id }); }
      stopMeterLoop();
      cancelRecording();
      ++hookRunSeq; // Ignore late reports/results from a tool that is no longer mounted.
      // Let the tree the emoji pass last walked go. An offscreen export stage is
      // removed from the document right after its render, and holding the node
      // here would keep the whole detached stage alive for nothing.
      emojiNode = null;
      emojiListeners.clear();
      emojiArtwork.clear();
      try { hooks?.dispose?.(); } catch (e) { host.log('warn', `hook dispose ${(e as Error).message}`, { toolId: tool.manifest.id }); }
    },
  };
}

// Text/data export formats and their MIME types. These are produced from the
// model rather than the rendered DOM, so the engine assembles the payload and
// the host just wraps it in a Blob. JSON defaults to the resolved input values,
// but a tool that ships a sibling template.json owns it instead (see below);
// ICS/VCF/CSV/SRT/VTT/CSS/SCSS/GPL all come from a sibling text template
// (template.<ext>). SubRip has no registered MIME of its own, so it ships as
// text/plain - the type every player and editor accepts for a .srt sidecar.
export const DATA_FORMATS: Record<string, string> =
  { json: 'application/json', csv: 'text/csv', ics: 'text/calendar', vcf: 'text/vcard',
    srt: 'text/plain', vtt: 'text/vtt',
    css: 'text/css', scss: 'text/x-scss', gpl: 'text/plain' };

// Returns { dataText, dataMime } for a data/text format, or {} for render
// formats (png/svg/pdf/…) so the host takes its normal DOM path.
function buildDataPayload(
  tool: LoadedTool,
  format: string,
  model: InputModelItem[],
  getHydratedText: (str: string) => string,
): { dataText: string; dataMime: string } | Record<string, never> {
  // `md` is opt-in per tool: a sibling template.md → model-derived markdown; with no
  // template.md, return {} so the host serialises the rendered DOM (renderMarkdown) as
  // before. This keeps existing md-exporting tools (e.g. quotes) unchanged.
  if (format === 'md') {
    const tpl = tool.textTemplates?.md;
    return tpl != null ? { dataText: getHydratedText(tpl), dataMime: 'text/markdown' } : {};
  }
  const dataMime = DATA_FORMATS[format];
  if (!dataMime) return {};
  if (format === 'json') {
    // `json` is opt-in per tool, exactly like `md`: a sibling template.json →
    // model-derived JSON (e.g. a tool's own DTCG token document); with no
    // template.json, the built-in {tool,version,inputs} model dump as before, so
    // every existing json-exporting tool is unchanged. getHydratedText already
    // hydrates raw (no HTML escaping), which a JSON payload needs.
    const jsonTpl = tool.textTemplates?.json;
    if (jsonTpl != null) return { dataText: getHydratedText(jsonTpl), dataMime };
    const dataText = JSON.stringify(
      { tool: tool.manifest.id, version: tool.manifest.version, inputs: modelToValues(model) },
      null, 2,
    );
    return { dataText, dataMime };
  }
  const tpl = tool.textTemplates?.[format];
  if (tpl == null) {
    // Distinguish a template that failed to LOAD (transient/CDN) from one that's
    // genuinely absent, so a shell can map the failure to the right message
    // (e.g. "try again" vs. "this tool can't produce that format"). Tag both with
    // a stable code the shell can branch on.
    const loadError = tool.textTemplateErrors?.[format];
    const err: Error & { code?: string } = new Error(
      loadError != null
        ? `Tool "${tool.manifest.id}" couldn't load its template.${format} (${loadError})`
        : `Tool "${tool.manifest.id}" declares format "${format}" but ships no template.${format}`,
    );
    err.code = loadError != null ? 'TEXT_TEMPLATE_LOAD_FAILED' : 'TEXT_TEMPLATE_MISSING';
    throw err;
  }
  return { dataText: getHydratedText(tpl), dataMime };
}

// The id carried by an asset ref still needing resolution - any truthy object
// value with a string `id` (covers both _unresolved URL-mode refs and
// saved-session refs). Null when the value isn't ref-shaped. Mirrors the inline
// `x && typeof x === 'object' && typeof x.id === 'string'` check.
function assetRefId(v: unknown): string | null {
  // Typed-object transports (document API, automation POST, data binding) send
  // asset ids and provider refs as strings. URL mode often wraps the same value
  // in an unresolved object, so accept both representations here.
  if (typeof v === 'string') return v || null;
  if (!v || typeof v !== 'object') return null;
  const id = (v as { id?: unknown }).id;
  return typeof id === 'string' ? id : null;
}

// True when an input carries an asset ref that still needs resolving - either a
// top-level asset value or a block whose declared asset sub-fields hold a ref.
function inputNeedsAssetResolve(input: InputModelItem): boolean {
  const v = input.value;
  if (input.type === 'asset' && assetRefId(v) !== null) return true;
  if (input.type === 'blocks' && Array.isArray(v)) {
    const assetFields = (input.fields ?? []).filter(f => f.type === 'asset');
    if (!assetFields.length) return false;
    return v.some(item => item && typeof item === 'object' &&
      assetFields.some(f => assetRefId((item as { [k: string]: unknown })[f.id]) !== null));
  }
  return false;
}

async function resolveAssetRefs(
  model: InputModelItem[],
  host: HostV1,
  dropped: DroppedAsset[] = [],
  composeStack: readonly string[] = [],
  toolId = '',
): Promise<InputModelItem[]> {
  // Nothing to resolve → return the SAME model reference (no array/object churn,
  // no microtask). Most mounts have no unresolved asset refs at all.
  if (!model.some(inputNeedsAssetResolve)) return model;

  const resolveOne = async (value: unknown, id: string, inputId: string, label: string): Promise<AssetRef | null> => {
    // Re-resolve any asset ref that carries an id - this covers both the
    // _unresolved URL-mode path AND saved-session refs.  Saved sessions store
    // the full resolved object, but blob: URLs are session-scoped and invalid
    // after a page reload, so we always re-fetch a fresh blob URL from the cache.
    let pin: AssetVersionPin | undefined;
    try {
      // A baked ref is frozen: its bytes ride in a data: URL, so it resolves
      // as-is on every mount - no bridge call, no compose-stack growth, never a
      // live re-render. A baked ref WITHOUT data: bytes (e.g. a stale blob: URL
      // that leaked into a save) has lost its pixels; drop it rather than
      // re-render, since baking's whole promise is "these exact bytes".
      if (isBakedRef(value)) {
        const ref = value as AssetRef;
        if (typeof ref.url === 'string' && ref.url.startsWith('data:')) return ref;
        dropped.push({ inputId, label, id, reason: 'baked-bytes-lost' });
        return null;
      }
      const decoded = decodeAssetVersion(id);
      id = decoded.id;
      pin = assetVersionPin(value) ?? decoded.pin;
      if (pin) {
        // An exact dependency never composes a fresh render or substitutes a
        // provider's latest result. Hosts lacking the version must fail closed.
        const ref = await host.assets.get(id, pin);
        if (ref.version !== pin.version || (pin.format && ref.format !== pin.format)) throw new Error('The pinned asset version is unavailable.');
        return { ...ref, pin };
      }
      // A Lolly tool URL as an asset id means "render this tool as my image" -
      // an end user pasted a share link into the picker. Re-render it through
      // compose (not the catalog), so the embedded render is reproduced on every
      // load (saved session, shared parent link). Push THIS tool's id onto the
      // stack (mirroring resolveNestedRenders) so a tool whose image input points
      // at itself - or an A↔B pair - trips the bridge's cycle/depth guard and fails
      // fast instead of recursing. withTimeout bounds a hung child render so it
      // can't block this mount. Graceful-null if the shell can't compose.
      if (isToolUrl(id)) {
        const ref = host.compose?.renderUrl
          ? await withTimeout(
              host.compose.renderUrl(id, { _stack: [...composeStack, toolId] }),
              COMPOSE_TIMEOUT_MS, id,
            )
          : null;
        if (ref) return ref;
        dropped.push({ inputId, label, id, reason: 'render-failed' });
        return null;
      }
      // The grammar intentionally parses any URI scheme, including http(s),
      // but plain web URLs retain the established direct-asset path above/below:
      // Lolly share URLs compose and ordinary URLs go through assets.get. Only
      // logical schemes are delegated to the additive provider resolver.
      const providerRef = parseProviderRef(id);
      if (providerRef && providerRef.provider !== 'http' && providerRef.provider !== 'https') {
        const resolved = await host.assets.resolveProvider?.(providerRef) ?? null;
        if (resolved) return resolved;
        dropped.push({ inputId, label, id, reason: 'not-found' });
        return null;
      }
      return await host.assets.get(id);
    } catch (e) {
      host.log('warn', `Failed to resolve asset ${id}`, { error: String(e) });
      dropped.push({ inputId, label, id, reason: 'not-found' });
      if (pin) return unavailablePinnedAsset(id, pin, value);
      return null;
    }
  };

  return Promise.all(
    model.map(async (input): Promise<InputModelItem> => {
      const v = input.value;
      if (input.type === 'asset') {
        const id = assetRefId(v);
        if (id !== null) {
          return { ...input, value: await resolveOne(v, id, input.id, input.label || input.id) };
        }
      }
      // Blocks may carry asset sub-fields (declared type:'asset'); resolve each
      // block item's ref so per-block images work in URL mode / CLI exactly as
      // they do via the web picker (which stores an already-resolved ref).
      if (input.type === 'blocks' && Array.isArray(v)) {
        const assetFields = (input.fields ?? []).filter(f => f.type === 'asset').map(f => f.id);
        if (!assetFields.length) return input;
        const value = await Promise.all(v.map(async (item): Promise<InputValue> => {
          if (!item || typeof item !== 'object') return item;
          const rec = item as { [key: string]: InputValue | undefined };
          const next: { [key: string]: InputValue | undefined } = { ...rec };
          for (const fid of assetFields) {
            const id = assetRefId(rec[fid]);
            if (id !== null) {
              next[fid] = await resolveOne(rec[fid], id, `${input.id}.${fid}`, input.label || input.id);
            }
          }
          return next;
        }));
        return { ...input, value };
      }
      return input;
    }),
  );
}

// Re-resolve token-backed colour values against the live token set. A value is
// token-backed when it's a { ref, value } object (saved session / resolved URL)
// or a bare `{path}` alias string (freshly parsed from a URL). Each becomes a
// { ref, value:<hex> } pair: the ref keeps it canonical, the hex is the cached
// fallback for when the token is absent on this device.
async function resolveTokenRefs(model: InputModelItem[], host: HostV1): Promise<InputModelItem[]> {
  if (!host.tokens) return model; // shell without token support - leave values as-is
  // No colour input carries a token ref/alias → skip the host.tokens.get() round
  // trip entirely and keep the same model reference.
  const needs = model.some(i => i.type === 'color' && (isTokenValue(i.value) || isAlias(i.value)));
  if (!needs) return model;
  let set: TokenSet;
  try { set = await host.tokens.get(); } catch { return model; }
  const { swatchFace } = await import('./color-face.ts');
  const swatches = new Map((set.colors?.() ?? []).map(swatch => [swatch.ref, swatch]));
  const target = model.some(input => input.id === 'editingRange' && input.value === 'hdr') ? 'rec2020' : 'srgb';
  return model.map(input => {
    if (input.type !== 'color') return input;
    const v = input.value;
    const ref = isTokenValue(v) ? v.ref : (isAlias(v) ? v : null);
    if (!ref) return input;
    const resolved = set.resolve(ref);
    if (resolved !== undefined) return { ...input, value: { ref, value: swatches.has(ref) ? swatchFace(swatches.get(ref)!,target) : colorToHex(resolved) } };
    // Unresolved here: keep the cached value if we had one; otherwise mark it
    // resolved-to-nothing so modelToValues yields '' rather than the raw alias.
    return { ...input, value: isTokenValue(v) ? v : { ref, value: undefined } };
  });
}

// What the hooks.js factory returns: the eight lifecycle exports, each
// whatever the tool defined (or null). Untrusted until narrowed in loadHooks.
type HookFactory = (host: HostV1) => Record<string, unknown>;

// A loaded definition owns its compiled factory. Authoring previews can have the
// same id/version with different draft source; they must never reuse stale hooks.
const hookFactoryCache = new WeakMap<LoadedTool, HookFactory>();

function getHookFactory(tool: LoadedTool): HookFactory {
  let factory = hookFactoryCache.get(tool);
  if (!factory) {
    // Hooks run in a Function() scope with the host bridge injected as the
    // sole argument - the intended path for anything a tool needs. This is
    // closure-scope injection, NOT isolation: `new Function` still runs in the
    // realm's global scope, so hooks CAN reach window/document/fetch when the
    // shell is a browser (and some shipping tools rely on it). Not a security
    // sandbox; the host bridge is just the supported, portable API surface -
    // third-party/untrusted tool code is NOT safe to run until Worker
    // isolation ships. Async results are time-boxed (HOOK_BUDGET_MS) but a
    // synchronous runaway hook cannot be preempted in-realm.
    // typeof guards prevent ReferenceError for hooks that aren't declared.
    // The assertion is the `new Function` trust boundary: the factory's return
    // shape is pinned by the source string built right here.
    factory = new Function(
      'host',
      `${tool.hooksSource}; return {` +
      `onInit: typeof onInit !== 'undefined' ? onInit : null,` +
      `onInput: typeof onInput !== 'undefined' ? onInput : null,` +
      `onFrame: typeof onFrame !== 'undefined' ? onFrame : null,` +
      `onLevel: typeof onLevel !== 'undefined' ? onLevel : null,` +
      `beforeExport: typeof beforeExport !== 'undefined' ? beforeExport : null,` +
      `afterExport:  typeof afterExport  !== 'undefined' ? afterExport  : null,` +
      `exportFile:   typeof exportFile   !== 'undefined' ? exportFile   : null,` +
      `exportStill:  typeof exportStill  !== 'undefined' ? exportStill  : null` +
      `};`,
    ) as HookFactory;
    hookFactoryCache.set(tool, factory);
  }
  return factory;
}

// Narrow one untrusted hooks.js export to a callable hook. The assertion is the
// `new Function` trust boundary: the value's runtime signature is whatever the
// tool wrote; the declared type is the contract the runtime invokes it with.
function hookFn<T extends (...args: never[]) => unknown>(v: unknown): T | null {
  return typeof v === 'function' ? (v as T) : null;
}

async function loadHooks(tool: LoadedTool, host: HostV1): Promise<Hooks> {
  const factory = getHookFactory(tool);
  const mod = factory(host);
  return {
    onInit:       hookFn<OnInitHook>(mod.onInit),
    onInput:      hookFn<OnInputHook>(mod.onInput),
    onFrame:      hookFn<OnFrameHook>(mod.onFrame),
    onLevel:      hookFn<OnLevelHook>(mod.onLevel),
    beforeExport: hookFn<ExportLifecycleHook>(mod.beforeExport),
    afterExport:  hookFn<ExportLifecycleHook>(mod.afterExport),
    exportFile:   hookFn<ExportFileHook>(mod.exportFile),
    exportStill:  hookFn<ExportStillHook>(mod.exportStill),
  };
}

/**
 * A hook executor produces a mounted tool's Hooks object from its hooks.js source
 * + the host bridge. `inRealmHookExecutor` is today's path (compile with
 * `new Function('host', src)` in this realm). A shell can inject an alternative
 * through createRuntime's `opts.hookExecutor`: the web shell's Worker-isolated
 * executor (plans/86-worker-isolation-hooks.md M2) returns the SAME Hooks shape,
 * but each slot postMessages into a Worker and resolves a Promise - which
 * `runHook` already time-boxes exactly like an async in-realm hook, so every
 * downstream call site (runHook, hasFrameHook, driveLevels, the export path) is
 * agnostic to which executor produced the Hooks. The engine stays DOM-free: it
 * never constructs a Worker, it only accepts one.
 */
export type HookExecutor = (tool: LoadedTool, host: HostV1) => Promise<Hooks>;

/** The default executor - compile + run hooks in this realm (behavior unchanged). */
export const inRealmHookExecutor: HookExecutor = loadHooks;

// Backstop for re-rendering a tool-URL asset on mount - mirrors the same bound on
// the manifest-composes path (compose.ts) so a hung child render can't block the
// parent's first paint. On timeout the resolve rejects → the slot is dropped.
const COMPOSE_TIMEOUT_MS = 10000;

function withTimeout<T>(promise: Promise<T> | T, ms: number, toolId: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timed out after ${ms}ms (${toolId})`)), ms);
    Promise.resolve(promise).then(
      v => { clearTimeout(t); resolve(v); },
      (e: unknown) => { clearTimeout(t); reject(e); },
    );
  });
}

/**
 * Split a hook patch into model updates (declared input ids) and extras
 * (computed values with no matching input). Returns updated model + extras.
 *
 * `inputIds` is the runtime's stable Set of declared ids (built once at mount).
 * When the patch touches no declared input (the common extras-only case, e.g. a
 * hook that only computes QR modules / badge geometry) the SAME model reference
 * is returned, so templateContext's ref-equality cache isn't needlessly busted.
 */
function mergePatch(
  model: InputModelItem[],
  extras: Record<string, unknown>,
  patch: unknown,
  inputIds?: Set<string>,
): { model: InputModelItem[]; extras: Record<string, unknown> } {
  if (!patch || typeof patch !== 'object') return { model, extras };
  const ids = inputIds ?? new Set(model.map(i => i.id));
  const newExtras: Record<string, unknown> = { ...extras };
  const modelPatch: Record<string, InputValue> = {};
  let hasModelPatch = false;
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    // A key whose value is undefined is a hook MENTIONING a key, not setting
    // it - for an input (`{ boxes: migrated || undefined }` is the shipped bug
    // this guards: key presence used to blank the input) AND for an extra:
    // darkroom's `videoLook` cache contract publishes undefined on every
    // unchanged-colour run precisely so the expensive extra it already
    // published stands. A hook that means "this run computed NOTHING for this
    // key - clear it" says so with null: null is stored, and a template's
    // {{#if}} reads it as absent (design's frameGroups does exactly this when
    // a doc leaves frames mode - an undefined there kept the stale artboard
    // alive forever).
    if (v === undefined) continue;
    // Hook trust boundary: a patched input value is whatever the tool
    // computed - the same latitude the untyped runtime always gave hooks.
    if (ids.has(k)) { modelPatch[k] = v as InputValue; hasModelPatch = true; }
    else newExtras[k] = v;
  }
  const newModel = hasModelPatch
    ? model.map(input => (input.id in modelPatch ? { ...input, value: modelPatch[input.id]! } : input))
    : model;
  return { model: newModel, extras: newExtras };
}
