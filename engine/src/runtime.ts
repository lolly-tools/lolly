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
 * Hooks (if the tool declares any) are loaded into a sandboxed context. The
 * runtime invokes them at the right lifecycle points and merges their effects.
 *
 * Patch semantics:
 *   Hooks return a plain object. Keys that match a declared input id update
 *   that input's value. Keys with no matching input go into `extras` — a
 *   parallel store of hook-computed values the template can reference directly.
 *   This is how QR module lists, chart data, etc. reach the template without
 *   being declared as user-facing inputs in the manifest.
 */

import { buildInputModel, updateInput, modelToValues, modelForHooks, flattenValue } from './inputs.ts';
import { hydrate } from './template.ts';
import { buildExportMeta } from './metadata.ts';
import { isTokenValue, isAlias, colorToHex } from './tokens.ts';
import { resolveNestedRenders } from './compose.ts';
import { isToolUrl } from './tool-url.ts';
import type { InputModelItem, InputValue, ProfileValues } from './inputs.ts';
import type { LoadedTool, ToolManifest } from './loader.ts';
import type { ComposeMemo } from './compose.ts';
import type {
  AssetsAPI, AssetRef, ComposeAPI, ExportOpts, HostV1, MediaAPI, MediaFrame,
  ProfileAPI, TokensAPI, TokenSet,
} from './bridge/host-v1.ts';

/**
 * The slice of the host bridge the runtime itself drives (hooks receive the
 * same object and may use everything the shell actually provides — net, text,
 * pdf, … — but the runtime only requires these members). All real shells
 * implement the full HostV1; test doubles provide just this slice.
 */
export interface RuntimeHost {
  version: string;
  profile: Pick<ProfileAPI, 'get'>;
  log: HostV1['log'];
  /** Needed only when a mount carries unresolved asset refs. */
  assets?: Pick<AssetsAPI, 'get'>;
  /**
   * Needed only when runtime.export() is used. `node` is opaque to the
   * engine (it is renderer-agnostic) and `format` is wider than the v1
   * ExportFormat union: data/text formats (json/csv/ics/vcf) also pass
   * through here. HostV1's ExportAPI satisfies this slice.
   */
  export?: { render(node: unknown, format: string, opts?: ExportOpts): Promise<Blob> };
  tokens?: Pick<TokensAPI, 'get'>;
  compose?: ComposeAPI;
  media?: Pick<MediaAPI, 'start' | 'stop' | 'subscribe'>;
}

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
}

/** What a tool's `exportFile` hook must produce (the transform output path). */
export interface ExportFileResult {
  bytes: Uint8Array | ArrayBuffer;
  mime?: string;
  filename?: string;
}

/** The lifecycle context every hook receives. */
export interface HookContext {
  model: InputModelItem[];
  host: RuntimeHost;
}

export type OnInitHook = (ctx: HookContext) => unknown;
export type OnInputHook = (ctx: HookContext & { id: string; value: InputValue }) => unknown;
export type OnFrameHook = (ctx: HookContext & { frame: MediaFrame }) => unknown;
export type BeforeRenderHook = (ctx: HookContext) => unknown;
export type ExportLifecycleHook =
  (ctx: { node: unknown; format: string; opts: RuntimeExportOpts; host: RuntimeHost }) => unknown;
export type ExportFileHook = (ctx: HookContext & { opts: Record<string, unknown> }) => unknown;

/**
 * The hooks record produced by loading a tool's hooks.js — one entry per
 * lifecycle point, null when the tool doesn't declare it.
 */
export interface Hooks {
  onInit: OnInitHook | null;
  onInput: OnInputHook | null;
  onFrame: OnFrameHook | null;
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
  /** True when output flows through the transform path (exportFile hook). */
  hasExportFile: boolean;
  exportFile(opts?: Record<string, unknown>): Promise<ExportFileResult>;
  export(renderedNode: unknown, format: string, opts?: RuntimeExportOpts): Promise<Blob>;
}

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

