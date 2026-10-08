// SPDX-License-Identifier: MPL-2.0
/** The original file and its viewing representation keep separate identities. */
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { parseFileAssetId } from '../../../../engine/src/asset-modifiers.ts';
import { instanceFetch } from './instance.ts';

export class AssetViewerReadError extends Error { readonly status: number; constructor(status: number, message: string) { super(message); this.status = status; } }
export type AssetViewerKind = 'pdf' | 'font' | 'vector' | 'converted' | 'existing';
export interface AssetViewerSource {
  id: string; groupId: string; fileId: string | null; revision: string;
  format: string; kind: AssetViewerKind; originalUrl: string; name: string; thumbnail?: string; licence?: string;
}
export function assetViewerKind(format: string): AssetViewerKind {
  if (format === 'pdf' || format === 'ai') return 'pdf';
  if (['ttf', 'otf', 'woff', 'woff2', 'ttc', 'otc'].includes(format)) return 'font';
  if (['svg', 'svgz'].includes(format)) return 'vector';
  if (['eps', 'ps', 'emf', 'wmf'].includes(format)) return 'converted';
  return 'existing';
}
export function assetViewerSource(ref: AssetRef): AssetViewerSource {
  const identity = parseFileAssetId(ref.id);
  const format = String(ref.format ?? '').toLowerCase();
  return { id: ref.id, groupId: identity.baseId, fileId: identity.file, revision: String(ref.version ?? ''),
    format, kind: ref.type === 'font' ? 'font' : assetViewerKind(format), originalUrl: ref.url,
    name: String(ref.meta?.name ?? ref.id), ...(typeof ref.meta?.licence === 'string' ? { licence: ref.meta.licence } : {}),
    ...(typeof ref.meta?.thumbUrl === 'string' ? { thumbnail: ref.meta.thumbUrl } : {}) };
}
export function detectedViewerKind(bytes: Uint8Array): AssetViewerKind {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));
  if (head.includes('%PDF-')) return 'pdf';
  const tag = head.slice(0, 4);
  if (['OTTO', 'wOFF', 'wOF2', 'true', 'ttcf'].includes(tag)
    || bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0) return 'font';
  if (/^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(head)) return 'vector';
  if (head.startsWith('%!PS') || bytes[40] === 32 && head.slice(41, 44) === 'EMF') return 'converted';
  return 'existing';
}
/** Stream with a hard cap even when an upstream omits Content-Length. */
export async function readAssetViewerBytes(url: string, signal: AbortSignal, maxBytes = 64 * 1024 * 1024): Promise<Uint8Array> {
  const response = await instanceFetch(url, { signal, cache: 'no-store' });
  return readAssetViewerResponse(response, signal, maxBytes);
}
export async function readAssetViewerResponse(response: Response, signal: AbortSignal, maxBytes = 64 * 1024 * 1024): Promise<Uint8Array> {
  if (!response.ok) throw new AssetViewerReadError(response.status, response.status === 410 ? 'This asset is no longer available.'
    : response.status === 401 || response.status === 403 ? 'You do not have access to this file.' : 'This file could not be read.');
  const declared = Number(response.headers.get('content-length'));
  if (declared > maxBytes) { await response.body?.cancel(); throw new Error('This file is too large for an inline preview.'); }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('This file has no readable content.');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const next = await reader.read(); if (next.done) break;
      size += next.value.byteLength;
      if (size > maxBytes) throw new Error('This file is too large for an inline preview.');
      chunks.push(next.value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
  signal.throwIfAborted();
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}
