// SPDX-License-Identifier: MPL-2.0
/**
 * HDR PNG at 16 bits per channel - the first "invisible upgrade" of
 * plans/61-deeprichpixels.md section 10 item 2.
 *
 * Before this module, `?hdr=1&format=png` ran the canvas through the engine's
 * legacy byte path (`hdrBoostToPQ`: 8-bit in, 8-bit PQ code values out) and then
 * spliced a cICP chunk into the browser's own PNG bytes. That is section 1's sharpest
 * recorded defect: PQ is a 10/12-bit transfer by design, so quantising it to 8
 * bits bands the shadows - the very place PQ spends its code values. The fix is
 * not a new toggle: the same `hdr=` request now routes through the float view
 * transform and lands in a 16-bit IDAT written by the engine's own encoder.
 *
 *   canvas RGBA8 -> fromU8Srgb (linear f32)
 *                -> hdrViewTransform  (brand boost, Rec.2020 linear, unbounded)
 *                -> pqEncodeFrame     (203-nit BT.2408 anchor, full precision)
 *                -> pqToU16           (0..65535, the precision PQ was designed for)
 *                -> packPng           (depth 16, cICP 9/16/0/1, pHYs)
 *
 * ─── Why this is not padding (the honesty rule, plan section 10) ────────────────────
 * "Depth follows provenance - never emit bits the pipeline did not produce."
 * A 16-bit TIFF of an 8-bit canvas render is padding. This is NOT that: the
 * bits below the 8th are *generated* by real float math on the way out. The
 * boost gain is continuous, the sRGB->Rec.2020 primary matrix is continuous,
 * and the PQ curve is steeply non-linear - three 256-valued inputs map to
 * distinct, unevenly-spaced 16-bit outputs, so the low byte carries signal
 * rather than a `v * 257` replication. The test asserts exactly that (a 16-bit
 * output whose low bytes were mere padding would fail it). What the file does
 * NOT claim is deeper *source* material: the render is still an 8-bit canvas,
 * and the honest statement is that the HDR view transform is the thing being
 * recorded at full precision. Vector-render-in-float (Phase D) is what raises
 * the source; this raises the transform.
 *
 * ─── depth= interaction ──────────────────────────────────────────────────────
 * `depth=8` is IGNORED here (with a logged note): 8-bit PQ *is* the banding
 * defect the plan forbids, so honouring the request would re-introduce it under
 * a different name. `depth=float` is also noted and satisfied at 16 - PNG has no
 * float sample format (that is EXR's job, plan section 4.2 B3). 16/auto/absent take
 * this path silently, which is what "auto = the deepest the provenance chain
 * supports" means for an HDR PNG.
 *
 * ─── Metadata parity with the old splice path ────────────────────────────────
 * The old path emitted, all spliced after IHDR: pHYs (dpi), one iTXt per
 * provenance field, cICP (Rec.2100 PQ), iCCP (pqBt2020IccProfile). Every one of
 * those still ships. pHYs + cICP are now written natively by `packPng` (its
 * pHYs arithmetic is asserted equal to `insertPngPhys`'s by tests/png.test.ts);
 * the iTXt and iCCP chunks go through the SAME `insertPngMeta` / `insertPngIcc`
 * splicers as before, so there is no second copy of that logic to drift. Chunk
 * ORDER among these ancillaries differs from the old path (the splicers each
 * insert directly after IHDR, so the last one inserted comes first) - PNG places
 * no ordering requirement on them beyond "before IDAT", which holds.
 *
 * C2PA: `engine/src/c2pa-containers.ts#placePng` walks the chunk list generically
 * (length/type/CRC, insert `caBX` after IHDR, drop any pre-existing one). It
 * reads nothing out of IHDR beyond its length and makes no assumption about who
 * encoded the file or at what depth, so a 16-bit PNG from this path stamps
 * exactly like a browser-encoded 8-bit one. Verified by test below.
 *
 * ─── Pixel marks (imprint / durable) ─────────────────────────────────────────
 * Both marks are 8-bit RGBA operations, and the old path deliberately ran them
 * AFTER the PQ transform so the mark lives in the delivered pixel space. That
 * ordering is preserved here without dropping precision: the mark is computed on
 * an 8-bit quantisation of the PQ signal (byte-for-byte what the legacy path
 * would have produced), and only the resulting per-sample DELTA is applied to
 * the 16-bit buffer, scaled by 257 (the 8->16-bit unit). The delivered file's
 * top 8 bits therefore carry precisely the pattern a detector expects, while the
 * low byte keeps the PQ precision. A mark is never silently skipped.
 *
 * ─── Size (the plan section 9b blocker, lifted in Phase B3) ─────────────────────────
 * This path used to refuse past ~2.1 megapixels, because `deflate.ts` compressed
 * in one shot with ~8x scratch: a 4K 16-bit master (8.3 MP, ~66 MiB filtered)
 * meant ~530 MiB of tokenizer scratch, and the alternative - a stored,
 * uncompressed IDAT - shipped a ~66 MB file from an existing link. Neither is
 * acceptable, so the export fell back to the legacy 8-bit PQ path.
 * `deflate.ts` now streams (`createZlibStream`: one 32 KB window carried across
 * slabs, constant scratch) and `packPng` feeds it one filtered scanline at a
 * time above its own threshold, never allocating the whole-image buffer. So a
 * 4K 16-bit HDR PNG now compresses properly, in a few hundred KB of working
 * memory. `maxDeflateBytes` survives as a plain sanity bound on the returned
 * buffer (1 GiB of filtered bytes ≈ 134 MP); a caller passing a smaller cap
 * still gets the loud refusal, which is the seam the export path falls back on.
 *
 * DOM-free on purpose: the whole path is `Uint8ClampedArray` in, `Uint8Array`
 * out, so it is driven directly by node:test with no canvas (export-hdr-png.test.ts).
 */
