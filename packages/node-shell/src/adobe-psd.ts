// SPDX-License-Identifier: MPL-2.0
/** Shared WASM PSD transport and preview mapping for browser and Node shells. */
import { convertColor } from '../../../engine/src/css-color.ts';
import { parseIccProfile } from '../../../engine/src/icc.ts';
import { linearToSrgb } from '../../../engine/src/pixels.ts';
import { readLayerSemantics } from '../../../engine/src/psd-layer-semantics.ts';
import { psdBlendToCss, type LayeredRasterDoc, type RasterLayer } from '../../../engine/src/raster-layers.ts';
import type { PsdReadOptions } from '../../../engine/src/psd.ts';

const MAX_INPUT = 64 * 1024 * 1024;
const MAX_DECODE = 128 * 1024 * 1024;
const MAX_META = 2 * 1024 * 1024;
interface Span { offset: number; length: number }
interface PsdChannel { id: number; data: Span }
interface PsdMask { x: number; y: number; width: number; height: number; default_color: number; flags: number; data: Span }
interface PsdLayer {
  name: string; x: number; y: number; width: number; height: number;
  opacity: number; blend: string; visible: boolean; clipped: boolean; section: number;
  channels: PsdChannel[]; blocks: { key: string; data: Span }[]; mask: PsdMask | null;
}
export interface PsdInspection {
  version: number; width: number; height: number; depth: number; mode: number; channels: number;
  merged_alpha: boolean; icc: Span | null; composite: Span | null; layers: PsdLayer[];
}
interface PsdExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  adobe_psd_alloc(length: number): number;
  adobe_psd_free(pointer: number): void;
  adobe_psd_run(pointer: number, length: number, operation: number, budget: number): number;
  adobe_psd_result_ptr(): number;
  adobe_psd_result_len(): number;
}
function isApi(e: WebAssembly.Exports): e is PsdExports {
  return e.memory instanceof WebAssembly.Memory && ['adobe_psd_alloc', 'adobe_psd_free', 'adobe_psd_run', 'adobe_psd_result_ptr', 'adobe_psd_result_len'].every(k => typeof e[k] === 'function');
}
function byteBudget(value = 64 * 1024 * 1024): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_DECODE) throw new Error('PSD decode budget must be between 1 byte and 128 MB.');
  return value;
}
function envelope(bytes: Uint8Array): { meta: PsdInspection; payload: Uint8Array } {
  if (bytes.length < 4) throw new Error('The PSD adapter returned a truncated response.');
  const length = new DataView(bytes.buffer, bytes.byteOffset).getUint32(0, true);
  if (length > MAX_META || length + 4 > bytes.length) throw new Error('The PSD adapter returned invalid metadata.');
  const meta = JSON.parse(new TextDecoder().decode(bytes.subarray(4, 4 + length))) as PsdInspection;
  if (!Array.isArray(meta.layers) || meta.layers.length > 1024 || !Number.isSafeInteger(meta.width * meta.height) || meta.width < 1 || meta.height < 1) throw new Error('The PSD adapter returned invalid dimensions.');
  return { meta, payload: bytes.subarray(4 + length) };
}
function spanBytes(payload: Uint8Array, span: Span): Uint8Array {
  if (!Number.isSafeInteger(span.offset) || !Number.isSafeInteger(span.length) || span.offset < 0 || span.length < 0 || span.offset + span.length > payload.length) throw new Error('The PSD adapter returned an invalid data span.');
  return payload.subarray(span.offset, span.offset + span.length);
}

