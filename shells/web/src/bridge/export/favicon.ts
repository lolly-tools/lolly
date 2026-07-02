// SPDX-License-Identifier: MPL-2.0
/**
 * Favicon / ICO export — a multi-resolution .ico (16/32/48 px PNG entries). Best
 * suited to square marks/logos; non-square content is scaled to the box.
 */

import { createFrameSource } from './dom.ts';
import type { FormatAdapter, RenderContext, ExportOptions } from './types.ts';

interface IcoEntry { size: number; bytes: Uint8Array; }

const ICO_SIZES = [16, 32, 48];

async function renderIco(node: HTMLElement, opts: ExportOptions): Promise<Blob> {
  const sizes = opts.icoSizes ?? ICO_SIZES;
  const entries: IcoEntry[] = [];
  for (const size of sizes) {
    // wait:0 — favicons are static, so there's no animation to settle.
    const src = await createFrameSource(node, { width: size, height: size, wait: 0 });
    let canvas: HTMLCanvasElement;
    try { canvas = await src.frame(); } finally { src.dispose(); }
    const blob = await new Promise<Blob>((res, rej) =>
      canvas.toBlob(b => b ? res(b) : rej(new Error('ICO frame encode failed')), 'image/png'));
    entries.push({ size, bytes: new Uint8Array(await blob.arrayBuffer()) });
  }
  return packIco(entries);
}

// Pack PNG entries into an ICO container: ICONDIR + ICONDIRENTRY[] + PNG data.
function packIco(entries: IcoEntry[]): Blob {
  const count = entries.length;
  const header = new Uint8Array(6 + count * 16);
  const dv = new DataView(header.buffer);
  dv.setUint16(0, 0, true);      // reserved
  dv.setUint16(2, 1, true);      // type 1 = icon
  dv.setUint16(4, count, true);  // image count
  let offset = header.length;
  entries.forEach((e, i) => {
    const o = 6 + i * 16;
    header[o]     = e.size >= 256 ? 0 : e.size; // width  (0 ⇒ 256)
    header[o + 1] = e.size >= 256 ? 0 : e.size; // height (0 ⇒ 256)
    dv.setUint16(o + 4, 1, true);               // colour planes
    dv.setUint16(o + 6, 32, true);              // bits per pixel
    dv.setUint32(o + 8, e.bytes.length, true);  // bytes in resource
    dv.setUint32(o + 12, offset, true);         // offset to data
    offset += e.bytes.length;
  });
  const out = new Uint8Array(offset);
  out.set(header, 0);
  let p = header.length;
  for (const e of entries) { out.set(e.bytes, p); p += e.bytes.length; }
  return new Blob([out], { type: 'image/x-icon' });
}

export const faviconAdapter: FormatAdapter = {
  formats: ['ico'],
  render(ctx: RenderContext): Promise<Blob> {
    return renderIco(ctx.node, ctx.opts);
  },
};
