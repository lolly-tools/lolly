// SPDX-License-Identifier: MPL-2.0
import { unzipSync } from 'fflate';
import { instanceFetch } from './instance.ts';

export const MOGRT_LIMIT = 64 * 1024 * 1024;
export interface MogrtPreview {
  name: string;
  video: Blob | null;
  poster: Blob | null;
  fonts: string[];
  controls: { name: string; value: string }[];
}
const record = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const localized = (v: unknown): string => {
  if (typeof v === 'string') return v.slice(0, 2000);
  const db = record(v).strDB;
  if (!Array.isArray(db)) return '';
  const item = db.find(x => record(x).localeString === 'en_US') ?? db[0];
  return typeof record(item).str === 'string' ? String(record(item).str).slice(0, 2000) : '';
};

/** Inspect supplied previews only; never execute or inflate the Adobe project. */
export function readMogrt(bytes: Uint8Array): MogrtPreview {
  if (!bytes.length || bytes.length > MOGRT_LIMIT) throw new Error('Choose a MOGRT smaller than 64 MB.');
  let total = 0;
  const entries = unzipSync(bytes, { filter(entry) {
    if (!/^(definition\.json|thumb\.(mp4|png))$/i.test(entry.name)) return false;
    const limit = /json$/i.test(entry.name) ? 1024 * 1024 : /png$/i.test(entry.name) ? 2 * 1024 * 1024 : MOGRT_LIMIT;
    total += entry.originalSize;
    if (!Number.isFinite(entry.originalSize) || entry.originalSize > limit || total > MOGRT_LIMIT)
      throw new Error('The MOGRT preview is too large.');
    return true;
  } });
  const find = (name: string) => entries[Object.keys(entries).find(k => k.toLowerCase() === name) ?? ''];
  const definition = find('definition.json');
  if (!definition) throw new Error('This MOGRT has no template definition.');
  const doc = record(JSON.parse(new TextDecoder().decode(definition)));
  if (typeof doc.authorApp !== 'string' || typeof doc.capsuleName !== 'string')
    throw new Error('This file has no valid MOGRT template definition.');
  const video = find('thumb.mp4');
  const poster = find('thumb.png');
  const fonts = Object.values(record(doc.usedFontsLocalized)).flatMap(v => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  return {
    name: doc.capsuleName.slice(0, 2000),
    video: video ? new Blob([video.slice().buffer], { type: 'video/mp4' }) : null,
    poster: poster ? new Blob([poster.slice().buffer], { type: 'image/png' }) : null,
    fonts: [...new Set(fonts)].slice(0, 100),
    controls: (Array.isArray(doc.clientControls) ? doc.clientControls : []).slice(0, 100).map(c => ({
      name: localized(record(c).uiName),
      value: typeof record(c).value === 'number' ? String(record(c).value) : localized(record(c).value),
    })).filter(c => c.name),
  };
}

/** Bound streamed downloads as well as their advertised length. */
export async function fetchAssetBytes(url: string, limit: number, signal: AbortSignal): Promise<Uint8Array> {
  const response = await instanceFetch(url, { signal });
  if (!response.ok || !response.body) throw new Error('Could not load the original asset.');
  if (Number(response.headers.get('content-length')) > limit) {
    await response.body.cancel();
    throw new Error('This asset is too large for a preview.');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw new Error('This asset is too large for a preview.');
      chunks.push(value);
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
