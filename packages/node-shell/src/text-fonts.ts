// SPDX-License-Identifier: MPL-2.0
/** Content-pinned shaping shared by web and Node. Only the supplied reader does I/O. */
import type { TextFontInfoV1, TextFontResourceV1, TextShapeRunRequestV1, TextShapedRunV1 } from '@lolly-tools/core';
import { sfntKind, woffToSfnt, TextSourceError, parseTextDocument } from '@lolly/engine';
import type * as HarfBuzz from 'harfbuzzjs';
import { createTextShapeCache } from './text-shape-cache.ts';
import { textFontInstances } from './text-font-instances.ts';
import { shapeTextRun } from './text-shape.ts';
const MAX_FONT_BYTES = 32 * 1024 * 1024, MAX_CACHE_BYTES = 64 * 1024 * 1024;
interface FaceEntry {
  blob: HarfBuzz.Blob;
  face: HarfBuzz.Face;
  info: TextFontInfoV1;
  bytes: number;
  instances: Map<string, HarfBuzz.Font>;
}
export interface PinnedTextShaper {
  fontInfo(resource: TextFontResourceV1): Promise<TextFontInfoV1>;
  shapeRun(request: TextShapeRunRequestV1): Promise<TextShapedRunV1>;
  clear(): void;
}
function validateResource(resource: TextFontResourceV1): void {
  if (!/^[a-f0-9]{64}$/u.test(resource.sha256) || !Number.isSafeInteger(resource.faceIndex) || resource.faceIndex < 0 || resource.faceIndex > 1023) throw new TextSourceError('font-identity', 'The font needs a SHA-256 content identity and face index.');
  parseTextDocument({ version: 1, stories: [], styles: [], fonts: [resource] });
}
/** A cache hit requires the same content hash and face index, independent of URL. */
export function createPinnedTextShaper(read: (font: TextFontResourceV1) => Promise<Uint8Array>, loadHarfBuzz: () => Promise<typeof HarfBuzz> = () => import('harfbuzzjs')): PinnedTextShaper {
  const shapes=createTextShapeCache();
  const faces = new Map<string, FaceEntry>(), pending = new Map<string, Promise<FaceEntry>>(); let cacheBytes = 0, epoch = 0;
  async function load(resource: TextFontResourceV1): Promise<FaceEntry> {
    validateResource(resource);
    const key = `${resource.sha256}:${resource.faceIndex}`;
    const cached = faces.get(key);
    if (cached) { faces.delete(key); faces.set(key, cached); return cached; }
    const current = pending.get(key); if (current) return current;
    const started = epoch, promise = decode(resource);
    pending.set(key, promise);
    try {
      const entry = await promise;
      if (started === epoch) {
        while (faces.size && (faces.size >= 32 || cacheBytes + entry.bytes > MAX_CACHE_BYTES)) {
          const oldest = faces.keys().next().value!; cacheBytes -= faces.get(oldest)!.bytes; faces.delete(oldest);
        }
        if (entry.bytes <= MAX_CACHE_BYTES) { faces.set(key, entry); cacheBytes += entry.bytes; }
      }
      return entry;
    } finally { if (pending.get(key) === promise) pending.delete(key); }
  }
  async function decode(resource: TextFontResourceV1): Promise<FaceEntry> {
    const supplied = await read(resource);
    if (!(supplied instanceof Uint8Array) || supplied.length < 12 || supplied.length > MAX_FONT_BYTES) throw new TextSourceError('font-size', 'The font is empty or exceeds the supported size.');
    const input = new Uint8Array(supplied);
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', input as Uint8Array<ArrayBuffer>))].map(n => n.toString(16).padStart(2, '0')).join('');
    if (hash !== resource.sha256) throw new TextSourceError('font-changed', `The font content changed: ${resource.family}`);
    const kind = sfntKind(input); let bytes: Uint8Array = input;
    if (kind === 'woff') {
      if (input.length < 44 || new DataView(input.buffer, input.byteOffset, input.byteLength).getUint32(16) > MAX_FONT_BYTES) throw new TextSourceError('font-size', 'The expanded font exceeds the supported size.');
      bytes = woffToSfnt(input);
    }
    else if (kind === 'woff2') {
      if (input.length < 48 || new DataView(input.buffer, input.byteOffset, input.byteLength).getUint32(16) > MAX_FONT_BYTES) throw new TextSourceError('font-size', 'The expanded font exceeds the supported size.');
      try { bytes = await (await import('./woff2.ts')).decodeWoff2(input, { maxOutputBytes: MAX_FONT_BYTES }); }
      catch (error) { throw new TextSourceError('font-format', error instanceof Error ? error.message : 'The WOFF2 font could not be decoded.'); }
    }
    const collection = String.fromCharCode(...bytes.subarray(0, 4)) === 'ttcf';
    if (bytes.length > MAX_FONT_BYTES || (!collection && !['ttf', 'otf'].includes(sfntKind(bytes) ?? ''))) throw new TextSourceError('font-format', 'The font container is not supported.');
    if (resource.faceIndex >= (collection ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(8) : 1)) throw new TextSourceError('font-face', 'The requested font face is missing.');
    const hb = await loadHarfBuzz(), blob = new hb.Blob(bytes as unknown as ArrayBuffer), face = new hb.Face(blob, resource.faceIndex);
    if (!face.referenceTable('head') || !face.referenceTable('cmap') || !face.collectUnicodes().length) throw new TextSourceError('font-format', 'The font has no readable character map.');
    const axes: TextFontInfoV1['axes'] = {};
    for (const [tag, axis] of Object.entries(face.getAxisInfos())) axes[tag] = { min: axis.min, default: axis.default, max: axis.max, name: face.getName(axis.nameId, 'en') || tag };
    const coverage: Array<[number, number]> = [];
    for (const cp of [...face.collectUnicodes()].sort((a, b) => a - b)) { const last = coverage.at(-1); if (last && last[1] + 1 === cp) last[1] = cp; else coverage.push([cp, cp]); }
    const info = { resource: structuredClone(resource), shaper: `HarfBuzz ${hb.versionString()}`, unitsPerEm: face.upem, axes, instances: textFontInstances(face.referenceTable('fvar'),axes,id=>face.getName(id,'en')), features: [...new Set([...face.getTableFeatureTags('GSUB'), ...face.getTableFeatureTags('GPOS')])].sort(), coverage };
    return { blob, face, info, bytes: bytes.length + input.length, instances: new Map() };
  }
  return {
    async fontInfo(resource) { const entry = await load(resource); return { ...structuredClone(entry.info), resource: structuredClone(resource) }; },
    async shapeRun(request) {
      if(!Number.isSafeInteger(request.start)||request.start<0)throw new TextSourceError('shape-options','Invalid text source origin.');
      const entry = await load(request.font), hb = await loadHarfBuzz(), axes: Record<string, number> = {};
      for (const [tag, value] of Object.entries(request.axes ?? {})) {
        const axis = entry.info.axes[tag];
        if (!axis || !Number.isFinite(value) || value < axis.min || value > axis.max) throw new TextSourceError('font-axis', `Unsupported font axis value: ${tag}`);
        axes[tag] = value;
      }
      for (const [tag, axis] of Object.entries(entry.info.axes)) axes[tag] ??= axis.default;
      const settings = Object.entries(axes).sort(([a], [b]) => a.localeCompare(b)), key = JSON.stringify(settings);
      let font = entry.instances.get(key);
      if (!font) {
        font = new hb.Font(entry.face); font.setVariations(settings.map(([tag, value]) => new hb.Variation(tag, value)));
        if (entry.instances.size >= 32) entry.instances.delete(entry.instances.keys().next().value!);
        entry.instances.set(key, font);
      }
      const shapeKey=request.outline===false?null:shapes.key(request),cached=shapeKey?shapes.read(shapeKey,request.start):undefined;if(cached)return cached;
      const result=shapeTextRun(hb, font, { ...request, identity: { id: request.font.id, faceIndex: request.font.faceIndex, sha256: request.font.sha256, family: request.font.family, axes, features: request.features ?? {} } });
      if(shapeKey)shapes.remember(shapeKey,result);return result;
    },
    clear() { epoch++; shapes.clear(); faces.clear(); pending.clear(); cacheBytes = 0; },
  };
}
