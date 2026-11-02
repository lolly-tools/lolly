// SPDX-License-Identifier: MPL-2.0
/** Affinity files in Unpack: page pictures, the words on each page, the palette and the font names. */
import { isAffinitySignature, describeAffinityError } from '@lolly-tools/node-shell/affinity';
import { mapAffinityDocument, type AffinityFrame } from '../../../../engine/src/design-map-affinity.ts';
import { plainOfDesignText } from '../../../../engine/src/design-text.ts';
import type { PageText, TextBlock } from '@lolly/engine';
import type { AffinityRead } from '../bridge/affinity-protocol.ts';
import type { UnpackHandle } from './unpack-open.ts';
import type { PdfPageSvg, EmbeddedFont, EmbeddedImageScan } from './pdf-import.ts';

const XML_ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => String(s).replace(/[&<>"]/g, c => XML_ESC[c]!);
const emptyPage = (): PageText => ({ blocks: [], text: '', markdown: '', columns: 1, scanned: false, rotated: 0, order: 'geometric' });

function namesOnlyFont(family: string): EmbeddedFont {
  return {
    name: family, family, ext: 'ttf', bytes: new Uint8Array(0), subset: false, installable: false,
    embedding: { permission: 'unknown', noSubsetting: false, bitmapOnly: false, fsType: null },
  };
}

/** A plain outline of a frame: text where there is text, boxes elsewhere. Not a faithful render. */
function outlineSvg(frame: AffinityFrame): string {
  const parts = frame.boxes.map(b => {
    const x = Number(b.x), y = Number(b.y), w = Number(b.w), h = Number(b.h);
    if (b.kind === 'text') {
      const size = Number(b.fontSize) || 16;
      return `<text x="${x}" y="${y + size}" font-size="${size}" fill="${esc(String(b.fg))}">${esc(plainOfDesignText(String(b.text)).split('\n')[0] ?? '')}</text>`;
    }
    const fill = /^#[0-9a-f]{3,8}$/i.test(String(b.bg)) ? String(b.bg) : 'none';
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${fill === 'none' ? ' stroke="#d5dbd9"' : ''}/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${frame.width} ${frame.height}" width="${frame.width}" height="${frame.height}"><rect width="${frame.width}" height="${frame.height}" fill="${esc(frame.background || '#ffffff')}"/>${parts.join('')}</svg>`;
}

/** Open an Affinity file for Unpack. Throws in plain words when the file cannot be read at all. */
export async function openAffinityFile(buf: Uint8Array, name: string): Promise<UnpackHandle> {
  if (!isAffinitySignature(buf)) throw new Error('This file is not an Affinity document.');
  const { readAffinityOffThread } = await import('../bridge/affinity.ts');
  let read: AffinityRead;
  try { read = await readAffinityOffThread(buf, name); } catch (error) { throw new Error(describeAffinityError(error)); }
  const frames: AffinityFrame[] = [];
  const colors = new Set<string>(), fonts = new Set<string>();
  if (read.model) {
    try {
      const mapped = await mapAffinityDocument(read.model, { image: () => null });
      frames.push(...mapped.frames);
    } catch { /* The preview below still works. */ }
    const visit = (nodes: typeof read.model.spreads[number]['nodes']): void => {
      for (const n of nodes) {
        if (n.kind.t === 'text') for (const r of n.kind.runs) if (r.family) fonts.add(r.family);
        visit(n.children);
      }
    };
    for (const s of read.model.spreads) visit(s.nodes);
  }
  for (const f of frames) for (const b of f.boxes) {
    for (const c of [b.bg, b.fg, b.stroke]) if (typeof c === 'string' && /^#[0-9a-f]{6}/i.test(c)) colors.add(c.slice(0, 7).toLowerCase());
  }
  const { preview, document: doc } = read.inspection;
  if (!frames.length && !preview) throw new Error('This Affinity file has no preview and its layers could not be read.');
  const previewUri = preview ? `data:image/png;base64,${btoa(Array.from(preview.png, b => String.fromCharCode(b)).join(''))}` : '';
  const pageCount = Math.max(1, frames.length);
  return {
    pageCount,
    async pageToSvg(i: number): Promise<PdfPageSvg> {
      if (i < 0 || i >= pageCount) throw new Error(`No page ${i + 1} in this Affinity file.`);
      // One page: Affinity's own picture is the faithful one. With several, each gets its outline.
      if (previewUri && pageCount === 1) {
        const w = Math.round(doc?.width || preview!.width), h = Math.round(doc?.height || preview!.height);
        return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#ffffff"/><image width="${w}" height="${h}" href="${previewUri}"/></svg>`, width: w, height: h, elementCount: 1 };
      }
      const f = frames[i]!;
      return { svg: outlineSvg(f), width: f.width, height: f.height, elementCount: f.boxes.length };
    },
    pageToText(i: number): PageText {
      const f = frames[i];
      if (!f) return emptyPage();
      const blocks: TextBlock[] = [];
      for (const b of f.boxes) {
        if (b.kind !== 'text') continue;
        const txt = plainOfDesignText(String(b.text ?? '')).trim();
        if (txt) blocks.push({ kind: 'paragraph', text: txt, size: Number(b.fontSize) || 0, bold: Number(b.weight) >= 600, column: 0 });
      }
      if (!blocks.length) return emptyPage();
      const text = blocks.map(b => b.text).join('\n\n');
      return { blocks, text, markdown: text, columns: 1, scanned: false, rotated: 0, order: 'geometric' };
    },
    listPalette(): string[] { return [...colors]; },
    listFonts(): EmbeddedFont[] { return [...fonts].map(namesOnlyFont); },
    listImages(): Promise<EmbeddedImageScan> { return Promise.resolve({ images: [], skipped: 0, skippedFilters: [] }); },
  };
}
