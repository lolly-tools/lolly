// SPDX-License-Identifier: MPL-2.0
import { AiPolicyError, assertAiAllowed, runAi } from './ai-policy.ts';
/**
 * TrustMark deep scan - the neural half of Adobe TrustMark watermark
 * detection (see engine/src/trustmark.ts for the pure BCH/ECC half, which
 * this module hands its raw output to). LAZY BY DESIGN: this file must only
 * ever be reached via a dynamic `import('./trustmark.ts')` from the /verify
 * "Deep scan for watermarks" click handler (shells/web/src/views/valid.ts) - 
 * never a static import anywhere else. That's what keeps onnxruntime-web
 * (a multi-MB dependency before it's even fetched a model) and the tens-of-
 * MB ONNX decoder models entirely out of the boot/preload budget; importing
 * this module eagerly would defeat the whole point of "deep scan" being an
 * opt-in, user-invoked action (see plans/31-watermark-detectors.md).
 *
 * Model bytes are fetched from same-origin `/models/trustmark/<file>.onnx`
 * (see the download instructions in scripts/fetch-trustmark-models.ts - this
 * repo never vendors them; Andy runs that script locally) and cached in
 * IndexedDB - the exact "touch the network exactly once, then serve from
 * on-device storage forever" pattern lib/google-fonts.ts + user-fonts.ts use
 * for font files, applied to a much larger binary. The service worker
 * explicitly bypasses `/models/` (see public/sw.js) so there is only ONE
 * on-device copy of the bytes, not a duplicate in the SW's Cache Storage.
 *
 * ── Honesty ledger - READ BEFORE TRUSTING A DETECTION ────────────────────
 * What IS verified (see tests/trustmark.test.ts): the BCH/ECC math this
 * module hands raw model output to (engine/src/trustmark.ts) is cross-checked
 * bit-for-bit against Adobe's own unmodified reference implementation - a
 * decoded, ECC-valid payload really is a real detection, not a guess.
 *
 * What is UNVERIFIED (nothing in this file has ever been run - there is no
 * ONNX runtime, model, or browser in the dev environment): the ONNX model
 * fetch, onnxruntime-web session creation, the WebGPU/wasm execution
 * providers, and the whole pixel-preprocessing path. This file ports Adobe's
 * reference (js/tm_watermark.js) FAITHFULLY - same input resolutions (Q 256 /
 * P 224), the same NCHW [1,3,H,W] R/G/B plane order, the same 0..1 (/255)
 * normalization with NO mean/std and NO ×2−1 (the ×2−1 belongs only to the
 * separate PyTorch decoder, not these ONNX models), the same crop rule, the
 * same `image` input name, the same `output` tensor read (raw logits,
 * thresholded `v >= 0`, no sigmoid) - but "faithful port" is NOT "verified
 * to detect": only a real-browser run against Adobe's own images/ samples
 * proves the pixels→bits step end-to-end.
 *
 * Preprocessing parity: Adobe resizes via a DEDICATED antialiased Resize
 * graph, `resizer.onnx` (a 454-byte Resize(antialias, cubic, half_pixel) +
 * Clip node, run on the wasm EP because WebGPU lacks antialias), which the
 * decoders were TRAINED against. We now run that same `resizer.onnx` when it
 * is installed (getResizerSession + the resizer path in `preprocess`), and
 * fall back to a high-quality (`imageSmoothingQuality:'high'`) canvas
 * downscale when it is absent or its run faults, or when the source is larger
 * than MAX_RESIZER_PIXELS. The canvas fallback is a documented deviation: its
 * kernel is browser-dependent and NOT pixel-equivalent to resizer.onnx, and a
 * mismatch there can SUPPRESS a real detection (false negative) even though it
 * can never fabricate a false positive (the BCH check downstream still has to
 * pass). Install resizer.onnx (the fetch script grabs it) for parity.
 *
 * Every failure mode here resolves to a discriminated `TrustmarkDetection`
 * status and NEVER throws - but note the distinction the UI depends on:
 * 'not-installed' (no model bytes on device) is NOT the same as 'no-signal'
 * (a decoder ran and found nothing), and absence is NEVER shown as a verdict
 * either way. See TrustmarkDetection below and valid.ts's runDeepScan.
 */

