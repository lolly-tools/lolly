// SPDX-License-Identifier: MPL-2.0
/**
 * Runtime — orchestrates the 5-step lifecycle for a single mounted tool.
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
 * bridge injected as closure scope — a portability contract, NOT a security
 * boundary (see getHookFactory). The runtime invokes them at the right
 * lifecycle points, time-boxes their async results (HOOK_BUDGET_MS), and
 * merges their effects.
 *
 * Patch semantics:
 *   Hooks return a plain object. Keys that match a declared input id update
 *   that input's value. Keys with no matching input go into `extras` — a
 *   parallel store of hook-computed values the template can reference directly.
 *   This is how QR module lists, chart data, etc. reach the template without
 *   being declared as user-facing inputs in the manifest.
 */

import { buildInputModel, updateInput, modelToValues, modelForHooks, flattenValue, summarizeInputs } from './inputs.ts';
import { hydrate } from './template.ts';
import { buildExportMeta } from './metadata.ts';
import { isTokenValue, isAlias, colorToHex } from './tokens.ts';
import { resolveNestedRenders } from './compose.ts';
import { isToolUrl } from './tool-url.ts';
import type { InputModelItem, InputValue, ProfileValues } from './inputs.ts';
import type { LoadedTool, ToolManifest } from './loader.ts';
import type { ComposeMemo } from './compose.ts';
import type {
  HostV1, AssetRef, ExportFormat, ExportOpts, MediaFrame, TokenSet,
  AudioLevel, RecordOpts, RecordSession, IngredientCredential,
} from './bridge/host-v1.ts';
import { prepareC2paIngredientFromStore } from './c2pa-verify.ts';

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

/** An asset ref (saved session / URL) that no longer resolves. */
export interface DroppedAsset {
  inputId: string;
  label: string;
  id: string;
}

/** Export options accepted by runtime.export — the host contract's ExportOpts
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

/** What runtime.stopRecording resolves to — the captured media + its MIME type
 *  (the container the shell actually encoded, which may differ from the request). */
export interface RecordResult {
  blob: Blob;
  mimeType: string;
}

/**
 * Per-hook time budgets (ms) for the runtime's async time-box. A hook that
 * returns a Promise is RACED against its budget: on overrun the runtime logs
 * the timeout, applies NO patch, and discards the late resolution — but the
 * hook itself keeps executing (there is no in-realm preemption; a SYNCHRONOUS
 * overrun can only be measured and warned after the fact). `onFrame`/`onLevel`
 * are deliberately absent: they run once per frame/sample and are throttled by
 * dropping overlapping samples instead (see startLive/driveLevels).
 * `exportFile` gets a larger budget because it's a real-work path (e.g. PDF
 * re-encode of a large file). `beforeRender` is declared in the hook contract
 * but currently has no invocation site. Exported mutable so tests (and shells
 * with unusual needs, e.g. a long page-capture beforeExport) can adjust it;
 * the defaults are the documented contract.
 */
export const HOOK_BUDGET_MS = {
  onInit: 5000,
  onInput: 2000,
  beforeRender: 5000,
  beforeExport: 5000,
  afterExport: 5000,
  exportFile: 10000,
};

/** The lifecycle context every hook receives. */
interface HookContext {
  model: InputModelItem[];
  host: HostV1;
}

type OnInitHook = (ctx: HookContext) => unknown;
type OnInputHook = (ctx: HookContext & { id: string; value: InputValue }) => unknown;
type OnFrameHook = (ctx: HookContext & { frame: MediaFrame }) => unknown;
type OnLevelHook = (ctx: HookContext & { level: AudioLevel }) => unknown;
type BeforeRenderHook = (ctx: HookContext) => unknown;
type ExportLifecycleHook =
  (ctx: { node: unknown; format: string; opts: RuntimeExportOpts; host: HostV1 }) => unknown;
type ExportFileHook = (ctx: HookContext & { opts: Record<string, unknown> }) => unknown;

/**
 * The hooks record produced by loading a tool's hooks.js — one entry per
 * lifecycle point, null when the tool doesn't declare it.
 */
interface Hooks {
  onInit: OnInitHook | null;
  onInput: OnInputHook | null;
  onFrame: OnFrameHook | null;
  onLevel: OnLevelHook | null;
  beforeRender: BeforeRenderHook | null;
  beforeExport: ExportLifecycleHook | null;
  afterExport: ExportLifecycleHook | null;
  exportFile: ExportFileHook | null;
}