export async function createPsdKernel(wasm: Uint8Array) {
  const { instance } = await WebAssembly.instantiate(wasm as Uint8Array<ArrayBuffer>, {});
  if (!isApi(instance.exports)) throw new Error('The PSD adapter ABI is incompatible.');
  const api = instance.exports;
  function run(bytes: Uint8Array, operation: number, budget = 64 * 1024 * 1024): Uint8Array {
    byteBudget(budget);
    if (!bytes.length || bytes.length > MAX_INPUT) throw new Error('Choose a PSD smaller than 64 MB for portable decoding.');
    const pointer = api.adobe_psd_alloc(bytes.length);
    if (!pointer) throw new Error('The PSD adapter refused the input allocation.');
    try {
      new Uint8Array(api.memory.buffer, pointer, bytes.length).set(bytes);
      const status = api.adobe_psd_run(pointer, bytes.length, operation, budget);
      const length = api.adobe_psd_result_len(), at = api.adobe_psd_result_ptr();
      if (length > MAX_DECODE + MAX_META + 4 || at + length > api.memory.buffer.byteLength) throw new Error('The PSD adapter returned an oversized response.');
      const out = new Uint8Array(api.memory.buffer, at, length).slice();
      if (status !== 0) throw new Error(new TextDecoder().decode(out));
      return out;
    } finally { api.adobe_psd_free(pointer); }
  }
  return {
    inspect(bytes: Uint8Array): PsdInspection { return envelope(run(bytes, 1)).meta; },
    roundTrip(bytes: Uint8Array): Uint8Array { return run(bytes, 0); },
    read(bytes: Uint8Array, options: PsdReadOptions = {}): LayeredRasterDoc {
      const budget = byteBudget(options.maxDecodedBytes);
      const { meta, payload } = envelope(run(bytes, options.compositeOnly ? 3 : 2, budget));
      return mapPsd(meta, payload, options, budget);
    },
  };
}
export type PsdKernel = Awaited<ReturnType<typeof createPsdKernel>>;