import { decodeTrustmarkPayload, readLollyDurable, TRUSTMARK_PAYLOAD_BITS, type LollyDurable } from '@lolly/engine';
import { openDB } from '../bridge/db.ts';
import {
  createDebugLogger, createModelFetcher, loadOrt, makeCanvas, packNchw01, serializeSessionCreate,
  type FetchProgress,
} from './ort.ts';

/** One of TrustMark's two published decoder variants (js/tm_watermark.js's
 *  `modelConfigs`) - Q first (matches upstream's own ordering; the search
 *  stops at the first schema-valid decode). */
interface TrustmarkModelConfig {
  variantCode: 'Q' | 'P';
  fileName: string;
  resolution: number;
  squareCrop: boolean;
}
const MODEL_CONFIGS: TrustmarkModelConfig[] = [
  { variantCode: 'Q', fileName: 'decoder_Q.onnx', resolution: 256, squareCrop: false },
  { variantCode: 'P', fileName: 'decoder_P.onnx', resolution: 224, squareCrop: true },
];
/** The antialiased Resize graph Adobe's decoders were trained against - an
 *  OPTIONAL third model. Absent → we fall back to a canvas resize (see
 *  `preprocess`). Fetched by scripts/fetch-trustmark-models.ts alongside the
 *  decoders. */
const RESIZER_FILE = 'resizer.onnx';

/** onnxruntime-web execution providers for the DECODERS, in preference order.
 *  WebGPU matches Adobe's reference; the runtime falls back to wasm on its own
 *  when webgpu can't initialize (no adapter, insecure context, old browser). */
const DECODER_PROVIDERS = ['wasm'] as const;

/** Above this many source pixels we skip resizer.onnx and use the canvas
 *  fallback: the resizer consumes a full-resolution NCHW float32 tensor
 *  (12 bytes/pixel), so an unbounded source could allocate hundreds of MB.
 *  12 MP ≈ 144 MB for the tensor alone - a deliberate memory ceiling, not a
 *  quality choice. */
const MAX_RESIZER_PIXELS = 12_000_000;

/** Bump when the vendored .onnx files are replaced with a different release
 *  (e.g. Adobe ships a retrained decoder) - invalidates the IndexedDB cache
 *  so stale model bytes are never reused. */
// Bump to invalidate poisoned cache entries. v1→v2: earlier builds cached the
// dev server's SPA-fallback index.html (a 200 for a not-yet-downloaded model)
// as if it were the model, so ORT then failed with "protobuf parsing failed";
// v2 both busts those entries and adds the HTML-response guard in fetchModelBytes.
const MODEL_CACHE_VERSION = 2;

/** The four real outcomes of a deep scan - see TrustmarkDetection.status. */
export type TrustmarkStatus = 'not-installed' | 'no-signal' | 'detected' | 'error';

export interface TrustmarkDetection {
  /** Discriminates the outcomes so the UI can say the RIGHT thing (see
   *  shells/web/src/views/valid.ts's runDeepScan) - the crucial fix for
   *  "model not installed" reading as "no watermark found":
   *   - 'detected'      a real, ECC-validated TrustMark read (payloadHex/schema set).
   *   - 'no-signal'     a decoder RAN but no variant's output passed the BCH
   *                     check - checks ONE watermark, rules out nothing else.
   *   - 'not-installed' no decoder model bytes on device (the fetch script
   *                     hasn't been run) - NEVER means the image is clean.
   *   - 'error'         onnxruntime/session/inference faulted unexpectedly.
   *  Only 'detected' is ever rendered as a positive verdict; absence is never
   *  a verdict either way. */
  status: TrustmarkStatus;
  /** Lowercase hex of the recovered, error-corrected payload bits ('detected' only). */
  payloadHex?: string;
  /** The BCH schema that validated (e.g. 'BCH_5') - 'detected' only, informational. */
  schema?: string;
  /** Which decoder model produced the hit ('Q' or 'P' - see MODEL_CONFIGS). */
  variant?: 'Q' | 'P';
  /** Set on 'detected' when the ECC-valid payload is one of Lolly's OWN durable
   *  marks (engine readLollyDurable: magic + layout revision recognised), else
   *  null. Pure on-device recognition - NO manifest-resolution server involved
   * - so /verify can show a "durable Lolly credential" pip without one. */
  lolly?: LollyDurable | null;
}

