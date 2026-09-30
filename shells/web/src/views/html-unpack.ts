// SPDX-License-Identifier: MPL-2.0
/** Passive HTML extraction. Linked resources are counted, never requested. */
import type { PageText } from '@lolly/engine';
import type { UnpackHandle } from './unpack-open.ts';
import { svgFonts, svgImages, svgPalette, svgVectors } from './svg-unpack.ts';

export async function openHtmlFile(file: Blob): Promise<UnpackHandle> {
  if (file.size > 32 * 1024 * 1024) throw new Error('This HTML file is too large to unpack.');
  const source = await file.text();
  // A detached template keeps scripts, images and frames inert during parsing.
  const template = document.createElement('template');
  template.innerHTML = source;
  const doc = document.implementation.createHTMLDocument('');
  doc.body.append(template.content.cloneNode(true));
  doc.querySelectorAll('script,iframe,object,embed,template').forEach(el => { el.remove(); });
  const fonts = svgFonts(doc);
  for (const svg of doc.querySelectorAll('svg')) {
    if (svg.parentElement?.closest('svg')) continue;
    const frame = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.replaceWith(frame);
    frame.append(svg);
  }
  const vectors = svgVectors(doc);
  for (const img of doc.querySelectorAll('img')) {
    const image = doc.createElementNS('http://www.w3.org/2000/svg', 'image');
    for (const attr of ['width', 'height']) image.setAttribute(attr, img.getAttribute(attr) || '0');
    image.setAttribute('href', img.getAttribute('src') || img.getAttribute('srcset') || '');
    img.replaceWith(image);
  }
  const images = svgImages(doc);
  doc.querySelectorAll('style,link,meta,title,svg,[hidden]').forEach(el => { el.remove(); });
  doc.querySelectorAll('br,p,div,li,h1,h2,h3,h4,h5,h6,tr,section,article').forEach(el => { el.append('\n'); });
  const text = (doc.body.textContent || '').split('\n').map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n\n');
  const page: PageText = {
    blocks: text ? [{ kind: 'paragraph', text, size: 0, bold: false, column: 0 }] : [],
    text, markdown: text, columns: 1, scanned: false, rotated: 0, order: 'geometric',
  };
  return {
    pageCount: 1,
    async pageToSvg() { throw new Error('HTML layout previews are unavailable. Extracted content is shown in the tabs.'); },
    pageToText: () => page,
    listImages: async () => images,
    listFonts: () => fonts,
    listVectors: async () => vectors,
    listPalette: () => svgPalette(source),
  };
}
