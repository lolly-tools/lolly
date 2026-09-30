// SPDX-License-Identifier: MPL-2.0
import { collectProductionSvg, inspectProduction, productionFormat, PRODUCTION_MAX_PIXELS, type ProductionCollector } from '../../../../engine/src/production.ts';
/** Inspect imported bytes without mounting active SVG or resolving its resources. */
export const collectBrowserProduction: ProductionCollector = async (bytes, contract, signal) => {
  signal?.throwIfAborted();
  if (bytes.length > 32 * 1024 * 1024) return { limitations: ['artifact-byte-budget-exceeded'] };
  if (contract.profile === 'lolly/production-motion-v1') return { limitations: ['independent-full-motion-readback-unavailable-in-browser'] };
  const format = productionFormat(bytes);
  if (format === 'pdf') return { format, limitations: ['independent-pdf-readback-unavailable-in-browser'] };
  if (format === 'png' || format === 'jpg') {
    const dims = rasterSize(bytes, format);
    if (!dims || dims.width * dims.height > PRODUCTION_MAX_PIXELS) return { format, limitations: ['raster-header-or-pixel-budget'] };
    let bitmap: ImageBitmap | undefined;
    try {
      bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type: format === 'png' ? 'image/png' : 'image/jpeg' }), { imageOrientation: 'none', premultiplyAlpha: 'none' });
      signal?.throwIfAborted();
      if (bitmap.width !== dims.width || bitmap.height !== dims.height) return { format, limitations: ['decoded-size-disagrees-with-container'] };
      const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
      const context = canvas.getContext('2d', { willReadFrequently: true }); if (!context) throw new Error('Canvas unavailable');
      context.drawImage(bitmap, 0, 0);
      const rgba = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
      let opaque = true; for (let i = 3; i < rgba.length; i += 4) if (rgba[i] !== 255) { opaque = false; break; }
      return { format, readable: true, ...dims, pages: 1, opaque, pixels: { ...dims, rgba }, limitations: ['flattened-source-semantics-unavailable', 'browser-canvas-srgb-8-bit-pixels'] };
    } catch { signal?.throwIfAborted(); return { format, limitations: ['pixel-decoder-unavailable-or-failed'] }; }
    finally { bitmap?.close(); }
  }
  try {
    return await collectProductionSvg(bytes, contract, async (xml, ids) => {
      const doc = new DOMParser().parseFromString(xml, 'image/svg+xml'), root = doc.documentElement, wanted = new Set(ids);
      return { valid: !doc.getElementsByTagName('parsererror').length && root.localName === 'svg' && root.namespaceURI === 'http://www.w3.org/2000/svg',
        width: root.getAttribute('width'), height: root.getAttribute('height'), nodes: [root, ...Array.from(root.getElementsByTagName('*'))].filter(n => wanted.has(n.id)).map(n => ({ id: n.id, name: n.namespaceURI === 'http://www.w3.org/2000/svg' ? n.localName : 'unsupported', text: n.textContent ?? '', href: n.getAttribute('href') ?? n.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ?? '', xml: n.outerHTML })) };
    });
  } catch { return { readable: false, limitations: ['svg-parser-unavailable-or-invalid'] }; }
};
function rasterSize(bytes: Uint8Array, format: 'png' | 'jpg'): { width: number; height: number } | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (format === 'png') {
    if (bytes.length < 33 || bytes[24] !== 8) return undefined;
    for (let offset = 8; offset + 12 <= bytes.length;) {
      if (new TextDecoder().decode(bytes.subarray(offset + 4, offset + 8)) === 'acTL') return undefined;
      offset += view.getUint32(offset) + 12;
    }
    const width = view.getUint32(16), height = view.getUint32(20); return width && height ? { width, height } : undefined;
  }
  for (let offset = 2; offset + 4 < bytes.length;) {
    if (bytes[offset] !== 255) return undefined;
    const marker = bytes[offset + 1]!;
    if (marker === 255) { offset++; continue; }
    if (marker === 0xda || marker === 0xd9) break;
    const length = view.getUint16(offset + 2); if (length < 2 || offset + length + 2 > bytes.length) return undefined;
    if ([0xc0, 0xc1, 0xc2].includes(marker) && length >= 8 && bytes[offset + 4] === 8) {
      const height = view.getUint16(offset + 5), width = view.getUint16(offset + 7); return width && height ? { width, height } : undefined;
    }
    offset += length + 2;
  }
  return undefined;
}
export const inspectBrowserProduction = (bytes: Uint8Array, contract: unknown, reference?: Uint8Array, signal?: AbortSignal) => inspectProduction(bytes, contract, collectBrowserProduction, { reference, signal });