// ── Terse, opt-in diagnostics ───────────────────────────────────────────────
// Turn on in DevTools with either
//   localStorage.setItem('lolly:trustmark:debug', '1')
//   window.__TRUSTMARK_DEBUG__ = true
// to see WHERE a scan falls off: model fetch (ok/404 + url), session created
// (+ requested providers), inference done (+ output name/shape/sample logits),
// decoded bit count, and the BCH pass/fail. Deliberately a SEPARATE switch from
// Content Seal's - see lib/ort.ts's createDebugLogger.
const dbg = createDebugLogger({
  tag: 'trustmark', storageKey: 'lolly:trustmark:debug', globalFlag: '__TRUSTMARK_DEBUG__',
});

// A tiny non-model record under this reserved key records "a decoder is cached at
// the current version" so readiness can be checked WITHOUT loading a 45 MB blob.
// getSession/fetchModelBytes only ever read specific decoder_* / resizer keys, so
// this marker is inert to them.
const READY_KEY = '__ready__';

// ── Model bytes: fetch-once, IndexedDB-forever (lib/ort.ts, shared with contentseal) ──
// A cacheOnly (passive background) scan never hits the network - a ~45 MB decoder
// download is opt-in, gated behind the explicit "Deep scan" button; not in cache ⇒
// report absent so the button stays offered.
const fetchModelBytes = createModelFetcher({
  store: 'trustmark-models',
  dir: 'trustmark',
  version: MODEL_CACHE_VERSION,
  dbg,
  // Once a DECODER is cached the passive background scan can run offline - set the
  // tiny readiness marker the /verify header reads to decide auto-scan vs. show the
  // one-time download banner (see trustmarkModelsReady).
  afterCache: async (fileName, db) => {
    if (/^decoder_/.test(fileName)) {
      await db.put('trustmark-models', { ready: true, version: MODEL_CACHE_VERSION }, READY_KEY);
    }
  },
});

/** True when a TrustMark decoder is cached on-device at the current version, so a
 *  scan needs NO download. The /verify header uses this to run the deep scan
 *  automatically (ready) vs. offer a one-time download banner (not ready). */
export async function trustmarkModelsReady(): Promise<boolean> {
  try {
    const db = await openDB();
    const rec = await db.get('trustmark-models', READY_KEY) as { version?: number } | undefined;
    return rec?.version === MODEL_CACHE_VERSION;
  } catch { return false; }
}

/** Download + cache the decoders (and resizer) once - the header "enable deep
 *  scan" action, so a whole batch benefits from one consented fetch. Returns
 *  true when at least one decoder is now cached. Network-allowed (NOT cacheOnly).
 *  Best-effort; never throws.
 *
 *  `onProgress`, if given, reports a RUNNING TOTAL across all three files (Q,
 *  P, resizer) as one combined {loaded,total} - a cache hit or a 404/network
 *  failure folds that file's final (or zero) size in without ever calling
 *  onProgress for it, so the bar only reflects bytes actually observed. `total`
 *  goes (and stays) null the moment any file in the sequence never reports a
 *  Content-Length - an honest indeterminate state rather than a guessed number. */