import { fromU8Srgb, hdrViewTransform, pqEncodeFrame, pqToU16, HDR_PQ_CICP, embedWatermark, packPng } from '@lolly/engine';
import type { HdrBoostOptions } from '@lolly/engine';
import { insertPngMeta, insertPngIcc } from './export-image-meta.ts';
import type { ExportMeta } from '@lolly-tools/core/host-v1';

/**
 * Filtered-byte ceiling for a deep HDR PNG. Was 16 MiB (~2.1 MP) back when
 * deflate.ts compressed in one shot and a bigger image meant either ~8x the input
 * in tokenizer scratch or a ~60 MB stored IDAT. deflate.ts now streams (one 32 KB
 * window carried across slabs, constant scratch), and packPng feeds it scanline by
 * scanline above its own threshold, so the memory argument is gone: a 4K 16-bit
 * master compresses in a few hundred KB of working memory. This is now a plain
 * sanity bound on the single buffer we return -- 1 GiB of filtered bytes, matching
 * packPng's own default. See plans/61-deeprichpixels.md Phase B3.
 */
export const HDR_PNG_DEFLATE_CAP = 1024 * 1024 * 1024;

export interface HdrPng16Opts {
  width: number;
  height: number;
  /** Brand targets + the author's tuned dials, exactly as the 8-bit path passes them. */
  hdr: HdrBoostOptions;
  /** Physical resolution -> pHYs. Omitted/<=0 writes no chunk (as before). */
  dpi?: number;
  /** Provenance fields -> iTXt, via the shared splicer. */
  meta?: ExportMeta | null;
  /** Rec.2100-PQ ICC profile bytes -> iCCP (the shell passes pqBt2020IccProfile()). */
  icc?: Uint8Array | null;
  /** iCCP profile name. Defaults to the old path's 'Rec2100 PQ'. */
  iccName?: string;
  /** Apply the default-on pixel imprint. */
  imprint?: boolean;
  /** Imprint strength (PNG is lossless -> LOSSLESS_STRENGTH); undefined = engine default. */
  imprintStrength?: number;
  /** Durable (TrustMark) embed, injected so this module stays DOM/model-free. */
  durable?: (rgba: Uint8ClampedArray, width: number, height: number) => Promise<Uint8Array | Uint8ClampedArray | null>;
  /** The `depth` URL param as requested. See the header - 8 is refused, loudly. */
  depth?: 8 | 16 | 'float' | 'auto';
  /** Filtered-byte ceiling override (tests). */
  maxDeflateBytes?: number;
  log?: (level: 'info' | 'warn', msg: string) => void;
}

/** 8-bit quantisation of a PQ signal - byte-identical to hdrBoostToPQ's own. */
const pq8 = (v: number): number => {
  const q = Math.round((Number.isFinite(v) ? v : 0) * 255);
  return q < 0 ? 0 : q > 255 ? 255 : q;
};

const clampU16 = (v: number): number => (v < 0 ? 0 : v > 65535 ? 65535 : v);

/**
 * Encode canvas pixels as a 16-bit Rec.2100-PQ PNG. Returns the complete file
 * bytes. Throws only on genuinely unencodable input (bad dimensions) - the
 * caller falls back to the legacy 8-bit path on any throw.
 */