function mapPsd(meta: PsdInspection, payload: Uint8Array, options: PsdReadOptions, budget: number): LayeredRasterDoc {
  const modes = { 1: 'gray', 3: 'rgb', 4: 'cmyk', 9: 'lab' } as const;
  const mode = modes[meta.mode as keyof typeof modes];
  if (!mode || ![8, 16, 32].includes(meta.depth)) throw new Error('This PSD colour mode or depth has no supported preview.');
  const depth = meta.depth as 8 | 16 | 32;
  const icc = meta.icc ? spanBytes(payload, meta.icc).slice() : undefined;
  const profile = icc ? parseIccProfile(icc) : null;
  const warnings: string[] = [];
  const warn = (code: string, detail?: string) => { if (!warnings.includes(code)) { warnings.push(code); options.onWarn?.(code, detail); } };
  if (depth !== 8) warn('psd.preview-depth', `${depth}-bit source; editable preview uses 8-bit pixels. Preserve the original separately to keep its precision.`);
  if (mode === 'lab') warn('psd.lab-preview', 'Lab preview converted to sRGB. Preserve the original separately to keep its source colour data.');
  if (mode === 'cmyk' && !profile) warn('cmyk.no-profile');
  if (depth === 32) warn('psd.hdr-preview', 'Linear preview is clipped to the display range. This preview does not retain HDR values.');
  let allocated = payload.length;
  const charge = (size: number) => {
    if (!Number.isSafeInteger(size) || size < 0 || size > budget - allocated) throw new Error('PSD preview exceeds the decoded byte budget.');
    allocated += size;
  };
  const sample = (v: DataView | undefined, index: number, fallback: number): number => {
    if (!v) return fallback;
    const at = index * depth / 8;
    if (at + depth / 8 > v.byteLength) throw new Error('PSD channel is shorter than its dimensions.');
    const n = depth === 8 ? v.getUint8(at) / 255 : depth === 16 ? v.getUint16(at) / 65535 : v.getFloat32(at);
    return Number.isFinite(n) ? n : 0;
  };
  const byte = (n: number) => Math.round(Math.max(0, Math.min(1, n)) * 255);
  function pixels(width: number, height: number, planes: Map<number, Uint8Array>): Uint8Array {
    const count = width * height; charge(count * 4);
    const out = new Uint8Array(count * 4);
    const views = new Map([...planes].map(([id, bytes]) => [id, new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)]));
    for (let i = 0; i < count; i++) {
      const c = [0, 1, 2, 3].map(k => sample(views.get(k), i, mode === 'cmyk' ? 1 : 0));
      let rgb: number[];
      if (mode === 'lab') rgb = convertColor({ space: 'lab', components: [c[0]! * 100, c[1]! * 255 - 128, c[2]! * 255 - 128], alpha: 1, missing: 0 }, 'srgb').components;
      else if (mode === 'cmyk') {
        const lab = profile?.toLab('relative', c.map(n => 1 - n));
        rgb = lab ? convertColor({ space: 'lab', components: lab, alpha: 1, missing: 0 }, 'srgb').components : [c[0]! * c[3]!, c[1]! * c[3]!, c[2]! * c[3]!];
      } else if (mode === 'gray') { const gray = depth === 32 ? linearToSrgb(c[0]!) : c[0]!; rgb = [gray, gray, gray]; }
      else rgb = depth === 32 ? c.slice(0, 3).map(linearToSrgb) : c.slice(0, 3);
      out[i * 4] = byte(rgb[0]!); out[i * 4 + 1] = byte(rgb[1]!); out[i * 4 + 2] = byte(rgb[2]!);
      out[i * 4 + 3] = byte(sample(views.get(-1), i, 1));
    }
    return out;
  }
  let composite: LayeredRasterDoc['composite'];
  if (meta.composite) {
    const data = spanBytes(payload, meta.composite), planeLength = meta.width * meta.height * depth / 8;
    const planes = new Map<number, Uint8Array>(), colors = mode === 'gray' ? 1 : mode === 'cmyk' ? 4 : 3;
    for (let i = 0; i < colors; i++) planes.set(i, data.subarray(i * planeLength, (i + 1) * planeLength));
    if (meta.merged_alpha) planes.set(-1, data.subarray(colors * planeLength, (colors + 1) * planeLength));
    composite = { width: meta.width, height: meta.height, pixels: pixels(meta.width, meta.height, planes) };
  }
  const indexed = new Map<number, RasterLayer>(), ancestors: number[] = [];
  for (let i = meta.layers.length - 1; i >= 0; i--) {
    const layer = meta.layers[i]!;
    if (layer.section === 3) { ancestors.pop(); continue; }
    const isGroup = layer.section === 1 || layer.section === 2;
    const blend = psdBlendToCss(layer.blend);
    const raster: RasterLayer = {
      name: layer.name, x: layer.x, y: layer.y, width: layer.width, height: layer.height,
      pixels: !isGroup && layer.channels.length ? pixels(layer.width, layer.height, new Map(layer.channels.map(c => [c.id, spanBytes(payload, c.data)]))) : new Uint8Array(),
      opacity: layer.opacity / 255, blend: blend.css, blendRaw: `psd:${layer.blend}`, blendLossy: blend.lossy,
      visible: layer.visible, clipped: layer.clipped, isGroup, groupPath: [...ancestors],
    };
    if (blend.lossy) warn('blend.lossy', layer.blend);
    const semantics = readLayerSemantics(new Map(layer.blocks.map(b => [b.key, spanBytes(payload, b.data)])), { x: layer.x, y: layer.y, w: layer.width, h: layer.height }, { w: meta.width, h: meta.height });
    if (semantics) raster.psd = semantics;
    if (options.applyLayerMasks !== false && layer.mask && raster.pixels.length) {
      const mask = layer.mask, bytes = spanBytes(payload, mask.data), data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      for (let y = 0; y < layer.height; y++) for (let x = 0; x < layer.width; x++) {
        const mx = layer.x + x - mask.x, my = layer.y + y - mask.y;
        let value = mx >= 0 && my >= 0 && mx < mask.width && my < mask.height ? sample(data, my * mask.width + mx, 1) : mask.default_color / 255;
        if (mask.flags & 4) value = 1 - value;
        const at = (y * layer.width + x) * 4 + 3;
        raster.pixels[at] = byte(raster.pixels[at]! / 255 * value);
      }
    }
    indexed.set(i, raster); if (isGroup) ancestors.push(i);
  }
  const indices = [...indexed.keys()].sort((a, b) => a - b), remap = new Map(indices.map((n, i) => [n, i]));
  const layers = indices.map(i => indexed.get(i)!);
  for (const layer of layers) layer.groupPath = layer.groupPath.map(i => remap.get(i)!).filter(i => i !== undefined);
  return { format: 'psd', width: meta.width, height: meta.height, depth, colorMode: mode, layers, composite, icc, warnings };
}
