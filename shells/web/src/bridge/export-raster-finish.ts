// SPDX-License-Identifier: MPL-2.0
/**
 * What a drawn raster gets after its pixels exist, shared by the browser renderer and
 * the GPU route (plan 326) so both finish a picture the same way: the durable mark, and
 * the chunks every exported PNG carries after its encoder, in one parse and one
 * serialise (the DPI in pHYs, the provenance text and XMP, the HDR cICP signal and the
 * colour profile), in the same order.
 */
import { pqBt2020IccProfile, iccProfileBytes, HDR_PQ_CICP, LOSSLESS_STRENGTH } from '@lolly/engine';
import { iccWanted, insertPngPhys, insertPngMeta, insertPngXmp, insertPngCicp, insertPngIcc } from './export-image-meta.ts';
import { canvasToBlob, imprintCanvas, type ExportOpts } from './export-shared.ts';

// Neural DURABLE embed for a standalone raster canvas - the async, opt-in
// counterpart to the sync imprintCanvas. Lazy-imports the encoder runner so ORT
// + the ~tens-of-MB model stay out of the boot budget. Best-effort: a no-op
// (pixels untouched) when opts.durable is off, or the encoder model isn't
// installed / the encode faults. Container chokepoints (PDF/PPTX raster) stay
// imprint-only for now - folding an async neural pass into the SYNC
// imprintEmbedCanvas is future work (see plans/28-durable-content-credentials.md).
export async function durableEmbedCanvas(canvas: HTMLCanvasElement, opts: ExportOpts): Promise<void> {
  if (!opts.durable) return;
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const { embedLollyDurable } = await import('../lib/trustmark-embed.ts');
    const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const marked = await embedLollyDurable(id.data, canvas.width, canvas.height, { reservedId: opts.durableId });
    if (marked) { id.data.set(marked); ctx.putImageData(id, 0, 0); }
  } catch { /* best-effort; never break an export over the durable pass */ }
}

/** A PNG from a canvas holding drawn pixels, as the browser renderer's canvas path writes one: Imprint, durable mark, encode, chunks. */
export async function encodePngCanvas(canvas: HTMLCanvasElement, opts: ExportOpts, dpi: number): Promise<Blob> {
  if (opts.imprint) imprintCanvas(canvas, LOSSLESS_STRENGTH);
  await durableEmbedCanvas(canvas, opts);
  return finishPng(await canvasToBlob(canvas, 'image/png'), opts, dpi);
}

/**
 * Splice the metadata chunks into an encoded PNG. HDR overrides the colour profile with
 * Rec.2100 PQ (its cICP chunk is the HDR signal). Returns `blob` untouched when there is
 * nothing to write.
 */
export async function finishPng(blob: Blob, opts: ExportOpts, dpi: number, hdrOn = false): Promise<Blob> {
  const icc = hdrOn ? pqBt2020IccProfile() : (iccWanted(opts) ? iccProfileBytes(opts.colorProfile) : null);
  if (!(dpi > 0 || opts.meta || icc || hdrOn)) return blob;
  let bytes = new Uint8Array(await blob.arrayBuffer());
  if (dpi > 0) bytes = (insertPngPhys(bytes, dpi) || bytes) as Uint8Array<ArrayBuffer>;
  bytes = insertPngMeta(bytes, opts.meta) as Uint8Array<ArrayBuffer>;
  bytes = insertPngXmp(bytes, opts.meta) as Uint8Array<ArrayBuffer>;
  if (hdrOn) bytes = insertPngCicp(bytes, HDR_PQ_CICP) as Uint8Array<ArrayBuffer>;
  if (icc) bytes = await insertPngIcc(bytes, icc, hdrOn ? 'Rec2100 PQ' : 'sRGB') as Uint8Array<ArrayBuffer>;
  return new Blob([bytes], { type: 'image/png' });
}
