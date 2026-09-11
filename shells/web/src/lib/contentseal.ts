// SPDX-License-Identifier: MPL-2.0
import { AiPolicyError, assertAiAllowed, runAi } from './ai-policy.ts';
/**
 * Meta Content Seal deep scan - the neural half of Pixel Seal / Video Seal
 * (image-mode) watermark detection (see engine/src/contentseal.ts for the pure,
 * message-free consensus rule this module hands its per-view bits to). LAZY BY
 * DESIGN: reach this file only via a dynamic `import('./contentseal.ts')` from
 * the /verify "Deep scan for watermarks" click handler
 * (shells/web/src/views/valid.ts) - never a static import. That is what keeps
 * onnxruntime-web (a multi-MB dependency) and the ONNX extractor entirely out of
 * the boot/preload budget; it loads once, only if someone runs a deep scan. It
 * rides the exact same onnxruntime-web runtime and IndexedDB-cache machinery as
 * lib/trustmark.ts - this is that architecture, pointed at a different maker's
 * watermark.
 *
 * Model bytes are fetched from same-origin `/models/contentseal/<file>.onnx`
 * (produced by the Andy-run scripts/convert-contentseal-onnx.py - this repo
 * never vendors them) and cached in IndexedDB (store 'contentseal-models', see
 * shells/web/src/bridge/db.ts) - the "touch the network once, then serve from
 * on-device storage forever" pattern lib/google-fonts.ts + lib/trustmark.ts use.
 * The service worker bypasses `/models/` (public/sw.js) so there is only ONE
 * on-device copy.
 *
 * ── The message-free detection rule (mirrors the spec) ───────────────────────
 * There is no registered key, so we decide "is a consistent message present?"
 * by ROBUSTNESS, not by matching a known message. Build four views of the
 * candidate - V0 original, V1 JPEG q85, V2 JPEG q60, V3 5% centre crop - run the
 * extractor on each (resize→256², ×2−1, ConvNeXt backbone + pixel decoder →
 * per-pixel [1,257,256,256] logits), spatially average to [1,257], DROP index 0
 * (the auxiliary detection bit, treated as unreliable per the reference), and
 * threshold indices 1: at 0 to get 256 message bits per view. A genuine Pixel
 * Seal mark decodes to the SAME 256 bits under all four augmentations; an
 * un-watermarked image decodes to augmentation-dependent noise. The pure engine
 * rule (contentSealConsensus) counts unanimous bit positions and fires only when
 * that count clears tau - see engine/src/contentseal.ts for the FP math and its
 * honesty caveat. Only a positive read is ever surfaced; absence is never a
 * verdict.
 *
 * ── Muse-proprietary caveat (surfaced in the UI, never over-claimed) ─────────
 * Meta's production "Muse Image" pipeline uses a PROPRIETARY Content Seal
 * variant, NOT these open pixelseal/videoseal weights (facebookresearch/
 * content-seal states so explicitly). This open extractor reliably detects only
 * content watermarked with the OPEN Pixel Seal / Video Seal image models - it
 * may decode genuine Muse watermarks as noise and report "absent". The /verify
 * copy (valid.ts) says this plainly; never claim it detects "Meta Muse" or
 * "Meta AI images" generally.
 *
 * ── Honesty ledger - READ BEFORE TRUSTING A DETECTION ────────────────────────
 * What IS verified (tests/contentseal.test.ts): the pure consensus math in
 * engine/src/contentseal.ts (identical messages → present, independent noise →
 * absent, the tau boundary). What is UNVERIFIED - nothing in THIS file has ever
 * been run (no ONNX runtime, no converted checkpoint, no browser in the dev
 * environment): the ONNX fetch, onnxruntime-web session creation, the
 * WebGPU/wasm execution providers, the whole canvas view-building + pixel
 * preprocessing path, and - critically - whether the converted extractor's raw
 * output matches the torch reference at all (the conversion itself is Andy-run
 * and unvalidated here). This is a spec written to typecheck, NOT a proven
 * end-to-end detector.
 *
 * Every failure mode resolves to a discriminated `ContentSealDetection` status
 * and NEVER throws - with the same 'not-installed' (no model bytes on device)
 * vs 'no-signal' (extractor ran, no consistent message) distinction the UI
 * depends on. Absence is NEVER shown as a verdict either way.
 */