// Any non-null object — the shape hook patches take. Arrays pass too
// (mirroring the original typeof check).
const isRecordValue = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

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
  host: RuntimeHost,
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
  // Profile is a closed interface; buildInputModel reads it as a string-keyed
  // lookup (bindToProfile), so hand it over as one.
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

  const hooks: Hooks | null =
    (tool.hooksSource || tool.hooksUrl) && tool.manifest.hooks ? await loadHooks(tool, host) : null;
  if (hooks?.onInit) {
    try {
      const patch = await withTimeout(hooks.onInit({ model: modelForHooks(model), host }), 5000, tool.manifest.id);
      if (patch) ({ model, extras } = mergePatch(model, extras, patch, inputIds));
    } catch (e) {
      // Record the failure (not just log it) so the shell can show a canvas-error
      // banner instead of silently hydrating against missing extras. Still don't
      // throw — the lifecycle stays resilient and the canvas renders what it can.
      hookErrors.push({ hook: 'onInit', message: errorMessage(e) });
      host.log('error', `onInit ${errorMessage(e)}`, { toolId: tool.manifest.id });
    }
  }

  // Nested renders (manifest `composes`): render referenced tools to embeddable
  // assets and expose them as extras for `{{asset <id>}}`. Awaited here so the
  // first paint already carries the embed. A no-op without host.compose.
  extras = { ...extras, ...await resolveNestedRenders(tool, model, extras, host, composeStack, composeMemo) };

  const listeners = new Set<(state: RuntimeState) => void>();
  const emit = () => listeners.forEach(fn => fn({ model, hydrated: getHydrated() }));

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
    if (ctxModel !== model || ctxExtras !== extras || ctxCache === null) {
      ctxCache = { ...modelToValues(model), ...extras };
      ctxModel = model;
      ctxExtras = extras;
    }
    return ctxCache;
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
      model = updateInput(model, id, value);
      const seq = ++setInputSeq;
      // Paint the keystroke immediately, BEFORE awaiting the onInput hook (which may
      // do IndexedDB asset reads). Blocking the visible update on the hook made every
      // keystroke feel laggy. A hook that rewrites the just-typed input (e.g. quote
      // capitalisation) then triggers a one-frame correction on the re-emit below —
      // acceptable per the perf plan; the FINAL state is always the post-hook value.
      emit();
      if (hooks?.onInput) {
        try {
          const patch = await withTimeout(hooks.onInput({ id, value: flattenValue(value), model: modelForHooks(model), host }), 2000, tool.manifest.id);
          if (patch) {
            ({ model, extras } = mergePatch(model, extras, patch, inputIds));
            emit(); // re-emit with the hook's patch so the final state is correct
          }
        } catch (e) {
          host.log('warn', `onInput ${errorMessage(e)}`, { toolId: tool.manifest.id });
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
      return () => { listeners.delete(fn); };
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
            if (patch && liveUnsub) { ({ model, extras } = mergePatch(model, extras, patch, inputIds)); emit(); }
          })
          .catch((e: unknown) => host.log('warn', `onFrame ${errorMessage(e)}`, { toolId: tool.manifest.id }))
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
      const out = await withTimeout(
        exportFileHook({ model: modelForHooks(model), host, opts }),
        10000, tool.manifest.id,
      );
      if (!isRecordValue(out) || out.bytes == null) {
        throw new Error(`exportFile produced no bytes (${tool.manifest.id})`);
      }
      // Hook sandbox trust boundary: bytes presence is verified above; the rest
      // of the record is the tool's own { bytes, mime, filename } contract.
      return {
        bytes: out.bytes as Uint8Array | ArrayBuffer,
        mime: out.mime as string | undefined,
        filename: out.filename as string | undefined,
      };
    },

    async export(renderedNode, format, opts = {}) {
      if (hooks?.beforeExport) {
        await hooks.beforeExport({ node: renderedNode, format, opts, host });
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
      try {
        if (!host.export) {
          throw new Error(`Host provides no export capability (${tool.manifest.id})`);
        }
        return await host.export.render(renderedNode, format, {
          ...opts,
          watermark: opts.watermark ?? (isExperimental && !isOnDevice),
          meta,
          // Tag output with a colour profile by default (sRGB for raster, the
          // default press condition for CMYK PDF). Thumbnails stay untagged.
          colorProfile: opts.colorProfile ?? (opts.thumbnail ? 'none' : 'srgb'),
          ...dataExtra,
        });
      } finally {
        // afterExport is a cleanup guarantee (e.g. tools that mutate the live node
        // in beforeExport) — run it even if render throws, so a failed export
        // can't leave hook state / the DOM in the export configuration.
        if (hooks?.afterExport) {
          await hooks.afterExport({ node: renderedNode, format, opts, host });
        }
      }
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

// The id carried by an asset ref still needing resolution — any object value
// with a string `id` (covers both _unresolved URL-mode refs and saved-session
// refs). Null when the value isn't ref-shaped.
function assetRefId(v: InputValue | undefined): string | null {
  if (v == null || typeof v !== 'object' || Array.isArray(v) || v instanceof Uint8Array) return null;
  if (!('id' in v)) return null;
  return typeof v.id === 'string' ? v.id : null;
}

// A plain-record value (a blocks item, vector compound, …).
function isValueRecord(v: InputValue | undefined): v is { [key: string]: InputValue | undefined } {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// True when an input carries an asset ref that still needs resolving — either a
// top-level asset value or a block whose declared asset sub-fields hold a ref.
function inputNeedsAssetResolve(input: InputModelItem): boolean {
  const v = input.value;
  if (input.type === 'asset' && assetRefId(v) !== null) return true;
  if (input.type === 'blocks' && Array.isArray(v)) {
    const assetFields = (input.fields ?? []).filter(f => f.type === 'asset');
    if (!assetFields.length) return false;
    return v.some(item => isValueRecord(item) &&
      assetFields.some(f => assetRefId(item[f.id]) !== null));
  }
  return false;
}

async function resolveAssetRefs(
  model: InputModelItem[],
  host: RuntimeHost,
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
      if (!host.assets) throw new Error('host provides no assets capability');
      return await host.assets.get(id);
    } catch (e) {
      host.log('warn', `Failed to resolve asset ${id}`, { error: String(e) });
      dropped.push({ inputId, label, id });
      return null;
    }
  };

  return Promise.all(
    model.map(async input => {
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
        const value = await Promise.all(v.map(async item => {
          if (!isValueRecord(item)) return item;
          const next: { [key: string]: InputValue | undefined } = { ...item };
          for (const fid of assetFields) {
            const refId = assetRefId(item[fid]);
            if (refId !== null) {
              next[fid] = await resolveOne(refId, `${input.id}.${fid}`, input.label || input.id);
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
async function resolveTokenRefs(model: InputModelItem[], host: RuntimeHost): Promise<InputModelItem[]> {
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

// What the hooks.js sandbox factory returns: the seven lifecycle exports, each
// whatever the tool defined (or null). Untrusted until narrowed in loadHooks.
type HookFactory = (host: RuntimeHost) => Record<string, unknown>;

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
    // Hooks run in a Function() scope with only the host bridge in reach.
    // No window, no global fetch — anything tools need goes through host.
    // typeof guards prevent ReferenceError for hooks that aren't declared.
    // The assertion is the `new Function` trust boundary: the factory's return
    // shape is pinned by the source string built right here.
    factory = new Function(
      'host',
      `${tool.hooksSource}; return {` +
      `onInit: typeof onInit !== 'undefined' ? onInit : null,` +
      `onInput: typeof onInput !== 'undefined' ? onInput : null,` +
      `onFrame: typeof onFrame !== 'undefined' ? onFrame : null,` +
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

// Narrow one untrusted sandbox export to a callable hook. The assertion is the
// `new Function` trust boundary: the value's runtime signature is whatever the
// tool wrote; the declared type is the contract the runtime invokes it with.
function hookFn<T extends (...args: never[]) => unknown>(v: unknown): T | null {
  return typeof v === 'function' ? (v as T) : null;
}

async function loadHooks(tool: LoadedTool, host: RuntimeHost): Promise<Hooks> {
  // Module hooks (hooks.module): a standard ES module with named exports. The
  // native import gives the tool real multi-file structure (sibling imports),
  // and the module cache plays the role hookFactoryCache plays for classic
  // hooks. Named exports are the same untrusted values the sandbox path yields
  // — narrowed by hookFn below. Unlike Function() hooks, an ES module has no
  // host in scope at eval time; hooks only ever receive host via their args,
  // which is the documented contract for both flavours.
  const mod: Record<string, unknown> = tool.hooksUrl
    ? await import(/* @vite-ignore */ tool.hooksUrl)
    : getHookFactory(tool)(host);
  return {
    onInit:       hookFn<OnInitHook>(mod.onInit),
    onInput:      hookFn<OnInputHook>(mod.onInput),
    onFrame:      hookFn<OnFrameHook>(mod.onFrame),
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
  inputIds: Set<string>,
): { model: InputModelItem[]; extras: Record<string, unknown> } {
  if (!isRecordValue(patch)) return { model, extras };
  const newExtras: Record<string, unknown> = { ...extras };
  const modelPatch: Record<string, InputValue> = {};
  let hasModelPatch = false;
  for (const [k, v] of Object.entries(patch)) {
    // Hook sandbox trust boundary: a patched input value is whatever the tool
    // computed — the same latitude the untyped runtime always gave hooks.
    if (inputIds.has(k)) { modelPatch[k] = v as InputValue; hasModelPatch = true; }
    else newExtras[k] = v;
  }
  const newModel = hasModelPatch
    ? model.map(input => (input.id in modelPatch ? { ...input, value: modelPatch[input.id] ?? null } : input))
    : model;
  return { model: newModel, extras: newExtras };
}
