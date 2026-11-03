// SPDX-License-Identifier: MPL-2.0
/**
 * Camera raw files in the image library. A raw file is developed on the device by the camera raw
 * decoder, shrunk to the library's edge limit, and stored as an ordinary PNG, so it opens in
 * Darkroom and every other photo tool the way any imported photo does. The raw file itself is not
 * kept. The import report says whether the colour is exact (DNG matrices) or approximate.
 */
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { CameraRawError, describeCameraRawError, type CameraRawMeta } from '@lolly-tools/node-shell/camera-raw';
import { announce } from '../a11y.ts';
import { showUndoToast } from './undo-toast.ts';
import { t, tRaw } from '../i18n.ts';
import { MAX_LONGEST_EDGE, computeResize } from '../bridge/image-resize.ts';
import { cameraRawBitmap, developCameraRaw, isCameraRawFile } from '../bridge/camera-raw.ts';

export interface CameraRawHost { log?(level: 'info' | 'warn' | 'error', message: string, extra?: unknown): void }

/** The colour state in the user's words. The exact words travel with the import report and the Darkroom note. */
export function cameraRawColourNotice(meta: CameraRawMeta): string {
  if (meta.previewOnly) return t('Approximate colour: this is the camera’s embedded JPEG preview, not the raw sensor data.');
  if (meta.color.exact) return meta.color.method === 'monochrome' ? t('Monochrome sensor data.') : t('Exact colour from the matrices in the DNG file.');
  if (meta.color.method === 'embedded-jpeg-fit' && meta.color.deltaE != null) {
    return tRaw('Approximate colour: fitted to the camera’s embedded JPEG (mean difference {de} ΔE).', { de: meta.color.deltaE.toFixed(1) });
  }
  if (meta.color.method === 'embedded-jpeg-fit') return t('Approximate colour: fitted to the camera’s embedded JPEG.');
  return t('Approximate colour: this format has no embedded colour matrices.');
}

/** One report line: format, camera, size and the colour state. */
export function cameraRawImportReport(meta: CameraRawMeta): string {
  const camera = [meta.make, meta.model].filter(Boolean).join(' ').trim();
  const head = camera ? tRaw('{format} from {camera}', { format: meta.format, camera }) : meta.format;
  return `${head}, ${meta.width}×${meta.height}. ${cameraRawColourNotice(meta)}`;
}

async function pngWithinLimit(bitmap: ImageBitmap): Promise<Blob> {
  const { width, height } = computeResize(bitmap.width, bitmap.height, MAX_LONGEST_EDGE);
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(width, height) : Object.assign(document.createElement('canvas'), { width, height });
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
  if (!ctx) throw new Error('Canvas 2D context unavailable.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type: 'image/png' });
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('PNG encoding failed.'))), 'image/png'));
}

/**
 * Develop a camera raw upload and store the picture. Returns null when the file is not raw after
 * all (a JPEG named .dng, a plain TIFF), so the caller carries on with its ordinary handling.
 */
export async function tryStoreCameraRaw(
  host: CameraRawHost,
  file: File,
  store: (file: File) => Promise<AssetRef>,
): Promise<AssetRef | null> {
  if (!(await isCameraRawFile(file))) return null;
  let result: Awaited<ReturnType<typeof developCameraRaw>>;
  try {
    result = await developCameraRaw(new Uint8Array(await file.arrayBuffer()), 'open');
  } catch (error) {
    if (error instanceof CameraRawError && error.code === 'not-raw') return null;
    throw Object.assign(new Error(describeCameraRawError(error)), { code: 'unsupported-format' });
  }
  const bitmap = await cameraRawBitmap(result);
  let png: Blob;
  try { png = await pngWithinLimit(bitmap); } finally { bitmap.close(); }
  const report = cameraRawImportReport(result.meta);
  announce(report);
  // A visible note, so the colour state is never only in the live region: the report gives the format, the
  // camera and whether the colour is exact or approximate.
  showUndoToast({ message: report, undo: () => {}, actionLabel: t('Got it'), wrap: true, duration: 14_000 });
  host.log?.('info', `camera raw import: ${report}`, { warnings: result.meta.warnings });
  const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
  return store(new File([png], `${base}.png`, { type: 'image/png' }));
}