/** The mounted-tool API createRuntime resolves to. Shells drive this. */
export interface Runtime {
  getModel(): InputModelItem[];
  getHydrated(): string;
  /** Hydrate an arbitrary template string against the same context (e.g. manifest.a11yLabel). */
  getHydratedString(str: string | null | undefined): string;
  manifest: ToolManifest;
  styles: string | null;
  /** Asset refs (saved session / URL) that no longer resolve — read once after mount. */
  droppedAssets: DroppedAsset[];
  /** Hook failures (currently onInit); empty when every hook ran cleanly. */
  hookErrors: HookError[];
  setInput(id: string, value: InputValue): Promise<void>;
  subscribe(fn: (state: RuntimeState) => void): () => void;
  /** Re-notify subscribers with the CURRENT model — no value change. */
  refresh(): void;
  /** True when this tool declares an `onFrame` hook. */
  hasFrameHook: boolean;
  /** Whether the camera-driven loop is currently running. */
  isLive(): boolean;
  startLive(): Promise<boolean>;
  stopLive(): void;
  /** True when this tool declares an `onLevel` hook (it CAN react to live audio levels). */
  hasLevelHook: boolean;
  /** Whether the audio-level meter loop is currently running. */
  isMetering(): boolean;
  /**
   * Start driving the tool's `onLevel` hook from the host mic level meter — a
   * pre-record "sound check". Resolves true once levels flow; rejects if permission
   * is denied or there's no mic (the shell shows that error). No-op (false) if
   * already metering, the tool has no onLevel, or the shell provides no host.recorder.
   */
  startMeter(): Promise<boolean>;
  /** Stop the level-meter loop and release the mic reference (idempotent). */
  stopMeter(): void;
  /** Whether a recording session is currently capturing. */
  isRecording(): boolean;
  /**
   * Begin a recording session (mic, optionally camera) via host.recorder, driving
   * the tool's `onLevel` hook — if any — from the session's live levels. Resolves
   * true once recording; rejects on denial / missing device. No-op (false) if
   * already recording or no host.recorder. Stops any pre-record meter first so the
   * take and the sound-check share the one mic the shell opened.
   */
  startRecording(opts?: RecordOpts): Promise<boolean>;
  /**
   * Finalise the current recording and resolve the captured media (Blob + the MIME
   * type actually encoded), or null if not recording. The shell routes the bytes: a
   * video clip becomes a template asset (setInput); an audio clip downloads via
   * host.export.file (the user's own content — never watermarked).
   */
  stopRecording(): Promise<RecordResult | null>;
  /** Discard the current recording and release the devices (idempotent). */
  cancelRecording(): void;
  /** True when output flows through the transform path (exportFile hook). */
  hasExportFile: boolean;
  exportFile(opts?: Record<string, unknown>): Promise<ExportFileResult>;
  export(renderedNode: unknown, format: string, opts?: RuntimeExportOpts): Promise<Blob>;
}

/**
 * @param tool          from loader.ts
 * @param host          capability bridge implementation
 * @param initialState  from URL params or saved slot
 * @param opts.composeStack  tool ids already on the compose path — set by the
 *        compose bridge when rendering a child, so nested composition
 *        (A embeds B embeds C) carries cycle/depth detection downward.
 */