export async function encodeHdrPng16(rgba: Uint8ClampedArray, o: HdrPng16Opts): Promise<Uint8Array> {
  const { width, height } = o;
  const log = o.log ?? (() => {});
  if (!(width > 0) || !(height > 0) || rgba.length !== width * height * 4) {
    throw new Error(`encodeHdrPng16: ${rgba.length} samples for ${width}x${height} (expected ${width * height * 4}).`);
  }
  // depth= is a request, never a promise (plan section 10). Deep is the only honest
  // answer for PQ, so an 8-bit request is answered and explained, not obeyed.
  if (o.depth === 8) {
    log('info', 'png: depth=8 ignored for an HDR export - PQ code values quantised to 8 bits band in the shadows, so HDR PNG is always written at 16 bits per channel.');
  } else if (o.depth === 'float') {
    log('info', 'png: depth=float satisfied at 16 bits - PNG has no float sample format (use TIFF float32 or EXR for that).');
  }

  // ── the float path: this is where the extra bits are actually generated ────
  const linear = hdrViewTransform(fromU8Srgb(rgba, width, height), o.hdr);
  const pq = pqEncodeFrame(linear, o.hdr.sdrWhiteNits);
  const deep = pqToU16(pq);

  // ── pixel marks, computed in the delivered (PQ) space, applied at 16 bits ──
  if (o.imprint || o.durable) {
    // The exact buffer the legacy path would have handed the marker: PQ RGB
    // quantised to bytes, alpha carried through from the source untouched.
    const flat = new Uint8ClampedArray(rgba.length);
    for (let i = 0; i < flat.length; i += 4) {
      flat[i] = pq8(pq.data[i]!);
      flat[i + 1] = pq8(pq.data[i + 1]!);
      flat[i + 2] = pq8(pq.data[i + 2]!);
      flat[i + 3] = rgba[i + 3]!;
    }
    if (o.imprint) {
      const marked = embedWatermark(flat, {
        width, height,
        ...(o.imprintStrength !== undefined ? { strength: o.imprintStrength } : {}),
      });
      applyMarkDelta(deep, flat, marked);
      flat.set(marked); // chain, as the canvas path did: durable sees the imprinted pixels
    }
    if (o.durable) {
      try {
        const marked = await o.durable(flat, width, height);
        if (marked) applyMarkDelta(deep, flat, marked);
      } catch { /* best-effort, exactly like durableEmbedCanvas */ }
    }
  }

  // ── container ─────────────────────────────────────────────────────────────
  const cap = o.maxDeflateBytes ?? HDR_PNG_DEFLATE_CAP;
  const filtered = (width * 8 + 1) * height; // 16-bit RGBA rows + filter tags
  if (filtered > cap) {
    // Past the compressor's single-shot ceiling a stored IDAT would ship a
    // ~60 MB 4K file. Until the slab-fed deflater lands (deflate.ts TODO,
    // plans/61-deeprichpixels.md section 9b) refuse instead: the caller falls back to
    // the legacy 8-bit PQ path, so an existing link never silently balloons.
    throw new Error(`png: ${width}x${height} at 16 bits is ${(filtered / (1024 * 1024)).toFixed(1)} MiB of scanlines, past the deep-PNG size ceiling`);
  }
  let bytes = packPng(deep, {
    width, height, channels: 4, depth: 16,
    cicp: { ...HDR_PQ_CICP },
    ...(o.dpi && o.dpi > 0 ? { dpi: o.dpi } : {}),
    maxDeflateBytes: cap,
  });
  // Same splicers the 8-bit path uses, so the metadata cannot drift between them.
  bytes = insertPngMeta(bytes, o.meta);
  if (o.icc) bytes = await insertPngIcc(bytes, o.icc, o.iccName ?? 'Rec2100 PQ');
  return bytes;
}

/**
 * Add an 8-bit mark's per-sample delta to a 16-bit buffer at 16-bit scale
 * (one 8-bit step = 257 sixteenth-bit steps), leaving alpha alone.
 */
function applyMarkDelta(deep: Uint16Array, before: Uint8ClampedArray, after: Uint8Array | Uint8ClampedArray): void {
  // A short/mismatched mark buffer would read undefined -> NaN deltas and
  // blank pixels to black; the mark is best-effort, so no-op instead.
  if (after.length !== deep.length || before.length !== deep.length) return;
  for (let i = 0; i < deep.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const d = after[i + c]! - before[i + c]!;
      if (d !== 0) deep[i + c] = clampU16(deep[i + c]! + d * 257);
    }
  }
}
