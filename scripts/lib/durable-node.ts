// SPDX-License-Identifier: MPL-2.0
/**
 * Durable (TrustMark neural) credential EMBED for the BUILD-TIME Node path — the
 * onnxruntime-node counterpart to the VERIFIED browser embed
 * (shells/web/src/lib/trustmark-embed.ts, which must NOT be edited/re-verified here).
 *
 * All the pixel arithmetic (normalise → residual → mean-removal → bilinear upscale →
 * merge) lives in the engine as the platform-agnostic `embedDurableIntoRgba`
 * (engine/src/trustmark.ts). This module supplies only the two platform hooks it
 * injects:
 *   - resizeCover:  sharp downscale full-res → 256×256 straight RGBA.
 *   - runEncoder:   onnxruntime-node running encoder_Q.onnx over the packed cover
 *                   + the 100-bit Lolly secret.
 *
 * BEST-EFFORT / NEVER THROWS into the caller. Returns null (→ caller keeps the
 * imprint-only pixels) and logs a one-line reason when:
 *   - onnxruntime-node can't be imported (not installed / no native binary for this
 *     platform-arch — e.g. Vercel/CI with `--omit=dev`),
 *   - the encoder model file is absent on disk,
 *   - the image's min side < 256 (mark can't survive),
 *   - the encoder yields no/malformed stego.
 * So `stampBitmap` keeps producing Imprint + C2PA outputs unchanged wherever the
 * durable step can't run.
 *
 * FIDELITY NOTE (the one deliberate, UNVERIFIED-here deviation): the cover→256
 * downscale uses sharp `kernel:'cubic'`, `fit:'fill'` (anisotropic squash, no crop —
 * matching the web embed's no-crop drawImage). Cubic mirrors the browser VERIFY
 * downscale (resizer.onnx = cubic/antialias/half_pixel), minimising the residual-noise
 * injected at verify time. A resize-kernel mismatch can only WEAKEN recovery, never
 * fabricate a mark (the downstream BCH check must still pass). Andy must confirm a
 * Node-embedded mark decodes via the browser deep scan (?durable=1 export → /#/valid)
 * on a real, non-256 image.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { embedDurableIntoRgba, TRUSTMARK_MODEL_RESOLUTION, TRUSTMARK_MIN_SIDE } from '../../engine/src/index.ts';

// ── Minimal, LOCAL type surface for onnxruntime-node ─────────────────────────
// Declared here (not `import type`) so nothing resolves to node_modules: tsc must
// pass with the package ABSENT. See the non-literal specifier below.
interface OrtTensor {
  readonly data: Float32Array;
  readonly dims: readonly number[];
  readonly type: string;
}
interface OrtTensorCtor {
  new (type: 'float32', data: Float32Array, dims: readonly number[]): OrtTensor;
}
interface OrtSession {
  run(feeds: Record<string, OrtTensor>): Promise<Record<string, OrtTensor>>;
  readonly inputNames: readonly string[];
  readonly outputNames: readonly string[];
  release?(): Promise<void>;
}
interface OrtSessionFactory {
  create(
    pathOrBytes: string | Uint8Array,
    options?: { executionProviders?: string[]; intraOpNumThreads?: number; logSeverityLevel?: number },
  ): Promise<OrtSession>;
}
interface OrtNodeModule {
  InferenceSession: OrtSessionFactory;
  Tensor: OrtTensorCtor;
}

// LOAD-BEARING: an IDENTIFIER argument (not a string literal) keeps tsc from
// module-resolving 'onnxruntime-node' under `moduleResolution:"bundler"`, so
// `tsc -p scripts` passes with the package NOT installed (no TS2307). Do NOT
// inline this as `import('onnxruntime-node')` and do NOT add a static import or an
// ambient `declare module` — either would break the build in every env or mask a
// genuinely-missing dep. Same pattern as scripts/characterize-export.ts.
const ORT_MODULE = 'onnxruntime-node' as string;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..'); // scripts/lib → repo root
const ENCODER_PATH = resolve(ROOT, 'shells/web/public/models/trustmark/encoder_Q.onnx');

// Memoised per-process: one encoder session for a whole og/previews/docs-shots batch.
// null = tried and unavailable (import/model/create failed) — don't retry each call.
let sessionState: { session: OrtSession; ort: OrtNodeModule } | null | undefined;

async function getEncoder(): Promise<{ session: OrtSession; ort: OrtNodeModule } | null> {
  if (sessionState !== undefined) return sessionState;
  sessionState = null; // pessimistic default; overwritten on success
  if (!existsSync(ENCODER_PATH)) {
    console.warn('[durable-node] encoder model absent — durable mark skipped (build the encoder to enable)');
    return null;
  }
  let ort: OrtNodeModule;
  try {
    ort = (await import(ORT_MODULE)) as unknown as OrtNodeModule;
  } catch {
    console.warn('[durable-node] onnxruntime-node unavailable — durable mark skipped');
    return null;
  }
  try {
    const session = await ort.InferenceSession.create(ENCODER_PATH, { executionProviders: ['cpu'] });
    sessionState = { session, ort };
    return sessionState;
  } catch (err) {
    console.warn(`[durable-node] could not create encoder session — durable mark skipped (${(err as Error).message})`);
    return null;
  }
}

/** Downscale full-res straight RGBA → 256×256 straight RGBA via sharp (cubic, fill). */
async function resizeCover(rgba: ArrayLike<number>, width: number, height: number, size: number): Promise<Uint8Array> {
  const sharp = (await import('sharp')).default;
  const buf = Buffer.from(rgba as ArrayLike<number> as Uint8Array | number[]);
  const { data } = await sharp(buf, { raw: { width, height, channels: 4 } })
    .resize(size, size, { fit: 'fill', kernel: 'cubic' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return new Uint8Array(data);
}

/**
 * Embed Lolly's durable mark into full-res straight RGBA in Node, returning the
 * marked copy — or null (leave pixels untouched) when the encoder isn't available,
 * the image is too small, or anything faults. NEVER throws.
 */
export async function embedLollyDurableNode(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  opts: { reservedId?: number } = {},
): Promise<Uint8ClampedArray | null> {
  try {
    if (width < TRUSTMARK_MIN_SIDE || height < TRUSTMARK_MIN_SIDE) {
      console.warn(`[durable-node] ${width}x${height} below ${TRUSTMARK_MIN_SIDE}px — durable mark skipped`);
      return null;
    }
    const enc = await getEncoder();
    if (!enc) return null;
    const { session, ort } = enc;
    const S = TRUSTMARK_MODEL_RESOLUTION;

    return await embedDurableIntoRgba(rgba, width, height, {
      resizeCover,
      runEncoder: async (coverNchw, secretBits) => {
        const coverT = new ort.Tensor('float32', coverNchw, [1, 3, S, S]);
        const secretT = new ort.Tensor('float32', Float32Array.from(secretBits, (b) => (b ? 1 : 0)), [1, secretBits.length]);
        const results = await session.run({ cover: coverT, secret: secretT });
        const stego = results.stego ?? results[session.outputNames[0] ?? Object.keys(results)[0] ?? ''];
        const data = stego?.data;
        return data instanceof Float32Array ? data : null;
      },
    }, { reservedId: opts.reservedId ?? 0 });
  } catch (err) {
    console.warn(`[durable-node] durable embed failed — durable mark skipped (${(err as Error).message})`);
    return null;
  }
}
