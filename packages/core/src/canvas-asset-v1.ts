// SPDX-License-Identifier: MPL-2.0
/**
 * Portable asset references on the canvas scalar lane. URLs and bytes stay local.
 *
 * One kind of URL travels, because it is an identity rather than a location: a placed
 * Lolly tool (a Design box showing another tool's render) is carried by its canonical
 * embed link, `https://lolly.tools/tool/<id>.<ext>?<settings>` (engine/src/embed.ts).
 * Nothing ever fetches that address. Every shell parses it and re-renders the tool
 * locally with those settings, which is what keeps a tool live (and moving, for a tool
 * whose output animates) in a shared canvas. Before this a placed tool could not cross
 * the lane at all: a team canvas uploaded its rendered picture as a project file instead,
 * which froze the tool. The link is host-locked to lolly.tools and limited to the embed grammar,
 * so it can name no other site.
 */
import type { AssetRef } from './host-v1/asset-ref.ts';

const PREFIX = 'lolly-asset-v1:';
const TYPES = new Set(['raster', 'vector', 'video', 'audio', 'lottie', 'font', 'data', 'model', 'radiance']);
// biome-ignore lint/suspicious/noControlCharactersInRegex: portable identifiers must reject control characters
const controls = /[\u0000-\u001f\u007f]/;
const clean = (value: unknown, limit: number): value is string => typeof value === 'string'
  && value.length > 0 && value.length <= limit && !controls.test(value);
/** The strict embed grammar: https, the lolly.tools host, `/tool/<tool id>.<render ext>`,
 *  an optional query and no fragment. Mirrors engine/src/embed.ts's parseEmbedUrl. */
const TOOL_LINK = /^https:\/\/lolly\.tools\/tool\/[a-z0-9][a-z0-9-]*[a-z0-9]\.(?:png|jpg|jpeg|webp|svg|pdf|webm|mp4|gif|apng)(?:\?[^#\s]*)?$/;
/** A tool link's settings ride in its query, so it may be longer than a library id; the
 *  encoded field as a whole still has to fit the 4096-character lane. */
const TOOL_LINK_MAX = 3800;

/** Is `id` a placed tool's canonical embed link (see the header)? */
export function isCanvasToolLink(id: unknown): id is string {
  return clean(id, TOOL_LINK_MAX) && TOOL_LINK.test(id);
}

export function portableCanvasAsset(value: unknown): AssetRef | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const ref = value as Partial<AssetRef>;
  if (ref.source === 'remote') {
    // A placed tool: its link and what it renders as, nothing else (the picture, its URL
    // and its metadata are re-made by whichever shell opens the canvas).
    if (!isCanvasToolLink(ref.id) || !clean(ref.format, 100) || !TYPES.has(ref.type ?? '')) return null;
    return { id: ref.id, source: 'remote', type: ref.type!, format: ref.format, url: '' };
  }
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