export async function prefetchTrustmarkModels(opts: { onProgress?: (p: FetchProgress) => void } = {}): Promise<boolean> {
  const { onProgress } = opts;
  let doneBytes = 0, doneTotal = 0, unknownTotal = false;
  const onFileProgress = onProgress
    ? (p: FetchProgress): void => {
        if (p.total == null) unknownTotal = true;
        onProgress({ loaded: doneBytes + p.loaded, total: unknownTotal ? null : doneTotal + (p.total ?? 0) });
      }
    : undefined;
  // Folds one file's FINAL size into the running total once its fetch settles - 
  // covers the cache-hit / cacheOnly-miss / 404 paths, none of which ever call
  // onFileProgress, so without this the bar would silently omit that file.
  const settle = (bytes: ArrayBuffer | null): void => {
    if (bytes) { doneBytes += bytes.byteLength; doneTotal += bytes.byteLength; }
    else unknownTotal = true; // not installed / offline - size never learned
  };

  const q = await fetchModelBytes(MODEL_CONFIGS[0]!.fileName, false, onFileProgress).catch(() => null);
  settle(q);
  // P and the resizer are best-effort - fetch them so P-variant images and the
  // antialiased resize path also work, but a failure there doesn't block Q.
  for (const c of MODEL_CONFIGS.slice(1)) {
    const bytes = await fetchModelBytes(c.fileName, false, onFileProgress).catch(() => null);
    settle(bytes);
  }
  const resizerBytes = await fetchModelBytes(RESIZER_FILE, false, onFileProgress).catch(() => null);
  settle(resizerBytes);
  return !!q;
}

// ── onnxruntime-web: lazy import, one session per model, memoised ───────────

type OrtModule = typeof import('onnxruntime-web');
type InferenceSession = Awaited<ReturnType<OrtModule['InferenceSession']['create']>>;
/** The ORT Tensor type, derived structurally so this module needs NO static
 *  (even type-only) import of onnxruntime-web that a bundler might trip over. */
type OrtTensor = Awaited<ReturnType<InferenceSession['run']>>[string];

// ORT module + wasm init are shared with the other deep-scan detectors (see
// lib/ort.ts) so concurrent scans can't race ORT's one-time initWasm().

/** getSession's tri-state result - the distinction the UI's 'not-installed'
 *  vs 'error' vs 'no-signal' messaging rests on: no bytes on device is a very
 *  different thing from bytes that failed to load. */
type SessionOutcome =
  | { kind: 'ok'; session: InferenceSession }
  | { kind: 'not-installed' }
  | { kind: 'error'; error: unknown };

const sessionCache = new Map<string, Promise<SessionOutcome>>();
function getSession(ort: OrtModule, config: TrustmarkModelConfig, cacheOnly = false): Promise<SessionOutcome> {
  const existing = sessionCache.get(config.fileName);
  if (existing) return existing;
  const pending = (async (): Promise<SessionOutcome> => {
    const bytes = await fetchModelBytes(config.fileName, cacheOnly);
    if (!bytes) return { kind: 'not-installed' }; // 404 / offline / cacheOnly miss / never vendored
    try {
      const session = await serializeSessionCreate(() => ort.InferenceSession.create(new Uint8Array(bytes), {
        executionProviders: [...DECODER_PROVIDERS],
        // Force CPU-backed output tensors so `.data` is populated and readable
        // synchronously even under the WebGPU EP (a gpu-buffer output's `.data`
        // getter throws - see runDecoder's defensive read).
        preferredOutputLocation: 'cpu',
      }));
      return { kind: 'ok', session };
    } catch (err) {
      // Bytes present but the runtime couldn't build a session (corrupt model,
      // unsupported opset, no EP could init) - an ERROR, not "not installed".
      console.warn(`[trustmark] could not create session for ${config.fileName}`, err);
      return { kind: 'error', error: err };
    }
  })();
  sessionCache.set(config.fileName, pending);
  // Keep the memo ONLY for a live session. A miss (e.g. a passive cacheOnly scan
  // before the models are downloaded) must not be sticky, or the scan that runs
  // right after the header download would still see "not-installed".
  void pending.then((o) => { if (o.kind !== 'ok') sessionCache.delete(config.fileName); }, () => sessionCache.delete(config.fileName));
  return pending;
}

/** The optional antialiased resizer session (wasm EP - WebGPU lacks antialias,
 *  matching Adobe's own choice). Null when resizer.onnx isn't installed or its
 *  load faults; callers then fall back to a canvas resize. Memoised. */
