// SPDX-License-Identifier: MPL-2.0
import { AiPolicyError, assertAiAllowed, runAi } from './ai-policy.ts';
/**
 * TrustMark durable-credential EMBED - the neural encode counterpart to the
 * decode-only lib/trustmark.ts. Hides Lolly's own durable identifier
 * (engine buildLollyDurablePayload) into an image's pixels as a TrustMark-format
 * watermark, so a metadata strip can't erase the "made with Lolly" link and any
 * TrustMark-aware tool can recover it. See plans/28-durable-content-credentials.md.
 *
 * LAZY BY DESIGN, exactly like lib/trustmark.ts: only ever reached via a dynamic
 * import from the export path when opts.durable is set, so onnxruntime-web + the
 * encoder model stay out of the boot budget. The encoder ONNX is produced by the
 * Andy-run scripts/convert-trustmark-encoder-onnx.py (Adobe ships ONNX for decode
 * only) and fetched once through lib/ort.ts's shared model fetcher - the SAME
 * fetch-once-then-IndexedDB path the decoders and the upscale/matte/OCR families
 * use, so it resolves against the models base (MODELS_BASE): same-origin
 * `/models/trustmark/` on the web build, https://lolli.li on the Tauri shells,
 * which is what makes a durable export possible on desktop and mobile at all.
 * Its cache identity (store, dir, file, version, size) lives in
 * lib/durable-model.ts so the offline manager, the storage meter and the export
 * gate can name the same bytes without importing this ORT-heavy module.
 *
 * ── Verification ledger - the ALGORITHM IS PROVEN, the browser run is not ─────
 * A port of Adobe's `TrustMark.encode` (python/trustmark/trustmark.py):
 *   - resize cover → 256×256 (the reference uses BILINEAR);
 *   - normalize to [-1,1] (ToTensor*2-1 ≡ px/127.5 - 1), NCHW [1,3,256,256];
 *   - encoder(cover, secret) → stego, clamp to [-1,1];
 *   - residual = stego - cover, then REMOVE the per-channel spatial mean;
 *   - upscale the residual to the ORIGINAL size (reference: bilinear);
 *   - merged = clip(residual*WM_STRENGTH + cover_orig_[-1,1], -1, 1) → [0,255].
 * WM_STRENGTH default 1.0 (×1.25 for the P variant).
 *
 * VERIFIED 2026-07-18 against the REAL models: the exact math above, replicated
 * in Python over the converted encoder_Q.onnx + Adobe's decoder_Q.onnx (via
 * onnxruntime), round-trips the engine's own buildLollyDurablePayload(0) secret
 * with 0/100 bit errors at ~47 dB, and the recovered bits read back through
 * decodeTrustmarkPayload → readLollyDurable as a Lolly durable mark (a clean
 * image recovers ~random bits - no false mark). The ONNX I/O contract
 * (cover[1,3,256,256], secret[1,100] → stego[1,3,256,256]) is confirmed.
 * STILL UNVERIFIED: this code running IN A BROWSER (ORT-web + canvas resize vs
 * Python/PIL). The resize kernel is the one deliberate deviation - a mismatch can
 * only WEAKEN recovery, never fabricate a mark. Confirm by exporting ?durable=1
 * then deep-scanning in /#/valid.
 *
 * Best-effort and side-effect-free on failure: returns null (caller leaves the
 * pixels untouched) if the model isn't installed, the source is too small, or
 * anything faults. NEVER throws into the export path.
 */

import { buildLollyDurablePayload, TRUSTMARK_PAYLOAD_BITS } from '@lolly/engine';
import { createDebugLogger, createModelFetcher, loadOrt, type FetchProgress } from './ort.ts';
import {
  DURABLE_ENCODER_CACHE_VERSION, DURABLE_ENCODER_FILE, DURABLE_MODEL_DIR, DURABLE_MODEL_STORE,
} from './durable-model.ts';

const MODEL_RESOLUTION = 256;
/** Reference WM_STRENGTH for the Q variant (P would be ×1.25 - not used here). */
const WM_STRENGTH = 1.0;
/** Below this the mark can't survive; skip (matches the decoder's detection floor
 *  intent + engine canCarryWatermark). */
const MIN_SIDE = 256;
const PROVIDERS = ['wasm'] as const;

export interface DurableEmbedOptions {
  /** The reserved id field for buildLollyDurablePayload (0 until CAI id lands). */
  reservedId?: number;
  /** Never touch the network (background/opportunistic). Default false - a
   *  durable export is an explicit opt-in, so the first one may download once. */
  cacheOnly?: boolean;
}