export async function createRuntime(
  tool: LoadedTool,
  host: HostV1,
  initialState: Record<string, InputValue> = {},
  opts: { composeStack?: readonly string[] } = {},
): Promise<Runtime> {
  if (host.version !== '1') {
    throw new Error(`Tool requires host bridge v1, got v${host.version}`);
  }
  const composeStack = opts.composeStack ?? [];
  // Per-runtime memo so resolveNestedRenders skips re-rendering a child whose
  // bound inputs are unchanged across keystrokes.
  const composeMemo: ComposeMemo = new Map();
  // Monotonic id so an out-of-order (slow) nested render from an earlier
  // setInput can't overwrite a newer value's render — see setInput below.
  let setInputSeq = 0;

  const profile = await host.profile.get();
  // buildInputModel reads the profile as a string-keyed lookup (bindToProfile);
  // Profile is an interface (no implicit index signature), so hand it over as a
  // fresh ProfileValues object. Read-only downstream, so the copy is a no-op.
  const profileValues: ProfileValues = { ...profile };
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

  // Resolve token-referenced colour values (from URL mode or a saved session)
  // against the live token set, refreshing each cached hex so a token edit
  // propagates. Mirrors resolveAssetRefs; a no-op on shells without host.tokens.
  model = await resolveTokenRefs(model, host);

  // extras: hook-computed values that have no matching input id.
  // Available to templates alongside input values.
  let extras: Record<string, unknown> = {};

  // Run one lifecycle hook under its HOOK_BUDGET_MS budget. An async result is
  // raced: a timeout rejects HERE (the caller logs/records it and applies no
  // patch) and the hook's eventual late resolution is discarded — withTimeout's
  // promise has already settled, so the value never reaches mergePatch. The
  // hook itself is NOT cancelled (no in-realm preemption). A synchronous hook
  // has already finished by the time we can look at the clock, so a sync
  // overrun is just measured and logged as a warning; its result still counts.
  // A sync throw propagates to the caller's handler, same as before.
  function runHook(name: keyof typeof HOOK_BUDGET_MS, invoke: () => unknown): Promise<unknown> {
    const budget = HOOK_BUDGET_MS[name];
    const started = Date.now();
    const out = invoke();
    if (out == null || typeof (out as { then?: unknown }).then !== 'function') {
      const elapsed = Date.now() - started;
      if (elapsed > budget) {
        host.log('warn', `${name} ran ${elapsed}ms synchronously (budget ${budget}ms — sync hooks can't be preempted)`, { toolId: tool.manifest.id });
      }
      return Promise.resolve(out);
    }
    return withTimeout(out as Promise<unknown>, budget, tool.manifest.id);
  }

  let hooks: Hooks | null = null;
  if (tool.hooksSource && tool.manifest.hooks) {
    hooks = await loadHooks(tool, host);
    const onInit = hooks.onInit;
    if (onInit) {
      try {
        const patch = await runHook('onInit', () => onInit({ model: modelForHooks(model), host }));
        if (patch) ({ model, extras } = mergePatch(model, extras, patch, inputIds));
      } catch (e) {
        // Record the failure (not just log it) so the shell can show a canvas-error
        // banner instead of silently hydrating against missing extras. Still don't
        // throw — the lifecycle stays resilient and the canvas renders what it can.
        hookErrors.push({ hook: 'onInit', message: (e as Error).message });
        host.log('error', `onInit ${(e as Error).message}`, { toolId: tool.manifest.id });
      }
    }
  }

  // Nested renders (manifest `composes`): render referenced tools to embeddable
  // assets and expose them as extras for `{{asset <id>}}`. Awaited here so the
  // first paint already carries the embed. A no-op without host.compose.
  extras = { ...extras, ...await resolveNestedRenders(tool, model, extras, host, composeStack, composeMemo) };

  const listeners = new Set<(state: RuntimeState) => void>();
  // Hydrate ONCE per change, not once per subscriber: every listener gets the same
  // immutable snapshot (both current subscribers are read-only). A two-subscriber
  // editor (layout-studio, carousel-maker) otherwise ran a full template render twice.
  const emit = () => {
    const state = { model, hydrated: getHydrated() };
    listeners.forEach(fn => fn(state));
  };

  // ── Live media (onFrame) ────────────────────────────────────────────────────
  // When a shell drives a camera (host.media) AND the tool declares an `onFrame`
  // hook, the runtime can run that hook once per camera frame so the render reacts
  // to live motion. The SHELL owns the camera + the grab loop and hands us plain
  // RGBA frames (no DOM types), so the engine stays platform-agnostic; we just run
  // onFrame → merge its patch → emit, exactly like a keystroke. Overlapping frames
  // are DROPPED (a new frame is processed only once the previous onFrame settled),
  // so a slow per-frame trace self-throttles instead of piling up.
  let liveUnsub: (() => void) | null = null;
  let framePending = false;
  const isLive = () => liveUnsub != null;

  // ── Live-capture provenance (C2PA) ────────────────────────────────────────────
  // Whether the CURRENT render's essence came from a device sensor, so the export
  // can declare it honestly (IPTC digitalCapture) instead of assuming software
  // creation. `liveCameraShown` tracks a filter tool's live frame: set when onFrame
  // drives a render, cleared when the user swaps the image SOURCE (an asset/file/url
  // input) — a scalar tweak keeps it (while live, the next frame re-sets it anyway).
  // `recordedCamera`/`recordedMic` are sticky once a recorder tool finalises a take
  // (the recording IS the content, re-composited across edits); a fresh take re-sets
  // them per the captured MIME + the tool's declared capabilities.
  let liveCameraShown = false;
  let recordedCamera = false;
  let recordedMic = false;
  const toolCaps = new Set(tool.manifest.capabilities ?? []);

  // ── Audio level meter + recording (onLevel) ───────────────────────────────────
  // The audio counterpart to the onFrame camera loop. host.recorder pushes plain
  // AudioLevel numbers (no DOM), the runtime runs the tool's `onLevel` hook per
  // sample and merges its patch → emit, exactly like onFrame. Overlapping samples
  // are DROPPED so a slow coaching hook self-throttles. Two entry points share one
  // driver: startMeter (a pre-record sound-check off host.recorder.meter) and
  // startRecording (off the live RecordSession, so the sound-check and the take use
  // the single mic the shell opened — no double prompt). A video tool with NO
  // onLevel still records; driveLevels just becomes a no-op subscription.
  let meterUnsub: (() => void) | null = null;      // active onLevel subscription (either source)
  let stopMeterSource: (() => void) | null = null; // release the mic ref (meter.stop) — meter path only
  let levelPending = false;
  let recordSession: RecordSession | null = null;
  const isMetering = () => meterUnsub != null && recordSession == null;
  const isRecording = () => recordSession != null;

  // Subscribe onLevel to any level source ({ subscribe(cb) }) — the mic meter or a
  // live RecordSession — with the same drop-overlap throttle as onFrame. Returns the
  // unsubscribe. A no-op subscription when the tool declares no onLevel.
  function driveLevels(source: { subscribe(cb: (l: AudioLevel) => void): () => void }): () => void {
    const onLevel = hooks?.onLevel;
    if (!onLevel) return () => {};
    return source.subscribe((level) => {
      if (levelPending) return; // still running the previous onLevel → drop this sample
      levelPending = true;
      Promise.resolve(onLevel({ level, model: modelForHooks(model), host }))
        .then((patch) => {
          // Guard meterUnsub so a sample in flight when metering/recording stopped
          // can't repaint after teardown.
          if (patch && meterUnsub) { ({ model, extras } = mergePatch(model, extras, patch, inputIds)); emit(); }
        })
        .catch((e: unknown) => host.log('warn', `onLevel ${(e as Error).message}`, { toolId: tool.manifest.id }))
        .finally(() => { levelPending = false; });
    });
  }

  // Stop the level-meter loop + release the mic reference (idempotent). Recording
  // uses its own session teardown (see stopRecording/cancelRecording), so this only
  // calls meter.stop() when the meter path opened the mic.
  function stopMeterLoop() {
    if (!meterUnsub) return;
    meterUnsub();
    meterUnsub = null;
    try { stopMeterSource?.(); } catch { /* already torn down */ }
    stopMeterSource = null;
  }

  // The template context (flattened input values + hook extras) is rebuilt only
  // when `model` or `extras` is replaced. Both are swapped wholesale on every
  // mutation — updateInput/mergePatch/resolve* return fresh objects, never patch
  // in place — so reference equality is a sound cache key. This avoids
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
    // is set before any return — the assertion just erases the nullable type.
    return ctxCache!;
  }

  function getHydrated(): string {
    return hydrate(tool.template, templateContext());
  }

  // Hydrate an arbitrary template string against the SAME context as the main
  // template (input values + hook extras). Used by shells for things like a
  // live accessible-label summary of the current render (manifest.a11yLabel).
  function getHydratedString(str: string | null | undefined): string {
    return str ? hydrate(str, templateContext()) : '';
  }

  // Same context, but WITHOUT HTML escaping — for non-HTML data templates
  // (template.ics/.vcf/.csv). Each data format escapes via its own helper.
  function getHydratedText(str: string): string {
    return str ? hydrate(str, templateContext(), { raw: true }) : '';
  }

  return {
    getModel: () => model,
    getHydrated,
    getHydratedString,
    manifest: tool.manifest,
    styles: tool.styles,
    // Asset refs (from a saved session / URL) that no longer resolve. The shell
    // reads this once after mount to surface a "left blank" notice.
    droppedAssets,
    // Hook failures (currently onInit) so a shell can show a canvas-error banner
    // instead of a silently-blank canvas. Empty when every hook ran cleanly.
    hookErrors,

    async setInput(id, value) {
      // Swapping the image SOURCE retires any live-camera capture flag — the render
      // no longer shows camera essence. Scalar tweaks keep it (while live, the next
      // onFrame re-sets it within a frame). Recorded takes stay sticky: a recorder
      // stores its clip through this same path, so clearing them here would erase
      // the capture the moment it's committed.
      const priorType = model.find(i => i.id === id)?.type;
      if (priorType === 'asset' || priorType === 'file' || priorType === 'url') liveCameraShown = false;
      model = updateInput(model, id, value);
      const seq = ++setInputSeq;
      // Paint the keystroke immediately, BEFORE awaiting the onInput hook (which may
      // do IndexedDB asset reads). Blocking the visible update on the hook made every
      // keystroke feel laggy. A hook that rewrites the just-typed input (e.g. quote
      // capitalisation) then triggers a one-frame correction on the re-emit below —
      // acceptable per the perf plan; the FINAL state is always the post-hook value.
      emit();
      const onInput = hooks?.onInput;
      if (onInput) {
        try {
          const patch = await runHook('onInput', () => onInput({ id, value: flattenValue(value), model: modelForHooks(model), host }));
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

    subscribe(fn) {
      listeners.add(fn);
      fn({ model, hydrated: getHydrated() });
      return () => listeners.delete(fn);
    },

    // Re-notify subscribers with the CURRENT model — no value change. For shell
    // state that lives outside the input model but still affects the render (e.g.
    // export dimensions): a shell can force the canvas to re-hydrate through the
    // one render path instead of mutating the DOM itself. Used to invalidate a
    // deferred preview (manifest.render.preview) when the capture geometry changes.
    refresh: emit,

    // True when this tool declares an `onFrame` hook — i.e. it CAN react to a live
    // camera. The shell still gates the actual "go live" affordance on host.media
    // being present, so a tool without a camera shell just runs as a still tool.
    hasFrameHook: Boolean(hooks?.onFrame),

    /** Whether the camera-driven loop is currently running. */
    isLive,

    /**
     * Start driving the tool's `onFrame` hook from the host camera. Resolves once
     * the camera is live; rejects if permission is denied or there's no camera (the
     * shell shows that error). No-op (returns false) if already live, the tool has
     * no onFrame, or the shell provides no host.media.
     */
    async startLive() {
      // Capture the hook + media locals so the deferred subscribe callback keeps
      // its narrowed (non-null) types; `hooks` is a mutable closure variable.
      const onFrame = hooks?.onFrame;
      const media = host.media;
      if (liveUnsub || !onFrame || !media) return false;
      await media.start(); // may reject (permission/no camera) — the shell catches
      // A raster-output tool can ask for higher-resolution frames than the shell's
      // default vector-trace working size (render.liveMaxEdge); the shell clamps it
      // to the native camera frame. Shells that ignore the opt fall back to default.
      liveUnsub = media.subscribe((frame) => {
        if (framePending) return; // still tracing the previous frame → drop this one
        framePending = true;
        Promise.resolve(onFrame({ frame, model: modelForHooks(model), host }))
          .then((patch) => {
            // Guard liveUnsub so a frame in flight when stopLive() ran can't repaint.
            // A frame drove the render → its essence is now a live camera capture.
            if (patch && liveUnsub) { ({ model, extras } = mergePatch(model, extras, patch, inputIds)); liveCameraShown = true; emit(); }
          })
          .catch((e: unknown) => host.log('warn', `onFrame ${(e as Error).message}`, { toolId: tool.manifest.id }))
          .finally(() => { framePending = false; });
      }, { maxEdge: tool.manifest.render?.liveMaxEdge });
      return true;
    },

    /**
     * Stop the camera-driven loop (idempotent). The shell calls this on toggle-off
     * AND on unmount, so no camera track ever outlives the tool.
     */
    stopLive() {
      if (!liveUnsub) return;
      liveUnsub();
      liveUnsub = null;
      try { host.media?.stop(); } catch { /* already torn down */ }
    },

    // True when this tool declares an `onLevel` hook — i.e. it CAN react to live
    // audio levels. The shell still gates the actual meter/record affordance on
    // host.recorder being present.
    hasLevelHook: Boolean(hooks?.onLevel),

    isMetering,

    /**
     * Start driving the tool's `onLevel` hook from the host mic meter (a pre-record
     * sound check). Rejects if permission is denied or there's no mic (the shell
     * catches). No-op (false) if already metering, no onLevel, or no host.recorder.
     */
    async startMeter() {
      const onLevel = hooks?.onLevel;
      const recorder = host.recorder;
      if (meterUnsub || !onLevel || !recorder) return false;
      await recorder.meter.start(); // may reject (permission/no mic) — the shell catches
      stopMeterSource = () => recorder.meter.stop();
      meterUnsub = driveLevels(recorder.meter);
      return true;
    },

    stopMeter: stopMeterLoop,

    isRecording,

    /**
     * Begin a recording session via host.recorder and (if the tool has onLevel)
     * drive its coaching hook from the session's live levels. Rejects on denial /
     * missing device. No-op (false) if already recording or no host.recorder.
     */
    async startRecording(opts = {}) {
      const recorder = host.recorder;
      if (recordSession || !recorder) return false;
      // Share the single mic: drop any pre-record sound-check meter first.
      stopMeterLoop();
      const session = await recorder.record(opts); // may reject — the shell catches
      recordSession = session;
      // Drive onLevel from the live session so coaching keeps updating during the take.
      meterUnsub = driveLevels(session);
      return true;
    },

    /**
     * Finalise the current recording. Stops the level loop first so no in-flight
     * onLevel repaints after stop, then resolves the media Blob + its MIME type.
     */
    async stopRecording() {
      const session = recordSession;
      if (!session) return null;
      if (meterUnsub) { meterUnsub(); meterUnsub = null; }
      recordSession = null;
      const blob = await session.stop();
      // Mark the capture for export provenance. A video take carries the camera
      // (and the mic too, when this tool declares one); an audio take, the mic
      // alone. Sticky — the take IS the content, re-composited across later edits.
      if (/^video\//i.test(blob.type)) { recordedCamera = true; if (toolCaps.has('microphone')) recordedMic = true; }
      else if (/^audio\//i.test(blob.type)) { recordedMic = true; }
      return { blob, mimeType: blob.type };
    },

    cancelRecording() {
      const session = recordSession;
      if (!session) return;
      if (meterUnsub) { meterUnsub(); meterUnsub = null; }
      recordSession = null;
      try { session.cancel(); } catch { /* already torn down */ }
    },

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
     * embedded — the bytes are the user's own content, not a generated artifact.
     */
    async exportFile(opts = {}) {
      const exportFileHook = hooks?.exportFile;
      if (!exportFileHook) {
        throw new Error(`Tool "${tool.manifest.id}" has no exportFile hook`);
      }
      // Hook trust boundary: the result's shape is the tool's own
      // { bytes, mime, filename } contract, verified for bytes presence below.
      // Errors (including a HOOK_BUDGET_MS timeout) propagate — the shell shows
      // the transform's failure to the user; there's no degraded fallback here.
      const out = await runHook('exportFile',
        () => exportFileHook({ model: modelForHooks(model), host, opts }),
      ) as ExportFileResult | null | undefined;
      if (!out || out.bytes == null) {
        throw new Error(`exportFile produced no bytes (${tool.manifest.id})`);
      }
      return out; // { bytes: Uint8Array|ArrayBuffer, mime, filename }
    },

    async export(renderedNode, format, opts = {}) {
      const beforeExport = hooks?.beforeExport;
      if (beforeExport) {
        // Time-boxed via HOOK_BUDGET_MS, but errors (including the timeout)
        // PROPAGATE and fail this export visibly — beforeExport is where tools
        // raise user-facing preconditions (e.g. url-shot's "enter a URL"), and
        // exporting an unstaged canvas silently would be worse than failing.
        await runHook('beforeExport', () => beforeExport({ node: renderedNode, format, opts, host }));
      }
      // Surface the 'Convert paths' export toggle (a synthetic export-group input)
      // to the bridge as opts.convertPaths, unless the caller set it explicitly.
      // When a tool suppresses the toggle (render.convertPaths:false) there's no
      // input to read, so honour the manifest opt-out directly — otherwise the
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
        meta = await buildExportMeta(host, tool.manifest, profile);
      }
      // Data/text formats are produced from the input model (and optional sibling
      // text templates), not the rendered DOM. The engine hydrates the text here
      // and hands it to the host, which only has to wrap it in a Blob (one MIME
      // per format). This keeps the single export entry point — every shell that
      // calls runtime.export gets these formats for free.
      const dataExtra = buildDataPayload(tool, format, model, getHydratedText);
      // Preserve the Content Credentials of any credentialed image the user
      // PLACED into this design — carried into the export's provenance chain as
      // an ingredient (engine c2pa.ts), so an AI-generated or camera-signed
      // source is never laundered away. Only when we're stamping (never the
      // on-device utility path). Covers user uploads (credential captured at
      // ingest) and library/catalog assets (the host may extract one from the
      // asset's own bytes — v1.31). A credential we can't read is skipped,
      // never fatal to the export.
      let ingredients: IngredientCredential[] | undefined;
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
            const ing = cred?.store ? prepareC2paIngredientFromStore(cred.store, cred.format) : null;
            if (ing) prepared.push(ing);
          } catch { /* unreadable credential — skip, don't fail the export */ }
        }
        if (prepared.length) ingredients = prepared;
      }
      // When stamping Content Credentials (never the on-device utility path),
      // record a compact digest of the scalar inputs this render came from —
      // surfaced by the shell in the tools.lolly.export assertion so an inspected
      // asset shows what it was made from. Cheap + best-effort; skipped otherwise.
      const stampProvenance = opts.c2pa && !isOnDevice;
      const c2paInputs = stampProvenance ? summarizeInputs(model) : undefined;
      // Live-capture provenance: declare the origin honestly when this session's
      // render came from a device sensor (a filter's live camera frame, or a
      // recorder take). Biased against over-claiming — see the flag tracking above.
      const capCamera = liveCameraShown || recordedCamera;
      const c2paCapture = stampProvenance && (capCamera || recordedMic)
        ? { ...(capCamera ? { camera: true as const } : {}), ...(recordedMic ? { microphone: true as const } : {}) }
        : undefined;
      // Text-added provenance: honest ONLY when rendered text sits over an OPENED
      // asset (an ingredient is present) — a genuine edit on someone else's image.
      // From-scratch text is the work's own content; it rides in the digest above,
      // never as a fabricated edit step. `sample` teases the step; the full copy is
      // in the digest. bindToProfile text (a pre-filled name) is attribution, not
      // added content — excluded, matching summarizeInputs.
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
      let blob;
      try {
        blob = await host.export.render(renderedNode as Element, format as ExportFormat, {
          ...opts,
          watermark: opts.watermark ?? (isExperimental && !isOnDevice),
          meta,
          ...(ingredients ? { ingredients } : {}),
          ...(c2paInputs && Object.keys(c2paInputs).length ? { c2paInputs } : {}),
          ...(c2paCapture ? { c2paCapture } : {}),
          ...(c2paTextAdded ? { c2paTextAdded } : {}),
          // Tag output with a colour profile by default (sRGB for raster, the
          // default press condition for CMYK PDF). Thumbnails stay untagged.
          colorProfile: opts.colorProfile ?? (opts.thumbnail ? 'none' : 'srgb'),
          ...dataExtra,
        });
      } finally {
        // afterExport is a cleanup guarantee (e.g. tools that mutate the live node
        // in beforeExport) — run it even if render throws, so a failed export
        // can't leave hook state / the DOM in the export configuration. Its errors
        // and timeouts are logged, NOT rethrown (a throw from a finally would mask
        // the render's own error); the budget only bounds how long we WAIT — the
        // cleanup itself is never cancelled, so a slow afterExport still finishes.
        const afterExport = hooks?.afterExport;
        if (afterExport) {
          try {
            await runHook('afterExport', () => afterExport({ node: renderedNode, format, opts, host }));
          } catch (e) {
            host.log('warn', `afterExport ${(e as Error).message}`, { toolId: tool.manifest.id });
          }
        }
      }
      return blob;
    },
  };
}

