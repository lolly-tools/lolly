// SPDX-License-Identifier: MPL-2.0
/**
 * The catalogue's "Download as" conversion seam.
 *
 * A format choice is a request for different BYTES, never permission to relabel
 * the source. Every encoder result is checked against its actual container before
 * the caller chooses an extension or attaches a derived Content Credential.
 */
import type { ImagesAPI } from '@lolly-tools/core/host-v1';
import type { WavSampleFormat } from '../../../../engine/src/wav.ts';
import { bppForQuality, type VideoQuality, videoBitrate } from '../bridge/video-mime.ts';
import {
  type AudioFormat,
  audioMime,
  isAudioFormat,
  renderAudioExport,
  sniffAudioFormat,
} from './audio-encode.ts';

export type DownloadQuality = 'smaller' | 'balanced' | 'best';
export type ImageDownloadFormat = 'png' | 'jpg' | 'webp';

const IMAGE_MIME: Record<ImageDownloadFormat, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
};

const IMAGE_QUALITY: Record<DownloadQuality, number> = {
  smaller: 0.72,
  balanced: 0.85,
  best: 0.94,
};

const AUDIO_BITRATE: Record<DownloadQuality, number> = {
  smaller: 128_000,
  balanced: 192_000,
  best: 320_000,
};

/** Canonical still-image format from either an extension or MIME type. */
export function imageDownloadFormat(value: string): ImageDownloadFormat | null {
  const v = value
    .toLowerCase()
    .replace(/^image\//, '')
    .replace(/^\./, '');
  if (v === 'jpeg' || v === 'jpg') return 'jpg';
  return v === 'png' || v === 'webp' ? v : null;
}

export function imageDownloadMime(format: ImageDownloadFormat): string {
  return IMAGE_MIME[format];
}

export function imageQualityValue(preset: DownloadQuality, exactPercent?: number): number {
  if (Number.isFinite(exactPercent)) return Math.max(1, Math.min(100, Number(exactPercent))) / 100;
  return IMAGE_QUALITY[preset];
}

export interface ImageDownloadOptions {
  format: ImageDownloadFormat;
  quality: number;
  /** Longest-edge cap. Absent/zero means full source dimensions. */
  maxEdge?: number;
  /** Descriptive metadata moves by default; GPS is an explicit opt-in. */
  keepGps?: boolean;
}

export interface ImageDownloadResult {
  blob: Blob;
  format: ImageDownloadFormat;
  width: number;
  height: number;
}

/** Convert a still through the shell image bridge and reject silent canvas
 * fallbacks (notably a browser returning PNG for an unsupported WebP request). */
export async function transcodeCatalogImage(
  images: ImagesAPI | undefined,
  source: Blob,
  opts: ImageDownloadOptions
): Promise<ImageDownloadResult> {
  if (!images) throw new Error('Image conversion is unavailable on this device.');
  const encodeFormat = opts.format === 'jpg' ? 'jpeg' : opts.format;
  const carryMetadata = opts.keepGps ? { gps: true } : true;
  const result =
    opts.maxEdge && opts.maxEdge > 0
      ? await images.resize(source, {
          maxEdge: Math.round(opts.maxEdge),
          format: encodeFormat,
          quality: opts.quality,
          carryMetadata,
        })
      : await images.encode(source, { format: encodeFormat, quality: opts.quality, carryMetadata });
  const actual = imageDownloadFormat(result.mime);
  if (actual !== opts.format) {
    throw new Error(
      `The encoder produced ${result.mime || 'an unknown format'} instead of ${IMAGE_MIME[opts.format]}.`
    );
  }
  return {
    blob: new Blob([result.bytes as BlobPart], { type: result.mime }),
    format: actual,
    width: result.width,
    height: result.height,
  };
}

export function audioBitrateValue(preset: DownloadQuality, exactKbps?: number): number {
  if (Number.isFinite(exactKbps)) return Math.max(32, Math.min(512, Number(exactKbps))) * 1000;
  return AUDIO_BITRATE[preset];
}

export interface AudioDownloadOptions {
  format: AudioFormat;
  bitrate: number;
  sampleFormat?: WavSampleFormat;
}

/** Decode then genuinely encode an explicitly selected audio format. Container
 * sniffing prevents an extension from ever getting ahead of the bytes. */
export async function transcodeCatalogAudio(
  sourceUrl: string,
  opts: AudioDownloadOptions
): Promise<{ blob: Blob; format: AudioFormat }> {
  if (!isAudioFormat(opts.format)) throw new Error(`Unsupported audio format: ${opts.format}`);
  const blob = await renderAudioExport(opts.format, {
    audio: { url: sourceUrl },
    bitrate: opts.bitrate,
    ...(opts.sampleFormat ? { sampleFormat: opts.sampleFormat } : {}),
    forceEncode: true,
  });
  const actual = sniffAudioFormat(await blob.arrayBuffer());
  if (actual !== opts.format) {
    throw new Error(
      `The encoder produced ${actual ?? (blob.type || 'an unknown format')} instead of ${audioMime(opts.format)}.`
    );
  }
  return { blob, format: actual };
}

export function videoBitrateValue(
  width: number,
  height: number,
  fps: number,
  preset: VideoQuality,
  exactMbps?: number
): number {
  if (Number.isFinite(exactMbps))
    return Math.round(Math.max(1, Math.min(24, Number(exactMbps))) * 1_000_000);
  return videoBitrate(
    Math.max(2, width),
    Math.max(2, height),
    Math.max(1, fps || 30),
    bppForQuality(preset)
  );
}