let resizerPromise: Promise<InferenceSession | null> | null = null;
function getResizerSession(ort: OrtModule, cacheOnly = false): Promise<InferenceSession | null> {
  if (!resizerPromise) {
    const p = (async (): Promise<InferenceSession | null> => {
      const bytes = await fetchModelBytes(RESIZER_FILE, cacheOnly);
      if (!bytes) { dbg('resizer', { status: 'not-installed', file: RESIZER_FILE }); return null; }
      try {
        const session = await serializeSessionCreate(() => ort.InferenceSession.create(new Uint8Array(bytes), {
          executionProviders: ['wasm'],
        }));
        dbg('resizer', { status: 'loaded', providers: ['wasm'] });
        return session;
      } catch (err) {
        dbg('resizer', { status: 'load-error', error: (err as Error)?.message });
        return null;
      }
    })();
    resizerPromise = p;
    // Don't make a null (missing/failed) resizer sticky - a later run after the
    // header download should pick up the freshly-cached resizer.onnx.
    void p.then((s) => { if (!s) resizerPromise = null; }, () => { resizerPromise = null; });
  }
  return resizerPromise;
}

// ── Pixel preprocessing (mirrors js/tm_watermark.js) ────────────────────────
// crop-to-square (when needed) → resize to the model's input → NCHW [1,3,H,W]
// float32 in [0,1]. Preferred resize is Adobe's resizer.onnx; canvas is the
// documented fallback (see the module header's honesty ledger).

// makeCanvas + packNchw01 are shared with lib/contentseal.ts (see lib/ort.ts).

/** Adobe's runResizeModelSquare crop rule: only crop when the aspect ratio is
 *  extreme (>2 or <0.5) or the variant demands a square input (P); a moderate
 *  aspect ratio is left uncropped and gets anisotropically resized straight to
 *  size×size. Upstream writes it as two mutually-exclusive ifs (landscape vs
 *  portrait); this else-if is equivalent. */
function cropRect(width: number, height: number, config: TrustmarkModelConfig): { x: number; y: number; w: number; h: number } {
  const aspectRatio = width / height;
  const landscape = aspectRatio >= 1;
  let x = 0, y = 0, w = width, h = height;
  if (landscape && (aspectRatio > 2 || config.squareCrop)) {
    w = height;
    x = Math.floor((width - w) / 2);
  } else if (!landscape && (aspectRatio < 0.5 || config.squareCrop)) {
    h = width;
    y = Math.floor((height - h) / 2);
  }
  return { x, y, w, h };
}

/** Verbatim port of js/tm_watermark.js's computeScalesFixed: bisects, per
 *  axis, the float scale whose floor(originalSize·scale) lands exactly on the
 *  target - the exact `scales` Adobe feeds resizer.onnx's Resize node. Returns
 *  NCHW scales [1, 1, scaleH, scaleW] (target is square, so both use `size`). */
function computeScalesFixed(size: number, srcH: number, srcW: number): Float32Array {
  const solve = (originalSize: number, targetSize: number): number => {
    let minScale = targetSize / originalSize;
    let maxScale = (targetSize + 1) / originalSize;
    let scale = minScale;
    const tolerance = 1e-12;
    for (let it = 0; it < 100; it++) {
      scale = (minScale + maxScale) / 2;
      const adjusted = Math.floor(originalSize * scale + tolerance);
      if (adjusted < targetSize) minScale = scale;
      else if (adjusted > targetSize) maxScale = scale;
      else break;
    }
    return scale;
  };
  return new Float32Array([1, 1, solve(srcH, size), solve(srcW, size)]);
}

/** Produces the decoder's `image` input tensor from already-decoded RGBA.
 *  Prefers resizer.onnx (training-distribution parity); falls back to a
 *  high-quality canvas downscale. */
