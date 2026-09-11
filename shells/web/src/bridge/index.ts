// SPDX-License-Identifier: MPL-2.0
import { aiAllowed, callAiApi } from '../lib/ai-policy.ts';
/**
 * Web implementation of the v1 capability bridge.
 *
 * Each capability is in its own file; this index composes them. This makes it
 * easy to swap individual implementations (e.g. test doubles) without touching
 * the rest.
 */

import { setHostRef } from '../lib/host-ref.ts';
import type { HostV1, AssetRef, AssetPickerOpts, RecorderAPI } from '@lolly-tools/core/host-v1';
// Deep engine imports, NOT the `@lolly/engine` barrel: this module is on the
// boot path, and engine/src/index.ts is one shared facade whose retained export
// set is the UNION over every importer - touching it here drags createRuntime
// (Handlebars) + loadTool/validate (Ajv) + c2pa onto first paint. See
// scripts/check-bundle-budget.ts.
import { createStateAPI } from './state.ts';
import { createRevisionStore } from './revision-history.ts';
import { REVISION_STORES } from './revision-records.ts';
import { createProfileAPI } from './profile.ts';
import { createPreviewsAPI } from './previews.ts';
import { createAssetsAPI } from './assets.ts';
import { createTokensAPI, USER_TOKENS_ID } from './tokens.ts';
import { createDesignSystemRegistry, type DesignSystemRegistry, type RegistryDb } from '../lib/design-system/registry.ts';
import { createPinPreserver } from './version-assets.ts';
import { createClipboardAPI } from './clipboard.ts';
import { deferredDownload } from './download.ts';
// export.ts (the 90 KB SVG/PDF/video bridge) and compose.ts (which statically pulls
// in the full render runtime - Handlebars - and the tool loader - Ajv) are NOT
// imported statically: they'd land in the boot chunk that the gallery landing loads
// before first paint, yet neither runs until a tool exports or composes. Both are
// wired below as lazy facades (dynamic import on first use), like host.assets.pick.
// net / text / pdf / pptx / capture / viz are wired below as LAZY FACADES for the
// same reason export and compose are: every one of their methods is async, none
// of them is read anywhere on the boot path (the gallery gates tools on
// PROVIDED_CAPABILITIES, a plain const, not on these objects), and between them
// they drag the HarfBuzz glue, pdf-lib's entry, the OOXML zip caps and the WebGL
// probe into the chunk that renders first paint. See scripts/check-bundle-budget.ts.
// host.media / host.recorder are lazy facades (see below); only their SYNCHRONOUS
// availability probes are needed at boot, and those live in their own leaf.
import { cameraAvailable, recorderAvailable } from './capture-support.ts';
import { createScanAPI, scanAvailable } from './scan.ts';
// The PROBE leaf, not capture-extension.ts itself: the impl choice below is made
// at boot, the postMessage transport behind it is not (see the probe's header).
import { hasCaptureExtension } from './capture-extension-probe.ts';
import { vizSupported } from '../lib/viz-support.ts';
// The dependency-free leaf, NOT '../lib/speech-kokoro.ts' (which re-exports the whole
// engine speech-text module) - this module is on the boot path and needs only the number.
import { KOKORO_MODEL_BYTES } from '../../../../engine/src/speech-model-bytes.ts';
// Type only, so naming the web speech surface here costs the boot chunk nothing.
import type { WebSpeechAPI } from './speech.ts';
import { WHISPER_MODEL_BYTES } from '../lib/speech-whisper.ts';
import { stagedUpscaleModels, UPSCALE_MODEL_BYTES } from '../lib/upscale-models.ts';
import { matteModelsFor, MATTE_MODEL_BYTES } from '../lib/matte-models.ts';
import { ocrModelsFor, OCR_MODEL_BYTES } from '../lib/ocr-models.ts';
import { isTauriShell } from '../lib/instance-choice.ts';
import { PROVIDED_CAPABILITIES } from './capabilities-provided.ts';
import { openDB } from './db.ts';

/**
 * The web shell's full host surface: HostV1 with `shell` pinned to 'web', plus
 * the two web-only host-UI helpers that are NOT part of the tool-facing v1
 * contract - `identity` (Content Credentials device identity + CA cert) and
 * `previews` (cache of profile-personalized gallery thumbnails). Their concrete
 * shapes come straight from their factories.
 */
interface WebHost extends HostV1 {
  readonly shell: 'web';
  identity: Awaited<ReturnType<typeof import('./identity.ts')['createIdentityAPI']>>;
  previews: ReturnType<typeof createPreviewsAPI>;
  /** The design systems this device holds (plans/186) - web-only host helper,
   *  not part of the tool-facing contract; tools see `host.tokens.list()`. */
  designSystems: DesignSystemRegistry;
  /** Shell-owned portable history; never exposed as a tool capability. */
  fileHistory: import('../lib/file-history-backup.ts').FileHistoryBackup;
}

/** One-shot memoiser for the lazy-facade loaders below: the first call starts the
 *  dynamic import, every later call reuses the same promise. */
function memo<T>(load: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | null = null;
  return () => (p ??= load());
}

