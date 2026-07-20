// SPDX-License-Identifier: MPL-2.0
/**
 * Shared build-time provenance stamping for the media WE generate — one path so every
 * generator (OG cards, previews, thumbnails, …) credentials its output identically, and
 * the same way the runtime export bridge (shells/web/src/bridge/export.ts) and
 * scripts/build-docs-shots.ts already do. "Walk the talk": every public image Lolly
 * ships carries its own provenance.
 *
 *   bitmap:  decode (sharp) → Lolly Imprint (embedWatermark, pixels)
 *            → [Durable neural mark — Phase 2] → re-encode (sharp)
 *            → C2PA (embedC2pa, bytes)                     ← C2PA is always the LAST byte op
 *   vector:  C2PA only (an SVG can't carry a pixel-domain mark)
 *
 * Imprint + C2PA are pure, DOM-free engine ops; `sharp` (a dev dependency) owns the
 * pixel decode/encode. The Durable (TrustMark neural) mark runs via onnxruntime-node
 * (scripts/lib/durable-node.ts) and is best-effort: it no-ops cleanly (leaving
 * imprint + C2PA intact) wherever ort-node or the encoder model isn't available.
 *
 * Every step is best-effort: a failure logs and returns the un-stamped bytes rather than
 * breaking a build (mirrors the export bridge + build-docs-shots), so a missing dep or a
 * malformed byte stream never fails `og` / `previews`.
 */
import { embedC2pa } from '../../engine/src/index.ts';
import { embedWatermark, LOSSLESS_STRENGTH, DEFAULT_STRENGTH } from '../../engine/src/pixel-watermark.ts';
import { buildExportC2paOpts } from '../../packages/node-shell/src/c2pa-opts.ts';

export interface StampMeta {
  /** Short id for the artifact (tool id, view slug, doc slug) — logging + credential title fallback. */
  id: string;
  /** Human name used as the credential title. */
  name: string;
  /** Credential validity window (days). OG cards + previews are long-lived → default 365. */
  days?: number;
}

/** Re-encode controls for the format `stampBitmap` writes back. */
export interface StampEncodeOpts {
  /** WebP quality (default 100 ≈ near-lossless). Below 100 the encode is LOSSY → the
   *  stronger imprint strength is used so the mark survives the quantiser. */
  webpQuality?: number;
  /** JPEG quality (default 95). JPEG is always lossy → stronger imprint. */
  jpegQuality?: number;
}

// Raster formats stampBitmap round-trips through sharp AND embedC2pa can carry a manifest in.
export type RasterFormat = 'png' | 'jpg' | 'jpeg' | 'webp';

/**
 * Stamp a generated RASTER bitmap: Lolly Imprint into the pixels, then a C2PA credential
 * into the encoded bytes. Decodes `bytes` once, so the returned image is a single fresh
 * encode of the marked pixels (no double compression) in `format`. Returns the input
 * bytes unchanged if a step is not applicable / fails.
 */
export async function stampBitmap(
  bytes: Uint8Array,
  format: RasterFormat,
  meta: StampMeta,
  enc: StampEncodeOpts = {},
): Promise<Uint8Array> {
  let out = bytes;
  let width: number | undefined;
  let height: number | undefined;

  // 1. Lolly Imprint — decode to straight RGBA, embed the spread-spectrum mark, re-encode.
  //    LOSSY targets (JPEG, or WebP below q100) use the robust DEFAULT_STRENGTH so the mark
  //    survives the quantiser; lossless PNG / near-lossless WebP use the gentler
  //    LOSSLESS_STRENGTH — the same split the web export bridge makes.
  try {
    const sharp = (await import('sharp')).default;
    const { data, info } = await sharp(Buffer.from(out)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    width = info.width;
    height = info.height;
    const lossy = format === 'jpg' || format === 'jpeg' || (format === 'webp' && (enc.webpQuality ?? 100) < 100);
    const marked = embedWatermark(new Uint8Array(data), {
      width,
      height,
      strength: lossy ? DEFAULT_STRENGTH : LOSSLESS_STRENGTH,
    });

    // 2. Durable neural credential — folded into step 1 so there is exactly ONE
    //    encode (no double compression). Operates on the full-res, imprinted RGBA.
    //    Best-effort + gated to ≥256px: returns null (→ imprint-only pixels) when
    //    onnxruntime-node or the encoder model isn't available. C2PA stays last.
    let pixels: Uint8Array | Uint8ClampedArray = marked;
    if (width >= 256 && height >= 256) {
      try {
        const { embedLollyDurableNode } = await import('./durable-node.ts');
        const durable = await embedLollyDurableNode(marked, width, height, { reservedId: 0 });
        if (durable) pixels = durable;
      } catch (e) {
        console.warn(`stamp: durable mark skipped for ${meta.id} — ${(e as Error).message}`);
      }
    }

    const img = sharp(Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength), { raw: { width, height, channels: 4 } });
    const enced = format === 'jpg' || format === 'jpeg' ? img.jpeg({ quality: enc.jpegQuality ?? 95 })
      : format === 'webp' ? img.webp({ quality: enc.webpQuality ?? 100, effort: 5, smartSubsample: true })
      : img.png();
    out = new Uint8Array(await enced.toBuffer());
  } catch (e) {
    console.warn(`stamp: imprint skipped for ${meta.id} — ${(e as Error).message}`);
  }

  // (Step 2, the Durable neural credential, is folded into step 1 above — it must
  //  mark the same full-res RGBA and share the single re-encode. See durable-node.ts.)

  // 3. C2PA — always last (hard-binds over the final bytes). Uses the true decoded dims.
  return stampC2pa(out, format, meta, { width, height });
}

/** Stamp SVG / vector bytes with a C2PA credential only (no pixel-domain mark possible). */
export async function stampVector(svg: Uint8Array | string, meta: StampMeta): Promise<Uint8Array> {
  const bytes = typeof svg === 'string' ? new TextEncoder().encode(svg) : svg;
  return stampC2pa(bytes, 'svg', meta);
}

/** Embed a "made with Lolly" C2PA credential into already-encoded bytes (self-signed
 *  on-device; verified when a CA key is present). Never throws — ships the bytes
 *  un-stamped on failure. Exposed for callers that do their own pixel encode (e.g. the
 *  WebP preview path, which imprints at its own quality before this). */
export async function stampC2pa(
  bytes: Uint8Array,
  format: string,
  meta: StampMeta,
  dims: { width?: number; height?: number } = {},
): Promise<Uint8Array> {
  try {
    return await embedC2pa(bytes, format, buildExportC2paOpts({
      surface: 'build',
      manifest: { id: meta.id, name: meta.name },
      model: [],
      format,
      dims: { width: dims.width, height: dims.height, unit: 'px' },
      days: meta.days ?? 365,
    }));
  } catch (e) {
    console.warn(`stamp: Content Credentials skipped for ${meta.id} — ${(e as Error).message}`);
    return bytes;
  }
}
