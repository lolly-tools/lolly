// SPDX-License-Identifier: MPL-2.0
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { detectFontFormat } from './font-utils.ts';
import { fetchAssetBytes, MOGRT_LIMIT, readMogrt, type MogrtPreview } from './mogrt.ts';
import { readVideoDimensions } from '../bridge/image-resize.ts';

interface SpecialUploadHost {
  assets: {
    get(id: string): Promise<AssetRef>;
    _uploadUserAsset(record: { id: string; type: 'data' | 'font'; format: string; blob: Blob; meta: Record<string, unknown> }): Promise<void>;
  };
}
export async function tryStoreSpecialUpload(host: SpecialUploadHost, file: File): Promise<AssetRef | null> {
  const format = file.name.split('.').pop()?.toLowerCase() ?? '';
  const font = ['ttf', 'otf', 'woff', 'woff2'].includes(format);
  if (!font && format !== 'mogrt') return null;
  const limit = font ? 32 * 1024 * 1024 : MOGRT_LIMIT;
  if (!file.size || file.size > limit) throw new Error(`Choose a ${font ? 'font' : 'MOGRT'} smaller than ${limit / 1024 / 1024} MB.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (font && detectFontFormat(bytes.slice().buffer) !== format) throw new Error('The font contents do not match its file extension.');
  const template = font ? null : readMogrt(bytes);
  const id = `user/upload/${crypto.randomUUID()}`;
  const posterUrl = template?.poster ? `data:image/png;base64,${btoa(Array.from(new Uint8Array(await template.poster.arrayBuffer()), b => String.fromCharCode(b)).join(''))}` : undefined;
  await host.assets._uploadUserAsset({ id, type: font ? 'font' : 'data', format, blob: file, meta: {
    name: file.name, uploadedFont: font, ...(posterUrl ? { posterUrl } : {}),
  } });
  return host.assets.get(id);
}

interface PreviewUploadHost {
  assets: { get(id: string): Promise<AssetRef>; _uploadUserAsset(record: { id: string; type: 'video'; format: string; blob: Blob; width?: number; height?: number; meta: Record<string, unknown> }): Promise<void> };
}
export async function storeMogrtPreview(host: PreviewUploadHost, ref: AssetRef, signal: AbortSignal): Promise<AssetRef> {
  const template = readMogrt(await fetchAssetBytes(ref.original?.url ?? ref.url, MOGRT_LIMIT, signal));
  return storeMogrtPreviewBlob(host, ref, template, signal);
}
export async function storeMogrtPreviewBlob(host: PreviewUploadHost, ref: AssetRef, template: MogrtPreview, signal: AbortSignal): Promise<AssetRef> {
  if (!template.video) throw new Error('This template has no supplied video preview.');
  const { width, height, duration } = await readVideoDimensions(template.video);
  if (signal.aborted) throw new Error('Template import was cancelled.');
  const id = `user/mogrt-preview/${crypto.randomUUID()}`;
  await host.assets._uploadUserAsset({ id, type: 'video', format: 'mp4', blob: template.video, width, height, meta: {
    name: `${template.name} · preview`, sourceAssetId: ref.id, sourceFormat: 'mogrt', suppliedPreview: true,
    ...(duration && duration > 0 ? { durationMs: Math.round(duration * 1000) } : {}),
  } });
  return host.assets.get(id);
}