export async function createBridge(): Promise<WebHost> {
  const db = await openDB();

  // Best-effort: ask the browser to keep our local data durable so it's less
  // likely to be evicted under storage pressure (matters most on iOS/Safari).
  // Heuristic and silent in most browsers; never blocks startup.
  if (navigator.storage?.persist) {
    navigator.storage.persisted?.()
      .then(already => (already ? null : navigator.storage.persist()))
      .catch(() => {});
  }

  // The Lolly Chrome extension (if installed) provides page capture in the browser.
  // It's detected synchronously via a flag it sets at document_start, so this adds
  // no startup cost. When present, the 'capture' capability un-greys URL Screenshot.
  const extCapture = hasCaptureExtension();

  const host = {
    version: '1',
    shell: 'web',
    // What this shell can fulfil. Tools needing anything outside this set (e.g.
    // 'capture') are gated in the gallery and tool view. Other shells override
    // capabilities-provided.js to declare their own set.
    capabilities: extCapture ? [...PROVIDED_CAPABILITIES, 'capture'] : PROVIDED_CAPABILITIES,
    log: (level: 'debug' | 'info' | 'warn' | 'error', msg: string, ctx?: object) => {
      // Quiet production console: diagnostic levels (debug/info) are dropped in the
      // shipped app; warn/error always surface so real problems still stand out.
      if (import.meta.env.PROD && (level === 'debug' || level === 'info')) return;
      console[level === 'debug' ? 'log' : level](`[${level}]`, msg, ctx ?? '');
    },
  } as WebHost;

  // Order matters: assets depends on db; export depends on host for watermark style.
  host.state = createStateAPI(db, REVISION_STORES.every(name => db.objectStoreNames.contains(name)) ? createRevisionStore(db) : undefined);
  host.profile = createProfileAPI(db);
  // Shell-internal like previews (not part of HostV1): Content Credentials device
  // identity + CA cert. A lazy facade - all five methods are async, and its only
  // callers are the /profile view's credentials card and tool-actions' signer
  // choice, both far past first paint. Its cross-tab BroadcastChannel is built
  // with the impl, which is correct: a tab that never touches identity has no
  // cached record to invalidate.
  const loadIdentity = memo(async () => (await import('./identity.ts')).createIdentityAPI(db));
  host.identity = {
    status: async () => (await loadIdentity()).status(),
    completeEnrollment: async (token, days) => (await loadIdentity()).completeEnrollment(token, days),
    enroll: async (provider, opts) => (await loadIdentity()).enroll(provider, opts),
    signer: async () => (await loadIdentity()).signer(),
    forget: async () => (await loadIdentity()).forget(),
  } as WebHost['identity'];
  // Web-only host-UI helper (not in the tool-facing contract): cache of
  // profile-personalized gallery thumbnails. The gallery feature-detects it.
  host.previews = createPreviewsAPI(db);
  const loadFileHistory = memo(async () => (await import('../lib/file-history-backup.ts')).createFileHistoryBackup(db));
  host.fileHistory = {
    export: async () => (await loadFileHistory()).export(),
    restore: async snapshot => (await loadFileHistory()).restore(snapshot),
  };
  // `pick` is attached below (line ~99), so the factory return is intentionally
  // missing it here; the cast reconciles that with the AssetsAPI-typed field.
  // Copy-on-write preservation of bytes a published design-system version pins
  // (plans/97 section 6a). Assigned AFTER tokens exists - the preserver reads the head
  // document to find the version ledger - so the option closes over the binding
  // rather than the value, the same late-binding trick createTokensAPI(host) uses.
  // With nothing published it returns on a property read, so an unversioned
  // install pays nothing for it.
  let preservePinned: ((id: string, o?: { reclaiming?: boolean }) => Promise<void>) | null = null;
  host.assets = createAssetsAPI(db as unknown as Parameters<typeof createAssetsAPI>[0], {
    preservePinned: (id, o) => preservePinned?.(id, o) ?? Promise.resolve(),
  }) as unknown as WebHost['assets'];
  // The design-system registry (plans/186): which systems this device holds and
  // which is active. Built BEFORE tokens, which reads the active record's head
  // through the host slice; its probe closes over the assets bridge for the
  // one-shot migration (the shipped catalog asset's name, the legacy head's).
  host.designSystems = createDesignSystemRegistry(db as unknown as RegistryDb, {
    catalogTokens: async () => {
      const meta = await (host.assets as unknown as { _findMetaByType(t: string, o?: { catalogOnly?: boolean }): Promise<{ id: string; name?: string; brandLock?: boolean } | null> })
        ._findMetaByType('tokens', { catalogOnly: true }).catch(() => null);
      return meta ? { id: meta.id, name: meta.name, brandLock: meta.brandLock } : null;
    },
    legacyHead: async () => (host.assets as unknown as { _getUserRecord?(id: string): Promise<{ meta?: Record<string, unknown> } | null> })
      ._getUserRecord?.(USER_TOKENS_ID).catch(() => null) ?? null,
  });
  host.tokens = createTokensAPI(host as unknown as Parameters<typeof createTokensAPI>[0]); // depends on assets (reads the brand tokens asset) + designSystems
  preservePinned = createPinPreserver(host as unknown as Parameters<typeof createPinPreserver>[0]);
  host.clipboard = createClipboardAPI();

  // Lazy export facade: build (and cache) the real 90 KB export bridge on first
  // export - always a user gesture (Get/Save), never on the gallery landing. Keeps
  // it out of the boot chunk. All three ExportAPI methods are async, so the facade
  // is transparent to callers.
  let exportImpl: WebHost['export'] | null = null;
  const loadExport = async (): Promise<WebHost['export']> => {
    if (!exportImpl) { const { createExportAPI } = await import('./export.ts'); exportImpl = createExportAPI(host); }
    return exportImpl;
  };
  host.export = {
    render: async (node, format, opts) => (await loadExport()).render(node, format, opts),
    download: deferredDownload(async () => (await loadExport()).download),
    file: async (blob, opts) => (await loadExport()).file(blob, opts),
    imprint: async (bytes, format, opts) => (await loadExport()).imprint(bytes, format, opts),
    // Linux packaging (plan 197 M5). Must be on the facade or hooks can't see it -
    // introspect() enumerates host.export's own methods to build the worker host proxy.
    pack: async (spec) => (await loadExport()).pack!(spec),
  };

  // Lazy compose facade: compose renders CHILD tools through the same bridge, so it
  // statically pulls in the render runtime (Handlebars) + tool loader (Ajv) - ~90 KB
  // gz the gallery never needs. Built + cached on first compose/embed. Exposes the
  // web-only `_describeUrl` host-UI helper alongside the ComposeAPI contract.
  type WebComposeImpl = Awaited<ReturnType<typeof import('./compose.ts')['createComposeAPI']>>;
  let composeImpl: WebComposeImpl | null = null;
  const loadCompose = async (): Promise<WebComposeImpl> => {
    if (!composeImpl) { const { createComposeAPI } = await import('./compose.ts'); composeImpl = createComposeAPI(host); }
    return composeImpl;
  };
  host.compose = {
    render: async (spec) => (await loadCompose()).render(spec),
    renderUrl: async (url, opts) => (await loadCompose()).renderUrl!(url, opts),
    _describeUrl: async (url: string) => (await loadCompose())._describeUrl(url),
  } as WebHost['compose'];

  // Fail-closed boot default - an EMPTY allowlist, never mutated. A tool that
  // declares network.allowlist gets a per-mount HOST CLONE with a scoped net
  // instead: views/tool.ts (the live canvas), views/multi-edit.ts (each member's
  // runtime), and pro/render-export.ts withToolNet (offscreen batch/zip/compose).
  const loadNet = memo(async () => (await import('./net.ts')).createNetAPI({ allowlist: [] }));
  host.net = { fetch: async (url, init) => (await loadNet()).fetch(url, init) };

  const loadText = memo(async () => (await import('./text.ts')).createTextAPI());
  host.text = {
    toPath: async (opts) => (await loadText()).toPath(opts),
    preload: async (fontUrl) => (await loadText()).preload(fontUrl),
    axisDefaults: async (fontUrl) => (await loadText()).axisDefaults!(fontUrl),
    fontUrl: async (family, opts) => (await loadText()).fontUrl!(family, opts),
  } as WebHost['text'];

  // on-device PDF metadata inspect + strip/compress (pdf-lib, itself lazy inside).
  // redact + pages (v1.85) are wired from their own web-only module: pdf.ts is shared with
  // the node CLI, and pdf-redact.ts reaches the views/pdf-import renderer and a
  // real canvas that the CLI does not have. The host is passed for the text
  // outliner (host.text, itself a lazy facade above).
  host.compare = {
    run: async (request, options) => (await import('../lib/compare-client.ts')).runComparison(request, options),
    visual: async (request, options) => (await import('../lib/compare-client.ts')).runVisualComparison(request, options),
  };
  host.prepare = {
    inspect: async (sources, rules) => (await import('../lib/prepare-client.ts')).runPreparation({ action: 'inspect', sources, rules }),
    apply: async (sources, inspection, choices, remove) => (await import('../lib/prepare-client.ts')).runPreparation({ action: 'apply', sources, inspection, choices, remove }),
  };
  const loadPdf = memo(async () => (await import('./pdf.ts')).createPdfAPI());
  host.pdf = {
    analyze: async (bytes) => (await loadPdf()).analyze(bytes),
    strip: async (bytes) => (await loadPdf()).strip(bytes),
    compress: async (bytes, opts) => (await loadPdf()).compress!(bytes, opts),
    organize: async (bytes, opts) => (await loadPdf()).organize!(bytes, opts),
    stamp: async (bytes, opts) => (await loadPdf()).stamp!(bytes, opts),
    lock: async (bytes, password) => (await loadPdf()).lock!(bytes, password),
    redact: async (bytes, opts) => (await import('./pdf-redact.ts')).redactPdf(bytes, opts, host),
    pages: async (bytes, opts) => (await import('./pdf-redact.ts')).pdfPages(bytes, opts, host),
  } as WebHost['pdf'];

  // on-device .pptx inspect + surgical rebrand (fflate + engine pptx-read/pptx-patch)
  const loadPptx = memo(async () => (await import('./pptx.ts')).createPptxAPI());
  host.pptx = {
    inspect: async (bytes, o) => (await loadPptx()).inspect(bytes, o),
    rebrand: async (bytes, plan) => (await loadPptx()).rebrand(bytes, plan),
  } as WebHost['pptx'];

  // Extension when installed (real capture in the browser); otherwise the stub
  // that throws a clear error. In Tauri, capture.js is overridden to the native impl.
  // Which of the two it is stays a SYNCHRONOUS decision (the extension sets its flag
  // at document_start, and `capabilities` above already read it) - only the impl is lazy.
  const loadCapture = memo(async () => extCapture
    ? (await import('./capture-extension.ts')).createExtensionCaptureAPI()
    : (await import('./capture.ts')).createCaptureAPI());
  // A lazy facade must still mirror the impl's SURFACE synchronously, because tools
  // feature-detect `typeof host.capture.vector === 'function'` (host-v1 CaptureAPI:
  // "callers feature-detect host.capture.vector and fall back to page()"). vector() is
  // native-desktop-only - the Chrome extension and the web stub both expose page()
  // alone - so it is surfaced exactly where the resolved impl has it: the Tauri build,
  // whose capture override IS the native page+vector impl. A page-only facade made the
  // detect lie everywhere, so url-shot rasterised every SVG/PDF capture it could have
  // kept true-vector (regression from c71a7de's lazy-facade conversion).
  const captureFacade: NonNullable<WebHost['capture']> = {
    page: async (spec) => (await loadCapture()).page(spec),
  };
  if (!extCapture && isTauriShell()) {
    // Eagerly load the native capture impl at bridge creation, NOT lazily on the first
    // capture. Its module raises HOOK_BUDGET_MS.beforeExport (5s default → 90s) to fit a
    // real page navigation + printToPDF + PDF→SVG, and the runtime reads that budget when
    // it STARTS a tool's beforeExport hook - so the raise must already have happened. With
    // the lazy import the raise ran INSIDE the first capture's beforeExport, after the 5s
    // budget was locked in, so url-shot timed out at 5s ("Auto-export failed: timed out
    // after 5000ms"). Awaiting here restores the pre-c71a7de eager desktop import. (On the
    // web the impl is a trivial stub with no such side effect, so it stays lazy.)
    await loadCapture();
    captureFacade.vector = async (spec) => {
      const impl = await loadCapture();
      if (!impl.vector) throw new Error('Vector capture is unavailable in this shell.');
      return impl.vector(spec);
    };
  }
  host.capture = captureFacade;
  // Lift (v1.123) - enumerate an SVG's layers for a tool template that cannot import the
  // engine (the Flythrough tool). A LAZY FACADE like capture/pdf: the module is cached by
  // the bundler after the first import, and `svg` is stateless, so no `memo` is needed.
  host.lift = { svg: async (source) => (await import('./lift.ts')).svg(source) } as WebHost['lift'];
  // Keyframes (v1.124) - evaluate the engine's `kf` wire into pose samples for a template
  // (the Flythrough tool's custom camera track). Lazy facade like lift, stateless.
  host.keyframes = { sample: async (kf, count) => (await import('./keyframes.ts')).sample(kf, count) } as WebHost['keyframes'];
  // Live camera frames (v1.4) for motion-reactive tools. Progressive enhancement,
  // NOT a gated capability: a tool with an onFrame hook offers a "live" toggle only
  // where the camera is available, and runs as a still tool otherwise.
  //
  // A LAZY FACADE, like capture/net/text/pdf above (these two were the last eager
  // impls left on the bridge, and between them ~11.7 KB of minified boot: media.ts,
  // recorder.ts and recorder's video-mime.ts bitrate tables). Nothing before a tool
  // mount reads a frame or a level - the only pre-mount caller of either API is the
  // asset picker's "Capture screen" tile, which feature-detects `recorder.still` and
  // then awaits it - so the impl is built on the first call that actually needs a
  // device, and `isAvailable` is answered synchronously from bridge/capture-support.ts,
  // the same probe module the impls themselves call.
  //
  // `subscribe`/`stop` are the only non-async members of either contract. `stop`
  // releases one start() reference, so with no impl there is nothing to release and
  // the no-op is exactly right. `subscribe` attaches one microtask late (frames and
  // levels flow only while started, and start() is what loads the impl, so a
  // subscriber can miss nothing) and its returned unsubscribe is honoured whether it
  // runs before or after the attach.
  const lazySubscribe = <T>(load: () => Promise<T>, attach: (impl: T) => () => void): (() => void) => {
    let off: (() => void) | null = null;
    let cancelled = false;
    void load().then((impl) => { if (!cancelled) off = attach(impl); }).catch(() => { /* impl unavailable - no frames, as before */ });
    return () => { cancelled = true; off?.(); off = null; };
  };
  type WebMediaImpl = ReturnType<typeof import('./media.ts')['createMediaAPI']>;
  let mediaImpl: WebMediaImpl | null = null;
  const loadMedia = async (): Promise<WebMediaImpl> => {
    if (!mediaImpl) { const { createMediaAPI } = await import('./media.ts'); mediaImpl = createMediaAPI(); }
    return mediaImpl;
  };
  host.media = {
    isAvailable: () => cameraAvailable(),
    start: async (opts) => (await loadMedia()).start(opts),
    stop: () => { mediaImpl?.stop(); },
    subscribe: (cb, opts) => lazySubscribe(loadMedia, (m) => m.subscribe(cb, opts)),
    trim: async (bytes, opts) => (await loadMedia()).trim!(bytes, opts),
    // Web-only extra (not on the portable MediaAPI): arm the animated frame source
    // (SVG markup / animated raster / video - see media.ts AnimSourceSpec) for the
    // next start(). Disarming with no impl is a no-op - nothing can be armed yet - 
    // so only a real arm pays for the load.
    armAnimSource: (src: import('./media.ts').AnimSourceSpec | string | null) => {
      if (src === null) { mediaImpl?.armAnimSource(null); return; }
      void loadMedia().then((m) => m.armAnimSource(src));
    },
    // Web-only extra, same class as armAnimSource: deterministically render the armed
    // anim source at tMs for the frame-accurate export path. MUST be forwarded - a
    // caller feature-detects `host.media.renderFrameAt` (views/tool-actions.ts), and a
    // facade that omitted it made that detect return undefined, so every export frame
    // silently fell back to the frozen base instead of the true source frame. The impl's
    // own guard returns null when nothing is armed, so an unconditional forward is safe.
    renderFrameAt: async (tMs: number) => (await loadMedia()).renderFrameAt(tMs),
  } as WebHost['media'];
  // Device capture (v1.17) - mic (and optionally camera) recording + a live audio
  // level meter. Unlike media this IS capability-gated ('microphone'/'camera'),
  // because record() prompts for a grant; the meter/record affordances still
  // feature-detect host.recorder.isAvailable() at the point of use.
  let recorderImpl: RecorderAPI | null = null;
  const loadRecorder = async (): Promise<RecorderAPI> => {
    if (!recorderImpl) { const { createRecorderAPI } = await import('./recorder.ts'); recorderImpl = createRecorderAPI(); }
    return recorderImpl;
  };
  host.recorder = {
    isAvailable: (kind) => recorderAvailable(kind),
    meter: {
      start: async (opts) => (await loadRecorder()).meter.start(opts),
      stop: () => { recorderImpl?.meter.stop(); },
      subscribe: (cb) => lazySubscribe(loadRecorder, (r) => r.meter.subscribe(cb)),
    },
    record: async (opts) => (await loadRecorder()).record(opts),
    still: async (opts) => (await loadRecorder()).still(opts),
  } as WebHost['recorder'];
  // host.scan (v1.153, plans/162 Part 2) - on-device code reader. Progressive
  // enhancement like media: attached only where a decoder exists so a tool
  // feature-detects `host.scan`. WP-A wires the native BarcodeDetector rung;
  // scanAvailable() is true where the platform provides it. (WP-B will also
  // attach a zxing-wasm-only path for shells without native support.) The wasm
  // chunk stays a separate lazy import inside scan.ts, so this attach is cheap.
  if (scanAvailable()) {
    const scanImpl = createScanAPI();
    void scanImpl.ready; // prime the supported-format list so formats() populates
    host.scan = {
      formats: () => scanImpl.formats(),
      detect: (frame, opts) => scanImpl.detect(frame, opts),
    };
  }
  // host.color (perceptual colour tools, v1.40) and host.geom (path booleans,
  // offset, stroke-to-fill, spline lowering, hit testing, v1.64) are pure engine
  // math attached verbatim so web/CLI/Tauri can never drift - but they are also
  // ~39 KB gz between them (makeColorApi eagerly reaches the ICC/gamut parsers;
  // makeGeomApi reaches the whole bezier/boolean kernel), and NOTHING in this
  // shell reads either one: `grep -rn 'host\.color\|host\.geom' shells/web/src`
  // finds only this file. Their only consumers are TOOL HOOKS, which cannot run
  // before a runtime exists. So they are installed by installToolApis() below,
  // awaited at the single chokepoint every runtime goes through
  // (lib/mount-runtime.ts's createToolRuntime). Both contracts are SYNCHRONOUS
  // (`deltaE` returns a number, `union` returns a path - not promises), so a
  // lazy facade like host.images is not available here; a pre-mount await is.
  // MilkDrop availability + preset attribution (v1.72). `isAvailable` is
  // contractually SYNCHRONOUS, so - exactly like host.audio below - it is answered
  // here by the same lib/viz-support probe the real impl calls, imported directly
  // rather than re-typed so the two cannot drift; `presets` is async and lazy.
  const loadViz = memo(async () => (await import('./viz.ts')).createVizAPI());
  host.viz = {
    isAvailable: () => vizSupported(),
    presets: async () => (await loadViz()).presets(),
  } as WebHost['viz'];

  // Lazy images facade (v1.60): decode/resize/re-encode wraps the upload path's
  // codec glue (and, inside it, the 3 MB lazy HEIC WASM decoder) - none of which
  // belongs in the boot chunk. Built + cached on first host.images call; every
  // ImagesAPI method is async, so the facade is transparent to callers.
  let imagesImpl: NonNullable<WebHost['images']> | null = null;
  const loadImages = async (): Promise<NonNullable<WebHost['images']>> => {
    if (!imagesImpl) { const { createImagesAPI } = await import('./images.ts'); imagesImpl = createImagesAPI(); }
    return imagesImpl;
  };
  host.images = {
    decode: async (input) => (await loadImages()).decode(input),
    resize: async (input, opts) => (await loadImages()).resize(input, opts),
    encode: async (input, opts) => (await loadImages()).encode(input, opts),
  };

  // Lazy raster facade (v1.105): decode/measure/encode for tool hooks doing
  // their OWN canvas pixel work (the filter-* family, darkroom, the logo
  // composers, redact) - the bridge home for the canRaster()/loadImage() probes
  // those hooks used to open-code against the DOM. Wraps the same codec glue as
  // host.images, so it's lazy for the same reason. `canRaster()` is contractually
  // SYNCHRONOUS (a hook branches on it before deciding what to render), so - like
  // host.viz.isAvailable / host.audio.isAvailable - it is answered here from the
  // same feature detection the module's own canRaster() makes, not behind the
  // import. Distinct from host.images (bytes→bytes convert, no pixel access).
  let rasterImpl: NonNullable<WebHost['raster']> | null = null;
  const loadRaster = async (): Promise<NonNullable<WebHost['raster']>> => {
    if (!rasterImpl) { const { createRasterAPI } = await import('./raster.ts'); rasterImpl = createRasterAPI(); }
    return rasterImpl;
  };
  host.raster = {
    canRaster: () => typeof createImageBitmap === 'function' &&
      (typeof OffscreenCanvas === 'function' ||
        (typeof document !== 'undefined' && !!document.createElement)),
    measure: async (src) => (await loadRaster()).measure(src),
    decode: async (src) => (await loadRaster()).decode(src),
    encode: async (source, opts) => (await loadRaster()).encode(source, opts),
  };

  // Lazy audio facade (v1.71) - decode + per-frame analysis. Lazy for the same
  // reason as images: it reaches the ZzFXM renderer and (for procedural song refs)
  // the sequence providers, none of which belongs in the boot chunk. `isAvailable`
  // is contractually SYNCHRONOUS, so it is answered here from feature detection
  // rather than behind the import - the same two things audio.ts itself checks.
  let audioImpl: Required<NonNullable<WebHost['audio']>> | null = null;
  const loadAudio = async (): Promise<Required<NonNullable<WebHost['audio']>>> => {
    if (!audioImpl) { const { createAudioAPI } = await import('./audio.ts'); audioImpl = createAudioAPI(); }
    return audioImpl;
  };
  host.audio = {
    isAvailable: () => typeof Worker === 'function'
      && (typeof window.OfflineAudioContext === 'function'
        || typeof (window as { webkitOfflineAudioContext?: unknown }).webkitOfflineAudioContext === 'function'),
    analyse: async (src, opts) => (await loadAudio()).analyse(src, opts),
    clean: async (src, opts) => (await loadAudio()).clean(src, opts),
  } satisfies Required<NonNullable<WebHost['audio']>>;

  // Lazy speech facade (v1.96; transcription v1.99) - on-device Kokoro TTS and
  // Whisper STT. Lazy for the same reason as audio: bridge/speech.ts owns
  // workers whose chunks drag transformers.js and the phonemizer, none of which
  // belongs in the boot chunk. The SYNCHRONOUS contract methods are answered
  // here without the import: the availability checks from the same feature
  // detection speech.ts itself uses (wasm + Worker - the latter is what answers
  // false under jsdom; transcription also needs the OfflineAudioContext its
  // main-thread decode rides), the byte totals from the pure constants modules
  // (lib/speech-kokoro.ts / lib/speech-whisper.ts, a few hundred bytes).
  const loadSpeech = memo(async () => (await import('./speech.ts')).createSpeechAPI());
  // Typed as the WEB speech surface, not the v1 contract, so `synthesizeLines`
  // (the shell-only per-line regenerate path, plans/181) is forwarded rather
  // than dropped the way a facade silently drops any method it forgets to
  // list. Assigned through a named const because a fresh object literal on
  // `host.speech` would be rejected for the extra method.
  const speechFacade: WebSpeechAPI = {
    isAvailable: () => aiAllowed('speech') && typeof WebAssembly !== 'undefined' && typeof Worker === 'function',
    modelBytes: () => KOKORO_MODEL_BYTES,
    cached: async () => callAiApi('speech', loadSpeech, (api) => api.cached()),
    voices: async () => callAiApi('speech', loadSpeech, (api) => api.voices()),
    synthesize: async (text, opts) => callAiApi('speech', loadSpeech, (api, signal) => api.synthesize(text, { ...opts, signal: opts?.signal ? AbortSignal.any([opts.signal, signal]) : signal })),
    synthesizeLines: async (lines, opts) => callAiApi('speech', loadSpeech, (api, signal) => api.synthesizeLines(lines, { ...opts, signal: opts?.signal ? AbortSignal.any([opts.signal, signal]) : signal })),
    transcribeAvailable: () => aiAllowed('transcription') && typeof WebAssembly !== 'undefined' && typeof Worker === 'function'
      && (typeof window.OfflineAudioContext === 'function'
        || typeof (window as { webkitOfflineAudioContext?: unknown }).webkitOfflineAudioContext === 'function'),
    transcribeModelBytes: () => WHISPER_MODEL_BYTES,
    transcribeCached: async () => callAiApi('transcription', loadSpeech, (api) => api.transcribeCached()),
    transcribe: async (src, opts) => callAiApi('transcription', loadSpeech, (api, signal) => api.transcribe(src, { ...opts, signal: opts?.signal ? AbortSignal.any([opts.signal, signal]) : signal })),
  };
  host.speech = speechFacade;

  // Deep image codecs (v1.100) - a float pixel frame in, deep image bytes out
  // (16-bit PNG / EXR / Radiance / dithered 8-bit). Lazy facade: bridge/codec.ts
  // pulls the engine's off-barrel EXR/Radiance/PNG writers, which have no place
  // in the boot chunk (only a tool's exportStill deep path ever calls this).
  const loadCodec = memo(async () => (await import('./codec.ts')).createCodecAPI());
  host.codec = {
    png16: async (f, o) => (await loadCodec()).png16(f, o),
    exr: async (f, o) => (await loadCodec()).exr(f, o),
    radiance: async (f, o) => (await loadCodec()).radiance(f, o),
    dither8: async (f, o) => (await loadCodec()).dither8(f, o),
  };

  // Layered-bitmap write-back (v1.102) - host.layers.writePsd, the engine's own
  // PSD writer behind a lazy import (psd-write.ts is off the boot chunk; only
  // the darkroom tool's "Download layered PSD" action ever calls it). Blend
  // strings from the open contract are narrowed here: an unknown value writes
  // as 'normal' rather than refusing the file.
  host.layers = {
    writePsd: async (doc) => {
      const mod = await import('../../../../engine/src/psd-write.ts');
      const known = new Set(Object.keys((await import('../../../../engine/src/raster-layers.ts')).CSS_TO_PSD_BLEND));
      return mod.writePsd({
        width: doc.width,
        height: doc.height,
        layers: doc.layers.map((l) => ({
          ...l,
          blend: (l.blend && known.has(l.blend) ? l.blend : 'normal') as import('../../../../engine/src/raster-layers.ts').CssBlendMode,
        })),
      });
    },
  };

  // On-device AI upscaling (v1.101). Lazy facade: bridge/upscale.ts owns a Worker
  // whose chunk drags onnxruntime-web + the tiling/alpha runner, none of which
  // belongs in the boot chunk (only the picker's Upscale affordance ever calls it).
  // The SYNCHRONOUS contract methods are answered here without the import: the
  // availability check from the same feature detection upscale.ts uses (wasm +
  // Worker - the latter answers false under jsdom/CLI), the catalogue + byte totals
  // from the pure constants module (lib/upscale-models.ts). `backend()` reflects the
  // resolved execution provider once a run/canRun has loaded the runner, else null
  // (the contract's "before one is probed" state).
  let upscaleApi: { backend(): 'webgpu' | 'wasm' | null } | null = null;
  const loadUpscale = memo(async () => {
    const api = (await import('./upscale.ts')).createUpscaleAPI();
    upscaleApi = api;
    return api;
  });
  host.upscale = {
    isAvailable: () => aiAllowed('upscale') && typeof WebAssembly !== 'undefined' && typeof Worker === 'function',
    backend: () => upscaleApi?.backend() ?? null,
    // Only OFFER models whose weights are actually vendored - a placeholder-pinned
    // model would promise a download that can never complete (honesty gate).
    models: () => stagedUpscaleModels(),
    modelBytes: (id) => UPSCALE_MODEL_BYTES[id],
    cached: async (id) => callAiApi('upscale', loadUpscale, (api) => api.cached(id)),
    canRun: async (src, o) => callAiApi('upscale', loadUpscale, (api, signal) => api.canRun(src, { ...o, signal: o?.signal ? AbortSignal.any([o.signal, signal]) : signal })),
    run: async (f, o) => callAiApi('upscale', loadUpscale, (api, signal) => api.run(f, { ...o, signal: o?.signal ? AbortSignal.any([o.signal, signal]) : signal })),
  };

  // On-device background removal (v1.103). Same lazy-facade shape as upscale:
  // bridge/matte.ts owns a Worker whose chunk drags onnxruntime-web + the
  // letterbox/compose runner, off the boot budget (only a Remove-Background
  // affordance ever calls it). Sync methods answered here; models() offers only
  // STAGED (licence-verified) weights, so today it is EMPTY until a model is
  // verified - isAvailable() still reports the capability so a tool can show the
  // affordance and the dialog explains the pending download.
  let matteApi: { backend(): 'webgpu' | 'wasm' | null } | null = null;
  const loadMatte = memo(async () => {
    const api = (await import('./matte.ts')).createMatteAPI();
    matteApi = api;
    return api;
  });
  host.matte = {
    isAvailable: () => aiAllowed('matte') && typeof WebAssembly !== 'undefined' && typeof Worker === 'function',
    backend: () => matteApi?.backend() ?? null,
    // Offer only what THIS shell can actually run: a model that needs native ORT (no
    // wasm32 address-space ceiling) appears on the Tauri desktop shell and is withheld
    // on the web/PWA where it would OOM. No model on today's roster needs that gate.
    // matteModelsFor is the shared gate - the offline pre-download (model-prefetch.ts)
    // uses the same one, so the picker and the download can never disagree.
    models: () => matteModelsFor(isTauriShell()),
    modelBytes: (id) => MATTE_MODEL_BYTES[id],
    cached: async (id) => callAiApi('matte', loadMatte, (api) => api.cached(id)),
    canRun: async (src, o) => callAiApi('matte', loadMatte, (api, signal) => api.canRun(src, { ...o, signal: o?.signal ? AbortSignal.any([o.signal, signal]) : signal })),
    run: async (f, o) => callAiApi('matte', loadMatte, (api, signal) => api.run(f, { ...o, signal: o?.signal ? AbortSignal.any([o.signal, signal]) : signal })),
  };

  // On-device text recognition / OCR (plans/125). Same lazy-facade shape as matte:
  // bridge/ocr.ts owns a Worker whose chunk drags onnxruntime-web + the detect→
  // recognise runner, off the boot budget. Sync methods answered here; models()
  // offers only STAGED (licence-verified, spec-confirmed) weights, so today it is
  // EMPTY until a model is vendored - isAvailable() still reports the capability so
  // a surface can feature-detect it. WASM-only: backend() never reports webgpu.
  let ocrApi: { backend(): 'wasm' | null } | null = null;
  const loadOcr = memo(async () => {
    const api = (await import('./ocr.ts')).createOcrAPI();
    ocrApi = api;
    return api;
  });
  host.ocr = {
    isAvailable: () => aiAllowed('ocr') && typeof WebAssembly !== 'undefined' && typeof Worker === 'function',
    backend: () => ocrApi?.backend() ?? null,
    models: () => ocrModelsFor(isTauriShell()),
    modelBytes: (id) => OCR_MODEL_BYTES[id] ?? 0,
    cached: async (id) => callAiApi('ocr', loadOcr, (api) => api.cached(id)),
    canRun: async (src, o) => callAiApi('ocr', loadOcr, (api, signal) => api.canRun(src, { ...o, signal: o?.signal ? AbortSignal.any([o.signal, signal]) : signal })),
    run: async (f, o) => callAiApi('ocr', loadOcr, (api, signal) => api.run(f, { ...o, signal: o?.signal ? AbortSignal.any([o.signal, signal]) : signal })),
  };

  // Content Credentials signing (v1.85; widened v1.104). A lazy facade for the
  // same reason export is: the signer lives inside the 90 KB export bridge, and
  // nothing reaches it before an explicit user opt-in. `readIngredients` reads the
  // manifests a dropped file already carries (its own + SVG-nested rasters) so a
  // fresh authorship claim preserves them rather than orphaning them.
  host.c2pa = {
    sign: async (bytes, format, opts) => {
      const { signFreshC2pa } = await import('./export.ts');
      return signFreshC2pa(host, bytes, format, opts);
    },
    readIngredients: async (bytes) => {
      try {
        const { collectIngredients } = await import('@lolly/engine');
        return collectIngredients(bytes);
      } catch { return []; }
    },
  };

  // pick is a bridge-level concern: it needs the full host (logging, assets.get,
  // assets._uploadUserAsset). Defined here after all sub-APIs are wired so the
  // closure over `host` is complete by the time pick() is actually called.
  host.assets.pick = async (opts: AssetPickerOpts): Promise<AssetRef | null> => {
    const { openPicker } = await import('../views/picker.ts');
    return openPicker(host as unknown as Parameters<typeof openPicker>[0], opts) as Promise<AssetRef | null>;
  };

  // The host is reachable to modules that run before any export (lib/host-ref.ts).
  setHostRef(host);
  // The registry's one-shot migration runs here, inside the awaited bridge build,
  // so everything after createBridge() - the fonts, the first chrome paint, the
  // catalog sync - already sees the active design system (plans/186 section 4:
  // the pointer has to be read before main.ts's first paint). Best-effort: a
  // failed migration leaves the store empty and the tokens bridge on its legacy
  // discovery, which is today's behaviour.
  await host.designSystems.ensure().catch(() => { /* legacy discovery stands */ });
  return host;
}

