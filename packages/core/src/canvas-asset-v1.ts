// SPDX-License-Identifier: MPL-2.0
/** Portable asset references on the canvas scalar lane. URLs and bytes stay local. */
import type { AssetRef } from './host-v1/asset-ref.ts';

const PREFIX = 'lolly-asset-v1:';
const TYPES = new Set(['raster', 'vector', 'video', 'audio', 'lottie', 'font', 'data', 'model', 'radiance']);
const clean = (value: unknown, limit: number): value is string => typeof value === 'string'
  && value.length > 0 && value.length <= limit && !/[\u0000-\u001f\u007f]/.test(value);

export function portableCanvasAsset(value: unknown): AssetRef | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const ref = value as Partial<AssetRef>;
  if (!clean(ref.id, 2048) || !clean(ref.format, 100) || !TYPES.has(ref.type ?? '')) return null;
  if (ref.source !== 'user' && ref.source !== 'library') return null;
  if (ref.source === 'user' ? !/^user\/team\/[A-Za-z0-9_-]+$/.test(ref.id)
    : ref.id.startsWith('user/') || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(ref.id)) return null;
  const pin = ref.pin;
  if (pin && (!clean(pin.version, 256) || (pin.format !== undefined && !clean(pin.format, 100)))) return null;
  // Project files are immutable and must identify their exact stored bytes.
  if (ref.source === 'user' && !pin) return null;
  const dimensions: { width?: number; height?: number } = {};
  for (const key of ['width', 'height'] as const) {
    const n = ref[key];
    if (n !== undefined) {
      if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0 || n > 1_000_000) return null;
      dimensions[key] = n;
    }
  }
  return { id: ref.id, source: ref.source, type: ref.type!, format: ref.format, url: '', ...dimensions,
    ...(pin ? { pin: { version: pin.version, ...(pin.format ? { format: pin.format } : {}) }, version: pin.version } : {}) };
}

export function encodeCanvasAsset(value: unknown): string | null {
  const ref = portableCanvasAsset(value);
  return ref ? PREFIX + JSON.stringify(ref) : null;
}

export function decodeCanvasAsset(value: unknown): AssetRef | null {
  if (typeof value !== 'string' || value.length > 4096 || !value.startsWith(PREFIX)) return null;
  try { return portableCanvasAsset(JSON.parse(value.slice(PREFIX.length))); } catch { return null; }
}
