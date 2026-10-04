// SPDX-License-Identifier: MPL-2.0
/**
 * A brand photo look baked into a picture's bytes in Node (plan 291 W7): decode with
 * the shared canvas helpers (EXIF orientation applied), apply the engine's look
 * (engine/src/photo-look.ts, the same pixels the web bridge bakes), encode JPEG for a
 * JPEG source and PNG otherwise. Null when this install has no canvas, so the caller
 * serves the plain picture and says so.
 */
import { applyPhotoLook } from '../../../engine/src/photo-look.ts';
import type { GradeLut } from '../../../engine/src/grade.ts';
import type { PhotoTreatment } from '../../../engine/src/photo-treatment.ts';
import { decodeToCanvas, isCanvasAvailable, sniffImageMime } from './canvas.ts';

/** Larger pictures are served without the look. */
export const PHOTO_LOOK_MAX_PIXELS = 64 * 1024 * 1024;

export interface PhotoLookBytes {
  bytes: Uint8Array;
  mime: 'image/jpeg' | 'image/png';
  format: 'jpg' | 'png';
  width: number;
  height: number;
}

export async function bakePhotoLookBytes(
  bytes: Uint8Array,
  look: PhotoTreatment,
  opts: { theme?: string; lut?: GradeLut; mime?: string } = {},
): Promise<PhotoLookBytes | null> {
  if (!isCanvasAvailable()) return null;
  const mime = opts.mime && opts.mime !== 'application/octet-stream' ? opts.mime : sniffImageMime(bytes);
  const canvas = await decodeToCanvas(bytes, mime);
  if (!canvas) throw new Error('photo look: these bytes are not a decodable picture');
  const { width, height } = canvas;
  if (width * height > PHOTO_LOOK_MAX_PIXELS) throw new Error(`photo look: ${width}x${height} is outside the bake limit`);
  const ctx = canvas.getContext('2d');
  const image = ctx.getImageData(0, 0, width, height);
  applyPhotoLook(image.data, width, height, look, { ...(opts.theme ? { theme: opts.theme } : {}), ...(opts.lut ? { lut: opts.lut } : {}) });
  ctx.putImageData(image, 0, 0);
  const jpeg = /^image\/jpe?g$/i.test(mime);
  const buf = jpeg ? canvas.toBuffer('image/jpeg', 92) : canvas.toBuffer('image/png');
  return {
    bytes: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
    mime: jpeg ? 'image/jpeg' : 'image/png',
    format: jpeg ? 'jpg' : 'png',
    width,
    height,
  };
}