/**
 * Install the three synchronous, tool-hook-only engine APIs - `host.color`
 * (v1.40), `host.geom` (v1.64) and `host.connectors` (v1.106) - that
 * createBridge() deliberately leaves off the boot path (see the comment where
 * they used to be attached).
 *
 * Idempotent and safe to call concurrently: the in-flight promise is cached, so
 * N runtimes mounting at once share one import. Every path that mounts a tool
 * MUST await this first; do not call it directly - go through
 * lib/mount-runtime.ts's createToolRuntime(), which is the enforced chokepoint.
 *
 * Failure is non-fatal by design: both APIs are OPTIONAL in the v1 contract and
 * tools feature-detect them, so a failed import degrades a colour/vector tool to
 * its own fallback rather than blocking the mount.
 */
let toolApiModules: Promise<{ color: HostV1['color']; geom: HostV1['geom']; connectors: HostV1['connectors'] }> | null = null;
export async function installToolApis(host: HostV1): Promise<void> {
  // Cache the MODULES, not the install: multi-edit and pro/render-export mount
  // runtimes against per-mount host CLONES (scoped net, thumb assets), so the
  // attach step has to run for whichever host object this call was handed.
  if (!toolApiModules) {
    toolApiModules = Promise.all([
      import('../../../../engine/src/color-tools.ts'),
      import('../../../../engine/src/geom-api.ts'),
      import('../../../../engine/src/connectors.ts'),
    ]).then(([c, g, n]) => ({ color: c.makeColorApi(), geom: g.makeGeomApi(), connectors: n.makeConnectorsApi() }));
  }
  try {
    const apis = await toolApiModules;
    host.color ??= apis.color;
    host.geom ??= apis.geom;
    host.connectors ??= apis.connectors;
  } catch (err) {
    toolApiModules = null; // let a later mount retry
    console.warn('[warn] could not install host.color/host.geom/host.connectors', err);
  }
}