import { contentSealConsensus, CONTENTSEAL_MESSAGE_BITS } from '@lolly/engine';
import {
  createDebugLogger, createModelFetcher, loadOrt, makeCanvas, packNchw01, serializeSessionCreate,
  type FetchProgress,
} from './ort.ts';

/** The converted ONNX extractor (scripts/convert-contentseal-onnx.py). One
 *  single-image graph: [1,3,H,W] float32 in [0,1] → interpolate to 256² → ×2−1
 *  → ConvNeXt/pixel-decoder → spatial-mean → [1,257] logits (index 0 detection,
 *  1: message). Fetched from /models/contentseal/. */
const MODEL_FILE = 'content-seal-extractor.onnx';
const MODEL_DIR = 'contentseal';

/** The processing resolution the extractor was trained at (videoseal card
 *  `img_size_proc: 256`). The converted graph interpolates internally, but we
 *  resize each view to this in canvas first so the input tensor stays small and
 *  fixed. */
const PROC_SIZE = 256;

/** How many augmented views the consensus test compares. tau in the engine rule
 *  (CONTENTSEAL_DEFAULT_TAU) is calibrated for exactly this count - feeding a
 *  different number would change the per-position unanimity chance and break the
 *  false-positive bound, so anything short of all four views is an 'error', not a
 *  smaller-N scan. */
const EXPECTED_VIEWS = 4;

/** onnxruntime-web execution providers, in preference order. WebGPU first; the
 *  runtime falls back to wasm on its own when webgpu can't initialize (no
 *  adapter, insecure context, old browser). */
const PROVIDERS = ['wasm'] as const;

/** Bump when the vendored .onnx is replaced with a differently-converted or
 *  retrained extractor - invalidates the IndexedDB cache so stale model bytes
 *  are never reused. */
// Bump to invalidate poisoned cache entries (SPA-fallback HTML cached as a
// model → ORT "protobuf parsing failed"). See fetchModelBytes' HTML guard.
const MODEL_CACHE_VERSION = 2;

/** The four real outcomes of a deep scan - the SAME discriminated shape as
 *  detectTrustmark, so valid.ts's runDeepScan handles both identically. */
export type ContentSealStatus = 'not-installed' | 'no-signal' | 'detected' | 'error';

export interface ContentSealDetection {
  /** Discriminates the outcomes so the UI says the RIGHT thing:
   *   - 'detected'      a consistent message survived all four views (present).
   *   - 'no-signal'     the extractor RAN but no consistent message emerged - 
   *                     checks ONE specific watermark, rules out nothing else.
   *   - 'not-installed' no extractor bytes on device (the convert script hasn't
   *                     been run) - NEVER means the image is clean.
   *   - 'error'         onnxruntime/session/inference/view-building faulted.
   *  Only 'detected' is ever rendered as a positive verdict. */
  status: ContentSealStatus;
  /** The consensus message packed MSB-first to lowercase hex ('detected' only). */
  messageHex?: string;
  /** U - unanimous bit positions across the four views ('detected' only, info). */
  unanimous?: number;
  /** Message bits compared (256) ('detected' only, informational). */
  bits?: number;
}

// ── Terse, opt-in diagnostics ────────────────────────────────────────────────
// Turn on in DevTools with either
//   localStorage.setItem('lolly:contentseal:debug', '1')
//   window.__CONTENTSEAL_DEBUG__ = true
// to see where a scan falls off: model fetch, session creation, per-view
// inference, and the final consensus (U / tau / present). Deliberately a
// SEPARATE switch from TrustMark's - see lib/ort.ts's createDebugLogger.
const dbg = createDebugLogger({
  tag: 'contentseal', storageKey: 'lolly:contentseal:debug', globalFlag: '__CONTENTSEAL_DEBUG__',
});