async function preprocess(
  ort: OrtModule, resizerSession: InferenceSession | null,
  rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, config: TrustmarkModelConfig,
): Promise<OrtTensor> {
  const src = makeCanvas(width, height);
  const sctx = src.getContext('2d') as CanvasRenderingContext2D;
  // Always copy into a fresh, plain-ArrayBuffer-backed Uint8ClampedArray: the
  // ImageData constructor rejects a view over a SharedArrayBuffer, which
  // `rgba`'s declared type doesn't rule out.
  const clamped = new Uint8ClampedArray(rgba.length);
  clamped.set(rgba);
  sctx.putImageData(new ImageData(clamped, width, height), 0, 0);

  const { x: cropX, y: cropY, w: cropW, h: cropH } = cropRect(width, height, config);
  const size = config.resolution;

  // Preferred: Adobe's antialiased resizer.onnx (cubic, half_pixel), the exact
  // resize decoder_Q/P were TRAINED against. Bounded by memory + fully
  // fallback-guarded, so a fault here can never break the scan.  [UNVERIFIED]
  if (resizerSession && cropW * cropH <= MAX_RESIZER_PIXELS) {
    try {
      const cropData = sctx.getImageData(cropX, cropY, cropW, cropH).data;
      const X = new ort.Tensor('float32', packNchw01(cropData, cropW, cropH), [1, 3, cropH, cropW]);
      const scales = new ort.Tensor('float32', computeScalesFixed(size, cropH, cropW), [4]);
      const targetSize = new ort.Tensor('int64', new BigInt64Array([BigInt(size)]), [1]);
      assertAiAllowed('watermark');
      const res = await resizerSession.run({ X, scales, target_size: targetSize });
      const y = res.Y ?? res[Object.keys(res)[0] ?? ''];
      if (y) {
        dbg('resize', { path: 'resizer.onnx', variant: config.variantCode, crop: [cropW, cropH], out: y.dims });
        return y;
      }
      dbg('resize', { path: 'resizer.onnx', variant: config.variantCode, note: 'no Y output; falling back to canvas' });
    } catch (err) {
      dbg('resize', { path: 'resizer.onnx', variant: config.variantCode, note: 'failed; falling back to canvas', error: (err as Error)?.message });
    }
  }

  // Fallback: high-quality canvas downscale. `imageSmoothingQuality:'high'` is
  // a strictly-better-than-default antialias, but still NOT pixel-equivalent to
  // resizer.onnx - the leading documented false-negative risk.  [UNVERIFIED]
  const dst = makeCanvas(size, size);
  const dctx = dst.getContext('2d') as CanvasRenderingContext2D;
  dctx.imageSmoothingEnabled = true;
  dctx.imageSmoothingQuality = 'high';
  dctx.drawImage(src as CanvasImageSource, cropX, cropY, cropW, cropH, 0, 0, size, size);
  const data = dctx.getImageData(0, 0, size, size).data;
  dbg('resize', { path: 'canvas', variant: config.variantCode, crop: [cropW, cropH], out: [size, size] });
  return new ort.Tensor('float32', packNchw01(data, size, size), [1, 3, size, size]);
}

/** Runs one decoder session on the preprocessed `image` tensor and returns its
 *  100-bit boolean output as 0/1s, or null if the run didn't produce a usable
 *  output. `results.output` is the tensor name in Adobe's published ONNX
 *  graphs; the first tensor in the result map is a defensive fallback in case a
 *  vendored model names it differently (unverified - see module header). */
async function runDecoder(session: InferenceSession, imageTensor: OrtTensor): Promise<number[] | null> {
  assertAiAllowed('watermark');
  const results = await session.run({ image: imageTensor });
  const outName = results.output ? 'output' : (Object.keys(results)[0] ?? '');
  const out: OrtTensor | undefined = results[outName];

  // Defensive CPU read (mirrors Adobe reading results['output']['cpuData']):
  // preferredOutputLocation:'cpu' should make `.data` valid, but a gpu-buffer
  // tensor's `.data` getter THROWS - so read it only when CPU-resident, else
  // pull the async CPU copy. Either way a failure just yields null → no-signal.
  let raw: ArrayLike<number> | undefined;
  try {
    if (out && out.location === 'cpu') {
      raw = out.data as unknown as ArrayLike<number>;
    } else if (out && typeof out.getData === 'function') {
      raw = (await out.getData(false)) as unknown as ArrayLike<number>;
    }
  } catch {
    raw = undefined;
  }

  const sample = raw && raw.length
    ? Array.from({ length: Math.min(6, raw.length) }, (_, i) => Number(raw![i]).toFixed(3))
    : [];
  dbg('inference', { outName, dims: out?.dims, location: out?.location, length: raw?.length ?? 0, sample });

  if (!raw || raw.length !== TRUSTMARK_PAYLOAD_BITS) return null;
  return Array.from(raw, (v) => (v >= 0 ? 1 : 0));
}

