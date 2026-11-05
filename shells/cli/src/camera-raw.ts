// SPDX-License-Identifier: MPL-2.0
/**
 * Camera raw files as photos on the command line. A raw file (DNG, CR2, CR3, NEF, ARW, RAF, ORF,
 * RW2 and so on) is developed on this computer with the same WASM decoder the web shell runs, shrunk
 * to the 3840 pixel edge the library uses, and handed to the tool as an ordinary PNG. The note it
 * prints says whether the colour is exact (DNG matrices) or approximate.
 */
import { packPng } from '@lolly/engine';
import { cameraRawReportLine, describeCameraRawError, looksLikeCameraRaw, CameraRawError, type CameraRawImage } from '@lolly-tools/node-shell/camera-raw';
import { loadCameraRawKernel } from '@lolly-tools/node-shell/camera-raw-node';
import { note } from './output.ts';

/** The picture MIME type the sniffer gives a camera raw file, which this module turns into PNG. */
export const CAMERA_RAW_MIME = 'image/x-camera-raw';
const MAX_EDGE = 3840;

/** Box-average an RGBA picture so its long edge is at most `max`; returns it unchanged when it already fits. */
export function fitLongEdge(rgba: Uint8ClampedArray, width: number, height: number, max = MAX_EDGE): { rgba: Uint8ClampedArray; width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { rgba, width, height };
  const scale = max / longest;
  const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * height / h), y1 = Math.max(y0 + 1, Math.floor((y + 1) * height / h));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * width / w), x1 = Math.max(x0 + 1, Math.floor((x + 1) * width / w));
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const i = (yy * width + xx) * 4; r += rgba[i]!; g += rgba[i + 1]!; b += rgba[i + 2]!; n++; }
      out.set([Math.round(r / n), Math.round(g / n), Math.round(b / n), 255], (y * w + x) * 4);
    }
  }
  return { rgba: out, width: w, height: h };
}

/** The developed picture as PNG bytes. */
export function pngOf(image: CameraRawImage): Uint8Array {
  const fitted = fitLongEdge(image.rgba8!, image.width, image.height);
  return packPng(new Uint8Array(fitted.rgba.buffer, fitted.rgba.byteOffset, fitted.rgba.byteLength), { width: fitted.width, height: fitted.height, channels: 4 });
}

/**
 * Develop `bytes` when they are a camera raw file; null for anything else, so the caller carries on
 * with its ordinary handling. A raw file the decoder cannot read throws a message that says what to try.
 */
export async function developRawPhoto(name: string, bytes: Uint8Array): Promise<{ name: string; bytes: Uint8Array; mime: 'image/png' } | null> {
  if (!looksLikeCameraRaw(bytes.subarray(0, 16), name)) return null;
  const kernel = await loadCameraRawKernel();
  let image: CameraRawImage;
  try { image = kernel.open(bytes); }
  catch (error) {
    if (error instanceof CameraRawError && error.code === 'not-raw') return null;
    throw new Error(`${name}: ${describeCameraRawError(error)}`);
  }
  note(`${name}: ${cameraRawReportLine(image.meta)}`);
  return { name: name.replace(/\.[^.]+$/, '') + '.png', bytes: pngOf(image), mime: 'image/png' };
}