// Opt-in tracer, the decoders' shape (lib/ort.ts createDebugLogger): turn it on
// with localStorage.setItem('lolly:durable:debug', '1') or
// window.__DURABLE_DEBUG__ = true to see the encoder fetch (cache hit, URL,
// status) behind a durable export.
const dbg = createDebugLogger({
  tag: 'trustmark-embed', storageKey: 'lolly:durable:debug', globalFlag: '__DURABLE_DEBUG__',
});

// The shared fetch-once/IndexedDB-forever fetcher (lib/ort.ts) - identical body
// to the hand-rolled one this replaced (IDB read, cacheOnly miss, MODELS_BASE
// URL, 404/offline null, the SPA-fallback HTML guard, best-effort cache write),
// now in one place with the decoder and image-model families. Its own cache
// version, so replacing the encoder never invalidates the decoders.
const fetchEncoderBytes = createModelFetcher({
  store: DURABLE_MODEL_STORE,
  dir: DURABLE_MODEL_DIR,
  version: DURABLE_ENCODER_CACHE_VERSION,
  dbg,
});

/**
 * Pre-fetch the durable-watermark ENCODER into IndexedDB so a user can download it
 * IN ADVANCE from the profile's offline section ("Durable credential") - it is
 * otherwise lazy-only, fetched on the first durable export. Best-effort: returns
 * false on the routine 404 when the encoder is not served yet, so a miss reports
 * itself instead of throwing. Shares the 'trustmark-models' IDB store with the
 * deep-scan decoders, but keys are owned per part: removePart('durable') deletes
 * this file, removePart('verify') deletes the decoder keys and leaves it.
 */
export async function prefetchTrustmarkEncoder(
  opts: { onProgress?: (p: FetchProgress) => void } = {},
): Promise<boolean> {
  return !!(await fetchEncoderBytes(DURABLE_ENCODER_FILE, false, opts.onProgress));
}

type OrtModule = typeof import('onnxruntime-web');
type InferenceSession = Awaited<ReturnType<OrtModule['InferenceSession']['create']>>;
let sessionPromise: Promise<InferenceSession | null> | null = null;
async function getEncoderSession(ort: OrtModule, cacheOnly: boolean): Promise<InferenceSession | null> {
  if (sessionPromise) return sessionPromise;
  const p = (async (): Promise<InferenceSession | null> => {
    const bytes = await fetchEncoderBytes(DURABLE_ENCODER_FILE, cacheOnly);
    if (!bytes) return null;
    try {
      return await ort.InferenceSession.create(new Uint8Array(bytes), { executionProviders: [...PROVIDERS] });
    } catch (err) {
      console.warn('[trustmark-embed] could not create encoder session', err);
      return null;
    }
  })();
  sessionPromise = p;
  // Don't make a miss sticky - a later export after the model lands should retry.
  void p.then((s) => { if (!s) sessionPromise = null; }, () => { sessionPromise = null; });
  return p;
}

// ── Pixel math (mirrors the reference; see the honesty ledger) ──────────────

function makeCanvas(w: number, h: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

/** RGBA → NCHW [1,3,S,S] float32 in [-1,1] (px/127.5 − 1), alpha dropped. */
function packNchwSigned(rgba: ArrayLike<number>, s: number): Float32Array {
  const total = s * s, page = total, twopage = 2 * total;
  const t = new Float32Array(total * 3);
  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    t[i] = (rgba[idx] as number) / 127.5 - 1;
    t[i + page] = (rgba[idx + 1] as number) / 127.5 - 1;
    t[i + twopage] = (rgba[idx + 2] as number) / 127.5 - 1;
  }
  return t;
}

/** Bilinear sample of one 256×256 channel plane at (fx,fy), align_corners=false. */
function sampleBilinear(plane: Float32Array, s: number, fx: number, fy: number): number {
  const x = Math.min(Math.max(fx, 0), s - 1), y = Math.min(Math.max(fy, 0), s - 1);
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, s - 1), y1 = Math.min(y0 + 1, s - 1);
  const dx = x - x0, dy = y - y0;
  const p00 = plane[y0 * s + x0]!, p10 = plane[y0 * s + x1]!;
  const p01 = plane[y1 * s + x0]!, p11 = plane[y1 * s + x1]!;
  return p00 * (1 - dx) * (1 - dy) + p10 * dx * (1 - dy) + p01 * (1 - dx) * dy + p11 * dx * dy;
}

/**
 * Embeds Lolly's durable mark into full-resolution RGBA and returns the marked
 * copy, or null (leave pixels untouched) when the encoder isn't available, the
 * image is too small, or anything faults. Never throws.
 */