/**
 * Runs a TrustMark deep scan on already-decoded RGBA pixels. Tries each model
 * variant (Q, then P) and returns a DISCRIMINATED status (see
 * TrustmarkDetection): 'detected' on the first ECC-valid decode; 'no-signal'
 * when a decoder ran but nothing validated; 'not-installed' when no model
 * bytes are on device; 'error' on an unexpected fault. NEVER throws. See this
 * module's header for exactly what a detection guarantees and what remains
 * unverified.
 */
export async function detectTrustmark(
  rgba: Uint8ClampedArray | Uint8Array, width: number, height: number,
  opts: { cacheOnly?: boolean } = {},
): Promise<TrustmarkDetection> {
  try { return await runAi('watermark', () => detectTrustmarkImpl(rgba, width, height, opts)); }
  catch (error) { if (error instanceof AiPolicyError) return { status: 'error' }; throw error; }
}

async function detectTrustmarkImpl(
  rgba: Uint8ClampedArray | Uint8Array, width: number, height: number,
  opts: { cacheOnly?: boolean } = {},
): Promise<TrustmarkDetection> {
  const cacheOnly = !!opts.cacheOnly;
  try {
    if (width < 8 || height < 8) return { status: 'error' };
    const ort = await loadOrt();
    // Opportunistic - null just means the canvas resize fallback is used.
    const resizerSession = await getResizerSession(ort, cacheOnly);

    let sessionRan = false;      // a decoder session was obtained + inference attempted
    let bitsProduced = false;    // a decoder returned a well-formed 100-bit vector
    let notInstalledAny = false; // a variant had no model bytes on device
    let loadErrAny = false;      // a variant had bytes but the session failed to build

    for (const config of MODEL_CONFIGS) {
      const outcome = await getSession(ort, config, cacheOnly);
      if (outcome.kind === 'not-installed') {
        notInstalledAny = true;
        dbg('model', { variant: config.variantCode, file: config.fileName, status: 'not-installed' });
        continue;
      }
      if (outcome.kind === 'error') {
        loadErrAny = true;
        dbg('model', { variant: config.variantCode, file: config.fileName, status: 'load-error', error: (outcome.error as Error)?.message });
        continue;
      }
      dbg('session', { variant: config.variantCode, file: config.fileName, providers: DECODER_PROVIDERS });
      sessionRan = true;

      const imageTensor = await preprocess(ort, resizerSession, rgba, width, height, config);
      const bits = await runDecoder(outcome.session, imageTensor);
      if (!bits) continue; // output missing/malformed - sessionRan stays true → 'error' if nothing better
      bitsProduced = true;

      const decoded = decodeTrustmarkPayload(bits);
      dbg('decode', { variant: config.variantCode, bitCount: bits.length, valid: decoded.valid, schema: decoded.schema, version: decoded.version });
      if (decoded.valid) {
        return { status: 'detected', payloadHex: decoded.payloadHex, schema: decoded.schema, variant: config.variantCode, lolly: readLollyDurable(decoded) };
      }
    }

    // A decoder produced proper output but nothing validated → the honest
    // "ran, found nothing THIS check looks for". Distinct from a session that
    // ran but never yielded usable bits (an error), and from no model at all.
    if (bitsProduced) return { status: 'no-signal' };
    if (sessionRan || loadErrAny) return { status: 'error' };
    if (notInstalledAny) return { status: 'not-installed' };
    return { status: 'not-installed' };
  } catch (err) {
    console.warn('[trustmark] deep scan failed', err);
    return { status: 'error' };
  }
}