// Text/data export formats and their MIME types. These are produced from the
// model rather than the rendered DOM, so the engine assembles the payload and
// the host just wraps it in a Blob. JSON is derived from the resolved input
// values; ICS/VCF/CSV come from a sibling text template (template.<ext>).
const DATA_FORMATS: Record<string, string> =
  { json: 'application/json', csv: 'text/csv', ics: 'text/calendar', vcf: 'text/vcard' };

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

// The id carried by an asset ref still needing resolution — any truthy object
// value with a string `id` (covers both _unresolved URL-mode refs and
// saved-session refs). Null when the value isn't ref-shaped. Mirrors the inline
// `x && typeof x === 'object' && typeof x.id === 'string'` check.
function assetRefId(v: unknown): string | null {
  if (!v || typeof v !== 'object') return null;
  const id = (v as { id?: unknown }).id;
  return typeof id === 'string' ? id : null;
}

// True when an input carries an asset ref that still needs resolving — either a
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

  const resolveOne = async (id: string, inputId: string, label: string): Promise<AssetRef | null> => {
    // Re-resolve any asset ref that carries an id — this covers both the
    // _unresolved URL-mode path AND saved-session refs.  Saved sessions store
    // the full resolved object, but blob: URLs are session-scoped and invalid
    // after a page reload, so we always re-fetch a fresh blob URL from the cache.
    try {
      // A Lolly tool URL as an asset id means "render this tool as my image" —
      // an end user pasted a share link into the picker. Re-render it through
      // compose (not the catalog), so the embedded render is reproduced on every
      // load (saved session, shared parent link). Push THIS tool's id onto the
      // stack (mirroring resolveNestedRenders) so a tool whose image input points
      // at itself — or an A↔B pair — trips the bridge's cycle/depth guard and fails
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
        dropped.push({ inputId, label, id });
        return null;
      }
      return await host.assets.get(id);
    } catch (e) {
      host.log('warn', `Failed to resolve asset ${id}`, { error: String(e) });
      dropped.push({ inputId, label, id });
      return null;
    }
  };

  return Promise.all(
    model.map(async (input): Promise<InputModelItem> => {
      const v = input.value;
      if (input.type === 'asset') {
        const id = assetRefId(v);
        if (id !== null) {
          return { ...input, value: await resolveOne(id, input.id, input.label || input.id) };
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
              next[fid] = await resolveOne(id, `${input.id}.${fid}`, input.label || input.id);
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
  if (!host.tokens) return model; // shell without token support — leave values as-is
  // No colour input carries a token ref/alias → skip the host.tokens.get() round
  // trip entirely and keep the same model reference.
  const needs = model.some(i => i.type === 'color' && (isTokenValue(i.value) || isAlias(i.value)));
  if (!needs) return model;
  let set: TokenSet;
  try { set = await host.tokens.get(); } catch { return model; }
  return model.map(input => {
    if (input.type !== 'color') return input;
    const v = input.value;
    const ref = isTokenValue(v) ? v.ref : (isAlias(v) ? v : null);
    if (!ref) return input;
    const resolved = set.resolve(ref);
    if (resolved !== undefined) return { ...input, value: { ref, value: colorToHex(resolved) } };
    // Unresolved here: keep the cached value if we had one; otherwise mark it
    // resolved-to-nothing so modelToValues yields '' rather than the raw alias.
    return { ...input, value: isTokenValue(v) ? v : { ref, value: undefined } };
  });
}

// What the hooks.js factory returns: the eight lifecycle exports, each
// whatever the tool defined (or null). Untrusted until narrowed in loadHooks.
type HookFactory = (host: HostV1) => Record<string, unknown>;

// Compiled hook factories, memoised by tool id@version. `new Function(...)`
// re-parses the whole hooks.js source (chart-creator is ~525 lines) — but the
// source is identical for a given tool version, and the factory is host-agnostic
// (it only takes `host` as an argument), so the compiled factory is safe to reuse
// across every mount/re-mount of that version.
const hookFactoryCache = new Map<string, HookFactory>();

function getHookFactory(tool: LoadedTool): HookFactory {
  const key = `${tool.manifest.id}@${tool.manifest.version}`;
  let factory = hookFactoryCache.get(key);
  if (!factory) {
    // Hooks run in a Function() scope with the host bridge injected as the
    // sole argument — the intended path for anything a tool needs. This is
    // closure-scope injection, NOT isolation: `new Function` still runs in the
    // realm's global scope, so hooks CAN reach window/document/fetch when the
    // shell is a browser (and some shipping tools rely on it). Not a security
    // sandbox; the host bridge is just the supported, portable API surface —
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
      `beforeRender: typeof beforeRender !== 'undefined' ? beforeRender : null,` +
      `beforeExport: typeof beforeExport !== 'undefined' ? beforeExport : null,` +
      `afterExport:  typeof afterExport  !== 'undefined' ? afterExport  : null,` +
      `exportFile:   typeof exportFile   !== 'undefined' ? exportFile   : null` +
      `};`,
    ) as HookFactory;
    hookFactoryCache.set(key, factory);
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
    beforeRender: hookFn<BeforeRenderHook>(mod.beforeRender),
    beforeExport: hookFn<ExportLifecycleHook>(mod.beforeExport),
    afterExport:  hookFn<ExportLifecycleHook>(mod.afterExport),
    exportFile:   hookFn<ExportFileHook>(mod.exportFile),
  };
}

// Backstop for re-rendering a tool-URL asset on mount — mirrors the same bound on
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
    // Hook trust boundary: a patched input value is whatever the tool
    // computed — the same latitude the untyped runtime always gave hooks.
    if (ids.has(k)) { modelPatch[k] = v as InputValue; hasModelPatch = true; }
    else newExtras[k] = v;
  }
  const newModel = hasModelPatch
    ? model.map(input => (input.id in modelPatch ? { ...input, value: modelPatch[input.id]! } : input))
    : model;
  return { model: newModel, extras: newExtras };
}