// ── Model bytes: fetch-once, IndexedDB-forever (lib/ort.ts, shared with trustmark) ──
// Until scripts/convert-contentseal-onnx.py has been run the model is simply
// absent, so every call here returns null → 'not-installed'.
const fetchModelBytes = createModelFetcher({
  store: 'contentseal-models', dir: MODEL_DIR, version: MODEL_CACHE_VERSION, dbg,
});

// ── onnxruntime-web: lazy import, one memoised session ────────────────────────

type OrtModule = typeof import('onnxruntime-web');
type InferenceSession = Awaited<ReturnType<OrtModule['InferenceSession']['create']>>;
/** The ORT Tensor type, derived structurally so this module needs NO static
 *  (even type-only) import of onnxruntime-web that a bundler might trip over. */
type OrtTensor = Awaited<ReturnType<InferenceSession['run']>>[string];

// ORT module + wasm init are shared with the other deep-scan detectors (see
// lib/ort.ts) so a scan that runs TrustMark and Content Seal together can't race
// ORT's one-time initWasm() - the failure that produced "multiple calls to
// 'initWasm()' detected" and made every session error out.

/** getSession's tri-state result - the distinction the UI's 'not-installed' vs
 *  'error' vs 'no-signal' messaging rests on: no bytes on device is a very
 *  different thing from bytes that failed to load. */
type SessionOutcome =
  | { kind: 'ok'; session: InferenceSession }
  | { kind: 'not-installed' }
  | { kind: 'error'; error: unknown };

let sessionPromise: Promise<SessionOutcome> | null = null;
function getSession(ort: OrtModule, cacheOnly = false): Promise<SessionOutcome> {
  if (sessionPromise) return sessionPromise;
  const p = (async (): Promise<SessionOutcome> => {
    const bytes = await fetchModelBytes(MODEL_FILE, cacheOnly);
    if (!bytes) return { kind: 'not-installed' }; // 404 / offline / cacheOnly miss / never converted
    try {
      const session = await serializeSessionCreate(() => ort.InferenceSession.create(new Uint8Array(bytes), {
        executionProviders: [...PROVIDERS],
        // Force CPU-backed output so `.data` is readable synchronously even
        // under WebGPU (a gpu-buffer output's `.data` getter throws - see the
        // defensive read in runExtractor).
        preferredOutputLocation: 'cpu',
      }));
      return { kind: 'ok', session };
    } catch (err) {
      // Bytes present but the runtime couldn't build a session (corrupt model,
      // unsupported opset, no EP could init) - an ERROR, not "not installed".
      console.warn(`[contentseal] could not create session for ${MODEL_FILE}`, err);
      return { kind: 'error', error: err };
    }
  })();
  sessionPromise = p;
  // Keep the memo ONLY for a live session, so a cacheOnly miss before the model
  // is fetched isn't sticky (mirrors trustmark.ts getSession).
  void p.then((o) => { if (o.kind !== 'ok') sessionPromise = null; }, () => { sessionPromise = null; });
  return p;
}

// ── View building (all canvas/DOM - engine stays DOM-free) ───────────────────
// Four augmented views of the candidate, each resized to 256², packed NCHW
// [1,3,256,256] float32 in [0,1] (the converted graph applies its own ×2−1).

// makeCanvas + packNchw01 are shared with lib/trustmark.ts (see lib/ort.ts).

/** JPEG-encode a canvas at `quality` (0..1). Unifies OffscreenCanvas
 *  (convertToBlob) and HTMLCanvasElement (toBlob); null on any failure. */
function canvasToJpeg(canvas: OffscreenCanvas | HTMLCanvasElement, quality: number): Promise<Blob | null> {
  if ('convertToBlob' in canvas) {
    return canvas.convertToBlob({ type: 'image/jpeg', quality }).catch(() => null);
  }
  return new Promise((resolve) => {
    (canvas as HTMLCanvasElement).toBlob((b) => resolve(b), 'image/jpeg', quality);
  });
}

/** Draws a source region into a fresh 256² canvas (high-quality resample) and
 *  returns its RGBA bytes - the common last step of every view. */
