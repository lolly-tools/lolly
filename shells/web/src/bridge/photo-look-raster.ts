// SPDX-License-Identifier: MPL-2.0
/**
 * Bake a brand photo look into a picture's pixels in this realm (plan 291 W7):
 * decode, apply the engine's look (engine/src/photo-look.ts), encode. Runs on the
 * main thread or inside photo-look.worker.ts; it touches no `document` when an
 * OffscreenCanvas exists.
 */
import { applyPhotoLook, resolvePhotoLook } from '../../../../engine/src/photo-look.ts';
import type { GradeLut } from '../../../../engine/src/grade.ts';
import type { PhotoTreatment } from '../../../../engine/src/photo-treatment.ts';
import { PIXEL_KERNEL_MAX_PIXELS } from '../../../../packages/node-shell/src/pixel-kernel-contract.ts';

/** Existing non-LUT bake ceiling. LUT frames use the smaller pixel-kernel admission limit. */
export const PHOTO_LOOK_MAX_PIXELS = 64 * 1024 * 1024;

export interface PhotoLookBakeRequest {
  blob: Blob;
  look: PhotoTreatment;
  theme?: string;
  lut?: GradeLut;
  /** The encoding of the baked bytes; by default JPEG for a JPEG source, PNG otherwise. A
   *  caller that encodes again (an Assets download) asks for PNG, so the look is not
   *  compressed twice. */
  output?: 'image/png' | 'image/jpeg';
}

/** The output type: JPEG for a JPEG source (no alpha to keep), PNG for everything else. */
export function photoLookOutputType(sourceType: string): 'image/jpeg' | 'image/png' {
  return /^image\/jpe?g$/i.test(sourceType) ? 'image/jpeg' : 'image/png';
}

type Ctx2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

export async function bakePhotoLookInRealm(req: PhotoLookBakeRequest, signal?: AbortSignal): Promise<Blob> {
  signal?.throwIfAborted();
  const bitmap = await createImageBitmap(req.blob, { imageOrientation: 'from-image' });
  try {
    signal?.throwIfAborted();
    const { width, height } = bitmap;
    const look = resolvePhotoLook(req.look, req.theme);
    const maxPixels = look.kind === 'lut' ? PIXEL_KERNEL_MAX_PIXELS : PHOTO_LOOK_MAX_PIXELS;
    if (!width || !height || width * height > maxPixels) throw new Error(`photo look: ${width}x${height} is outside the bake limit`);
    const canvas: OffscreenCanvas | HTMLCanvasElement = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement('canvas'), { width, height });
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as Ctx2D | null;
    if (!ctx) throw new Error('photo look: no 2D canvas in this realm');
    ctx.drawImage(bitmap, 0, 0);
    const image = ctx.getImageData(0, 0, width, height);
    if (look.kind === 'lut') {
      if (!req.lut) throw new Error(`The LUT of photo look ${look.id} is unavailable.`);
      // Keep the existing contrast/lightness recipe, then sample the LUT on the GPU.
      applyPhotoLook(image.data, width, height, { ...look, themes: undefined, amount: 0 }, { lut: req.lut });
      const amount = typeof look.amount === 'number' && Number.isFinite(look.amount) ? look.amount / 100 : 1;
      const { gradeLutWebGpu } = await import('../lib/webgpu/lut.ts');
      image.data.set(await gradeLutWebGpu(image.data, req.lut, amount, signal));
    } else {
      applyPhotoLook(image.data, width, height, req.look, { ...(req.theme ? { theme: req.theme } : {}) });
    }
    signal?.throwIfAborted();
    ctx.putImageData(image, 0, 0);
    const type = req.output ?? photoLookOutputType(req.blob.type);
    const quality = type === 'image/jpeg' ? 0.92 : undefined;
    if ('convertToBlob' in canvas) return await canvas.convertToBlob({ type, ...(quality ? { quality } : {}) });
    return await new Promise<Blob>((resolve, reject) => (canvas as HTMLCanvasElement).toBlob(
      (b) => (b ? resolve(b) : reject(new Error('photo look: the canvas could not encode'))), type, quality));
  } finally {
    bitmap.close();
  }
}
