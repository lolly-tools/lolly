// SPDX-License-Identifier: MPL-2.0
/**
 * Shared WASM transport for the camera raw decoder, used by the browser and Node shells.
 *
 * The decoder returns an upright picture plus a description. DNG files use the matrices they carry
 * and are labelled exact. Every other raw format has no embedded colour matrices, so its colour is a
 * per-file fit to the camera's own JPEG, and everything the user sees about it says "approximate colour".
 */

/** Largest raw file accepted for on-device development. */
export const CAMERA_RAW_MAX_INPUT = 192 * 1024 * 1024;
/** The memory ceiling the module is linked with; a file whose development needs more is refused. */
export const CAMERA_RAW_MEMORY_MIB = 512;

/** Extensions of the raw formats the decoder recognises. */
export const CAMERA_RAW_EXTENSIONS = ['dng', 'cr2', 'cr3', 'nef', 'nrw', 'arw', 'srf', 'sr2', 'pef', 'orf', 'rw2', 'raf'] as const;
const EXTENSION_RE = new RegExp(`\\.(?:${CAMERA_RAW_EXTENSIONS.join('|')})$`, 'i');
/** MIME types browsers and the operating system give raw files. */
export const CAMERA_RAW_MIME_RE = /^image\/(?:x-adobe-dng|dng|x-canon-cr[23]|x-nikon-nef|x-nikon-nrw|x-sony-arw|x-sony-sr2|x-sony-srf|x-pentax-pef|x-olympus-orf|x-panasonic-rw2|x-fuji-raf|x-raw)$/i;

/** True when a file name has a camera raw extension. */
export function isCameraRawName(name: string | undefined): boolean {
  return EXTENSION_RE.test(name ?? '');
}

/**
 * Cheap signature check on the first bytes: a TIFF header (every raw but RAF and CR3), the Fujifilm
 * RAF header, or the Canon CR3 box. It does not prove the file is raw (a plain TIFF passes), so the
 * caller pairs it with a raw extension or MIME type, then lets the decoder decide.
 */
export function hasCameraRawSignature(head: Uint8Array): boolean {
  if (head.length < 12) return false;
  const text = (from: number, to: number) => String.fromCharCode(...head.subarray(from, to));
  if (text(0, 16).startsWith('FUJIFILMCCD-RAW')) return true;
  if (text(4, 12) === 'ftypcrx ') return true;
  const tiff = text(0, 2) === 'II' || text(0, 2) === 'MM';
  return tiff;
}

/** True when the name or MIME type says camera raw and the bytes have a plausible header. */
export function looksLikeCameraRaw(head: Uint8Array, name?: string, mime?: string): boolean {
  return (isCameraRawName(name) || CAMERA_RAW_MIME_RE.test(mime ?? '')) && hasCameraRawSignature(head);
}

export type CameraRawErrorCode = 'limit' | 'failed' | 'unsupported' | 'not-raw' | 'crashed';
export class CameraRawError extends Error {
  readonly code: CameraRawErrorCode;
  constructor(code: CameraRawErrorCode, message: string) { super(message); this.name = 'CameraRawError'; this.code = code; }
}

const MODE = { linear16: 0, display8: 1, preview8: 2, probe: 3 } as const;
const DEMOSAIC = { best: 0, balanced: 1, fast: 2 } as const;
export type CameraRawQuality = keyof typeof DEMOSAIC;
export type CameraRawEncoding = 'linear-prophoto-16' | 'srgb-8-rgba';
export type CameraRawColourMethod = 'dng-matrices' | 'embedded-jpeg-fit' | 'camera-profile' | 'neutral-fallback' | 'camera-jpeg' | 'monochrome' | 'unknown';

export interface CameraRawCalibration {
  /** Illuminant temperature in kelvin. */
  temperature: number;
  /** XYZ to camera, row-major 3x3. */
  colorMatrix: number[];
  /** White-balanced camera to XYZ D50, row-major 3x3. */
  forwardMatrix: number[] | null;
  cameraCalibration: number[];
}

export interface CameraRawMeta {
  schema: 1;
  format: string;
  make: string | null;
  model: string | null;
  width: number;
  height: number;
  iso: number | null;
  /** Seconds. */
  exposureTime: number | null;
  fNumber: number | null;
  /** DNG BaselineExposure in EV. */
  baselineExposure: number | null;
  /** The file's EXIF orientation. The pixels are already upright when `orientationApplied` is true. */
  orientation: number | null;
  orientationApplied: boolean;
  whiteBalance: { source: 'as-shot' | 'estimated'; multipliers: [number, number, number]; asShotNeutral: [number, number, number] | null } | null;
  color: {
    exact: boolean;
    /** "exact colour" or "approximate colour". */
    label: 'exact colour' | 'approximate colour';
    method: CameraRawColourMethod;
    /** Mean CIE76 difference between the developed picture and the camera JPEG on the fit grid, and the same for the neutral rendering. */
    deltaE: number | null;
    deltaEFallback: number | null;
    cameraToXyzD50: number[] | null;
    analogBalance: [number, number, number] | null;
    calibrations: CameraRawCalibration[];
  };
  cfa: string | null;
  demosaic: string | null;
  encoding: CameraRawEncoding | 'none';
  /** True when only the camera's embedded JPEG could be opened, not the sensor data. */
  previewOnly: boolean;
  warnings: string[];
}