function drawTo256(src: CanvasImageSource, sx: number, sy: number, sw: number, sh: number): Uint8ClampedArray {
  const c = makeCanvas(PROC_SIZE, PROC_SIZE);
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, PROC_SIZE, PROC_SIZE);
  return ctx.getImageData(0, 0, PROC_SIZE, PROC_SIZE).data;
}

/** The full-resolution source canvas the views are derived from. */
function sourceCanvas(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  const c = makeCanvas(width, height);
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  // Copy into a fresh, plain-ArrayBuffer-backed Uint8ClampedArray: the ImageData
  // constructor rejects a view over a SharedArrayBuffer, which `rgba`'s declared
  // type doesn't rule out.
  const clamped = new Uint8ClampedArray(rgba.length);
  clamped.set(rgba);
  ctx.putImageData(new ImageData(clamped, width, height), 0, 0);
  return c;
}

/** Builds the four extractor input tensors (V0 original, V1 JPEG q85, V2 JPEG
 *  q60, V3 5% centre crop), each [1,3,256,256]. null on any failure (a browser
 *  that can't JPEG-encode, a decode fault) - the caller maps that to 'error'
 *  rather than scanning with a different, tau-invalidating number of views. */
async function buildViews(
  ort: OrtModule, rgba: Uint8ClampedArray | Uint8Array, width: number, height: number,
): Promise<OrtTensor[] | null> {
  try {
    const src = sourceCanvas(rgba, width, height);

    // 5% centre crop (drop ~5% each edge) - the heavy geometric augmentation.
    const cx = Math.floor(width * 0.05), cy = Math.floor(height * 0.05);
    const cw = Math.max(1, width - 2 * cx), ch = Math.max(1, height - 2 * cy);

    const rgbas: Uint8ClampedArray[] = [];
    rgbas.push(drawTo256(src as CanvasImageSource, 0, 0, width, height));          // V0 original

    // V1 q85, V2 q60 - encode the FULL-res source, decode, resize. The q60 view
    // is the important one: heavy enough to strip content-correlation while a
    // genuine Pixel Seal mark survives.  [UNVERIFIED]
    for (const q of [0.85, 0.6]) {
      const blob = await canvasToJpeg(src, q);
      if (!blob) { dbg('views', { note: 'jpeg encode failed', quality: q }); return null; }
      const bmp = await createImageBitmap(blob);
      try {
        rgbas.push(drawTo256(bmp, 0, 0, bmp.width, bmp.height));
      } finally {
        bmp.close?.();
      }
    }

    rgbas.push(drawTo256(src as CanvasImageSource, cx, cy, cw, ch));               // V3 5% crop

    dbg('views', { built: rgbas.length, crop: [cw, ch] });
    return rgbas.map((d) => new ort.Tensor('float32', packNchw01(d, PROC_SIZE, PROC_SIZE), [1, 3, PROC_SIZE, PROC_SIZE]));
  } catch (err) {
    dbg('views', { note: 'build failed', error: (err as Error)?.message });
    return null;
  }
}

/** Runs the extractor on one view tensor and returns its 256 thresholded
 *  message bits (index 0 detection bit dropped), or null if the output was
 *  missing/malformed. The graph pools internally, so `preds` is already
 *  [1,257]; a >0 logit (equivalently sigmoid>0.5) is a set bit. */
async function runExtractor(session: InferenceSession, imageTensor: OrtTensor): Promise<number[] | null> {
  assertAiAllowed('watermark');
  const results = await session.run({ image: imageTensor });
  const outName = results.preds ? 'preds' : (Object.keys(results)[0] ?? '');
  const out: OrtTensor | undefined = results[outName];

  // Defensive CPU read: preferredOutputLocation:'cpu' should make `.data` valid,
  // but a gpu-buffer tensor's `.data` getter THROWS - read it only when
  // CPU-resident, else pull the async CPU copy. A failure yields null → 'error'.
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

  // Need at least the detection bit + all message bits (some graphs may emit
  // extra trailing channels; we only read index 0..256).
  if (!raw || raw.length < CONTENTSEAL_MESSAGE_BITS + 1) {
    dbg('inference', { outName, dims: out?.dims, location: out?.location, length: raw?.length ?? 0 });
    return null;
  }
  // Index 0 is the auxiliary detection bit - dropped (unreliable per the
  // reference). Indices 1..256 are the message logits.
  const bits = new Array<number>(CONTENTSEAL_MESSAGE_BITS);
  for (let k = 0; k < CONTENTSEAL_MESSAGE_BITS; k++) bits[k] = Number(raw[k + 1]) > 0 ? 1 : 0;
  return bits;
}