export async function embedLollyDurable(
  rgba: Uint8ClampedArray | Uint8Array, width: number, height: number,
  opts: DurableEmbedOptions = {},
): Promise<Uint8ClampedArray | null> {
  try { return await runAi('watermark', () => embedLollyDurableImpl(rgba, width, height, opts)); }
  catch (error) { if (error instanceof AiPolicyError) return null; throw error; }
}

async function embedLollyDurableImpl(
  rgba: Uint8ClampedArray | Uint8Array, width: number, height: number,
  opts: DurableEmbedOptions = {},
): Promise<Uint8ClampedArray | null> {
  try {
    if (width < MIN_SIDE || height < MIN_SIDE) return null;
    const ort = await loadOrt();
    const session = await getEncoderSession(ort, !!opts.cacheOnly);
    if (!session) return null;

    // 1) Resize cover → 256×256 (reference: bilinear; canvas 'high' is our
    //    documented kernel deviation). Copy through a plain ArrayBuffer-backed
    //    ImageData (a SharedArrayBuffer view is rejected by the constructor).
    const src = makeCanvas(width, height);
    const sctx = src.getContext('2d') as CanvasRenderingContext2D;
    const clamped = new Uint8ClampedArray(rgba.length); clamped.set(rgba);
    sctx.putImageData(new ImageData(clamped, width, height), 0, 0);
    const small = makeCanvas(MODEL_RESOLUTION, MODEL_RESOLUTION);
    const mctx = small.getContext('2d') as CanvasRenderingContext2D;
    mctx.imageSmoothingEnabled = true; mctx.imageSmoothingQuality = 'high';
    mctx.drawImage(src as CanvasImageSource, 0, 0, width, height, 0, 0, MODEL_RESOLUTION, MODEL_RESOLUTION);
    const cover256 = mctx.getImageData(0, 0, MODEL_RESOLUTION, MODEL_RESOLUTION).data;

    // 2) NCHW [-1,1] cover + the 100-bit Lolly secret as 0/1 floats.
    const coverT = new ort.Tensor('float32', packNchwSigned(cover256, MODEL_RESOLUTION), [1, 3, MODEL_RESOLUTION, MODEL_RESOLUTION]);
    const bits = buildLollyDurablePayload(opts.reservedId ?? 0);
    if (bits.length !== TRUSTMARK_PAYLOAD_BITS) return null;
    const secretT = new ort.Tensor('float32', Float32Array.from(bits, (b) => (b ? 1 : 0)), [1, TRUSTMARK_PAYLOAD_BITS]);

    // 3) encoder(cover, secret) → stego [1,3,256,256] in [-1,1].
    assertAiAllowed('watermark');
    const results = await session.run({ cover: coverT, secret: secretT });
    const stego = results.stego ?? results[Object.keys(results)[0] ?? ''];
    const stegoData = stego?.data as Float32Array | undefined;
    if (!stegoData || stegoData.length !== 3 * MODEL_RESOLUTION * MODEL_RESOLUTION) return null;

    // 4) residual = clamp(stego,-1,1) − cover256, per channel; then remove the
    //    per-channel spatial mean (reference: residual -= residual.mean(2,3)).
    const S = MODEL_RESOLUTION, plane = S * S;
    const coverNchw = packNchwSigned(cover256, S);
    const residual: Float32Array[] = [];
    for (let c = 0; c < 3; c++) {
      const r = new Float32Array(plane);
      let sum = 0;
      for (let i = 0; i < plane; i++) {
        const st = Math.min(Math.max(stegoData[c * plane + i]!, -1), 1);
        const d = st - coverNchw[c * plane + i]!;
        r[i] = d; sum += d;
      }
      const mean = sum / plane;
      for (let i = 0; i < plane; i++) r[i] = r[i]! - mean;
      residual.push(r);
    }

    // 5) Upscale each residual channel to full res (bilinear) and merge:
    //    out = clip(residual*WM_STRENGTH + cover_orig_[-1,1], -1, 1) → [0,255].
    const out = new Uint8ClampedArray(rgba.length);
    out.set(rgba); // preserve alpha (and everything, then overwrite RGB)
    const sx = S / width, sy = S / height;
    for (let y = 0; y < height; y++) {
      const fy = (y + 0.5) * sy - 0.5;
      for (let x = 0; x < width; x++) {
        const fx = (x + 0.5) * sx - 0.5;
        const o = (y * width + x) * 4;
        for (let c = 0; c < 3; c++) {
          const res = sampleBilinear(residual[c]!, S, fx, fy);
          const base = (rgba[o + c] as number) / 127.5 - 1;
          const merged = Math.min(Math.max(res * WM_STRENGTH + base, -1), 1);
          out[o + c] = Math.round((merged + 1) * 127.5);
        }
      }
    }
    return out;
  } catch (err) {
    console.warn('[trustmark-embed] durable embed failed', err);
    return null;
  }
}