export interface CameraRawImage {
  width: number;
  height: number;
  /** Linear ProPhoto RGB, three 16-bit samples per pixel, when `meta.encoding` is `linear-prophoto-16`. */
  linear16?: Uint16Array;
  /** sRGB 8-bit RGBA, when `meta.encoding` is `srgb-8-rgba`. */
  rgba8?: Uint8ClampedArray<ArrayBuffer>;
  meta: CameraRawMeta;
}

interface CameraRawExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  camera_raw_alloc(length: number): number;
  camera_raw_free(pointer: number): void;
  camera_raw_run(pointer: number, length: number, mode: number, demosaic: number): number;
  camera_raw_release(): void;
  camera_raw_result_ptr(): number;
  camera_raw_result_len(): number;
  camera_raw_meta_ptr(): number;
  camera_raw_meta_len(): number;
  camera_raw_message_ptr(): number;
  camera_raw_message_len(): number;
}
const EXPORTS = ['camera_raw_alloc', 'camera_raw_free', 'camera_raw_run', 'camera_raw_release', 'camera_raw_result_ptr', 'camera_raw_result_len', 'camera_raw_meta_ptr', 'camera_raw_meta_len', 'camera_raw_message_ptr', 'camera_raw_message_len'];
function isApi(e: WebAssembly.Exports): e is CameraRawExports {
  return e.memory instanceof WebAssembly.Memory && EXPORTS.every(k => typeof e[k] === 'function');
}
const CODES: Record<number, CameraRawErrorCode> = { 1: 'failed', 2: 'limit', 3: 'unsupported', 4: 'not-raw' };

function parseMeta(text: string): CameraRawMeta {
  const meta = JSON.parse(text) as CameraRawMeta;
  if (meta?.schema !== 1 || typeof meta.format !== 'string' || !meta.color || !Array.isArray(meta.warnings)) throw new CameraRawError('failed', 'The camera raw decoder returned an invalid description.');
  return meta;
}