/**
 * Runs a Content Seal deep scan on already-decoded RGBA pixels: builds four
 * augmented views, runs the extractor on each, and applies the pure engine
 * consensus rule. Returns a DISCRIMINATED status (the SAME shape as
 * detectTrustmark): 'detected' when a single consistent message survived all
 * four views; 'no-signal' when the extractor ran but nothing consistent emerged;
 * 'not-installed' when no model bytes are on device; 'error' on an unexpected
 * fault. NEVER throws. See this module's header for exactly what a detection
 * guarantees, what remains unverified, and the Muse-proprietary caveat.
 */
export async function detectContentSeal(
  rgba: Uint8ClampedArray | Uint8Array, width: number, height: number,
  opts: { cacheOnly?: boolean } = {},
): Promise<ContentSealDetection> {
  try { return await runAi('watermark', () => detectContentSealImpl(rgba, width, height, opts)); }
  catch (error) { if (error instanceof AiPolicyError) return { status: 'error' }; throw error; }
}

async function detectContentSealImpl(
  rgba: Uint8ClampedArray | Uint8Array, width: number, height: number,
  opts: { cacheOnly?: boolean } = {},
): Promise<ContentSealDetection> {
  try {
    if (width < 8 || height < 8) return { status: 'error' };
    const ort = await loadOrt();
    const outcome = await getSession(ort, !!opts.cacheOnly);
    if (outcome.kind === 'not-installed') { dbg('model', { status: 'not-installed', file: MODEL_FILE }); return { status: 'not-installed' }; }
    if (outcome.kind === 'error') { dbg('model', { status: 'load-error', error: (outcome.error as Error)?.message }); return { status: 'error' }; }
    dbg('session', { file: MODEL_FILE, providers: PROVIDERS });

    const views = await buildViews(ort, rgba, width, height);
    if (!views || views.length !== EXPECTED_VIEWS) return { status: 'error' };

    const decoded: number[][] = [];
    for (const v of views) {
      const bits = await runExtractor(outcome.session, v);
      if (!bits) return { status: 'error' }; // session ran but output malformed
      decoded.push(bits);
    }

    // The pure, message-free decision (engine/src/contentseal.ts) - tau is
    // calibrated for EXPECTED_VIEWS views; we enforced that count above.
    const consensus = contentSealConsensus(decoded);
    dbg('consensus', { unanimous: consensus.unanimous, tau: consensus.tau, present: consensus.present, minPair: consensus.minPairAgreement });
    if (consensus.present) {
      return { status: 'detected', messageHex: consensus.messageHex, unanimous: consensus.unanimous, bits: consensus.bits };
    }
    // Extractor ran across all views but no consistent message survived - the
    // honest "ran, found nothing THIS check looks for" (checks ONE watermark).
    return { status: 'no-signal' };
  } catch (err) {
    console.warn('[contentseal] deep scan failed', err);
    return { status: 'error' };
  }
}

/** Cache the Content Seal extractor once (network-allowed) - called alongside
 *  the header's TrustMark prefetch so one consent enables both. A no-op that
 *  returns false when the model was never converted (fetch → SPA-fallback HTML →
 *  rejected by fetchModelBytes' guard). Never throws.
 *
 *  `onProgress`, if given, reports this single file's {loaded,total} as it
 *  downloads (there's only the one file here, so no aggregation is needed - 
 *  see prefetchTrustmarkModels for the multi-file case). Never called at all
 *  when the model 404s straight away (the common case - this extractor is
 *  usually never converted/vendored). */
export async function prefetchContentSealModel(opts: { onProgress?: (p: FetchProgress) => void } = {}): Promise<boolean> {
  return !!(await fetchModelBytes(MODEL_FILE, false, opts.onProgress).catch(() => null));
}