export async function createCameraRawKernel(wasm: Uint8Array) {
  const { instance } = await WebAssembly.instantiate(wasm as Uint8Array<ArrayBuffer>, {});
  if (!isApi(instance.exports)) throw new Error('The camera raw decoder ABI is incompatible.');
  const api = instance.exports;
  // A trap (memory ceiling, abort) leaves the instance in an unknown state, so it is retired.
  let dead = false;

  function run(bytes: Uint8Array, mode: number, quality: number): { pixels: Uint8Array; meta: CameraRawMeta } {
    if (dead) throw new CameraRawError('crashed', 'The camera raw decoder stopped earlier and must be reloaded.');
    if (!bytes.length) throw new CameraRawError('failed', 'This raw file is empty.');
    if (bytes.length > CAMERA_RAW_MAX_INPUT) throw new CameraRawError('limit', `Choose a raw file smaller than ${CAMERA_RAW_MAX_INPUT / 1024 / 1024} MB for on-device development.`);
    let pointer = 0;
    try {
      pointer = api.camera_raw_alloc(bytes.length);
      if (!pointer) throw new CameraRawError('limit', 'The camera raw decoder could not reserve memory for this file.');
      new Uint8Array(api.memory.buffer, pointer, bytes.length).set(bytes);
      const status = api.camera_raw_run(pointer, bytes.length, mode, quality);
      if (status !== 0) {
        const at = api.camera_raw_message_ptr(), length = api.camera_raw_message_len();
        const message = new TextDecoder().decode(new Uint8Array(api.memory.buffer, at, length));
        throw new CameraRawError(CODES[status] ?? 'failed', message || 'The camera raw decoder could not read this file.');
      }
      const metaAt = api.camera_raw_meta_ptr(), metaLength = api.camera_raw_meta_len();
      const meta = parseMeta(new TextDecoder().decode(new Uint8Array(api.memory.buffer, metaAt, metaLength)));
      const at = api.camera_raw_result_ptr(), length = api.camera_raw_result_len();
      if (at + length > api.memory.buffer.byteLength) throw new CameraRawError('limit', 'The camera raw decoder returned an oversized response.');
      const pixels = new Uint8Array(api.memory.buffer, at, length).slice();
      return { pixels, meta };
    } catch (error) {
      if (error instanceof CameraRawError) throw error;
      if (error instanceof WebAssembly.RuntimeError || error instanceof RangeError) {
        dead = true;
        throw new CameraRawError('crashed', `The camera raw decoder ran out of memory (the limit is ${CAMERA_RAW_MEMORY_MIB} MiB) or stopped on this file.`);
      }
      throw error;
    } finally {
      if (!dead) { api.camera_raw_release(); if (pointer) api.camera_raw_free(pointer); }
    }
  }

  function image(bytes: Uint8Array, mode: number, quality: CameraRawQuality): CameraRawImage {
    const { pixels, meta } = run(bytes, mode, DEMOSAIC[quality]);
    const expected = meta.width * meta.height * (meta.encoding === 'linear-prophoto-16' ? 6 : 4);
    if (!Number.isInteger(expected) || pixels.length !== expected) throw new CameraRawError('failed', 'The camera raw decoder returned a picture of the wrong size.');
    if (meta.encoding === 'linear-prophoto-16') return { width: meta.width, height: meta.height, linear16: new Uint16Array(pixels.buffer, 0, pixels.length / 2), meta };
    return { width: meta.width, height: meta.height, rgba8: new Uint8ClampedArray(pixels.buffer as ArrayBuffer), meta };
  }

  return {
    /** True after a crash; load a fresh instance before the next file. */
    get dead(): boolean { return dead; },
    /** Current size of the module's linear memory in bytes. It only grows, so after a file it is that file's peak. */
    get memoryBytes(): number { return api.memory.buffer.byteLength; },
    /** Format and capture facts without decoding the sensor data. Throws `not-raw` for other files. */
    probe(bytes: Uint8Array): CameraRawMeta { return run(bytes, MODE.probe, 0).meta; },
    /** Develop to 16-bit linear ProPhoto RGB. */
    developLinear(bytes: Uint8Array, quality: CameraRawQuality = 'best'): CameraRawImage { return image(bytes, MODE.linear16, quality); },
    /** Develop to sRGB 8-bit RGBA for display. */
    developDisplay(bytes: Uint8Array, quality: CameraRawQuality = 'best'): CameraRawImage { return image(bytes, MODE.display8, quality); },
    /** The camera's embedded JPEG as sRGB 8-bit RGBA, for variants whose sensor data is not decoded. */
    preview(bytes: Uint8Array): CameraRawImage { return image(bytes, MODE.preview8, 'best'); },
    /**
     * Open a raw file for display: the developed sensor data, or when the variant is not decoded the
     * camera's own JPEG, which is labelled as a preview.
     */
    open(bytes: Uint8Array, quality: CameraRawQuality = 'best'): CameraRawImage {
      try { return image(bytes, MODE.display8, quality); }
      catch (error) {
        if (!(error instanceof CameraRawError) || error.code !== 'unsupported') throw error;
        try {
          const shown = image(bytes, MODE.preview8, 'best');
          shown.meta.warnings.unshift(error.message);
          return shown;
        } catch (previewError) {
          if (previewError instanceof CameraRawError && previewError.code === 'unsupported') throw new CameraRawError('unsupported', error.message);
          throw previewError;
        }
      }
    },
  };
}
export type CameraRawKernel = Awaited<ReturnType<typeof createCameraRawKernel>>;

/** Words for the colour state, used wherever the user sees a raw result. */
export function describeCameraRawColour(meta: CameraRawMeta): string {
  if (meta.previewOnly) return 'Approximate colour: this is the camera\'s embedded JPEG preview, not the raw sensor data';
  if (meta.color.exact) return meta.color.method === 'monochrome' ? 'Monochrome sensor data' : 'Exact colour from the matrices in the DNG file';
  if (meta.color.method === 'embedded-jpeg-fit') {
    const de = meta.color.deltaE;
    return `Approximate colour: fitted to the camera's embedded JPEG${de == null ? '' : ` (mean difference ${de.toFixed(1)} ΔE)`}`;
  }
  return 'Approximate colour: this format has no embedded colour matrices';
}

/** One line for an import report: camera, size and the colour state. */
export function cameraRawReportLine(meta: CameraRawMeta): string {
  const camera = [meta.make, meta.model].filter(Boolean).join(' ').trim();
  const dims = `${meta.width}×${meta.height}`;
  const parts = [meta.format + (camera ? ` from ${camera}` : ''), dims, describeCameraRawColour(meta)];
  return parts.join('. ') + '.';
}

/** Short, plain wording for a decoder failure, for import dialogs and the CLI. */
export function describeCameraRawError(error: unknown): string {
  if (error instanceof CameraRawError) {
    switch (error.code) {
      case 'limit': return `${error.message} Convert it to a DNG at a smaller size, or export a JPEG from your camera software.`;
      case 'crashed': return `${error.message} Try a smaller raw file, or export a JPEG from your camera software.`;
      case 'unsupported': return `This raw variant cannot be developed on this device yet: ${error.message} Export a DNG or a JPEG from your camera software.`;
      case 'not-raw': return error.message;
      default: return `This raw file could not be read on this device: ${error.message}`;
    }
  }
  return error instanceof Error ? error.message : String(error);
}
