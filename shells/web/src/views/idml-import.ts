// SPDX-License-Identifier: MPL-2.0
/** IDML import and Unpack adapters over the shared bounded reader. */
import { readIdmlSpreads, idmlSwatches as parseSwatches, idmlStories as parseStories, type IdmlNode, type IdmlOptions, type ImportResult } from '../../../../engine/src/idml-read.ts';
import { plainOfDesignText } from '../../../../engine/src/design-text.ts';
import { readAdobeXml } from '../../../../engine/src/adobe-xml.ts';
import type { PageText, TextBlock } from '@lolly/engine';
import { strFromU8 } from 'fflate';
import type { UnpackHandle } from './unpack-open.ts';
import type { PdfPageSvg, EmbeddedFont, EmbeddedImageScan } from './pdf-import.ts';
import type { PickerHost } from './picker.ts';
import { t } from '../i18n.ts';

type WebIdmlOptions = IdmlOptions & { host?: unknown; interactive?: boolean };
async function showImportNotes(notes: Set<string>, interactive?: boolean): Promise<void> {
  if (!interactive || !notes.size) return;
  const { choiceDialog } = await import('../components/confirm-dialog.ts');
  await choiceDialog({ title: t('InDesign import notes'), message: t('Review the converted text, images and page geometry.'), items: [...notes].slice(0, 100), choices: [{ id: 'continue', label: t('Continue'), primary: true }] });
}
export async function parseIdmlSpreads(files: Record<string, Uint8Array>, options: WebIdmlOptions = {}) {
  const parse = (source: string) => new DOMParser().parseFromString(source, 'application/xml');
  const notes = new Set<string>();
  const frames = await readIdmlSpreads(files, parse, { ...options, warn: message => { notes.add(message); options.warn?.(message); }, storeImage: options.storeImage ?? (options.host ? async (path, bytes) => {
    const { storeUserUpload } = await import('./picker.ts');
    return storeUserUpload(options.host as PickerHost, new File([bytes as BlobPart], path.split('/').pop() || 'image.png'), { batch: true });
  } : undefined) });
  await showImportNotes(notes, options.interactive);
  return frames;
}
export async function parseIdmlZip(files: Record<string, Uint8Array>, options: WebIdmlOptions = {}): Promise<ImportResult> {
  const notes = new Set<string>();
  const warn = (message: string) => { notes.add(message); options.warn?.(message); };
  const frames = await parseIdmlSpreads(files, { ...options, interactive: false, warn });
  if (frames.length > 1) warn(`Opened the first spread. Import as artboards or scenes to keep all ${frames.length} spreads.`);
  await showImportNotes(notes, options.interactive);
  return frames[0]!;
}
function elems(doc: Document): Element[] { return Array.from(doc.getElementsByTagName('*')); }
// ── Unpack reader (idml → PdfHandle) ────────────────────────────────────────────

/** A referenced-but-not-embedded font row - IDML links its fonts, so no bytes. */
function namesOnlyFont(family: string): EmbeddedFont {
  return {
    name: family, family, ext: 'ttf', bytes: new Uint8Array(0),
    subset: false, installable: false,
    embedding: { permission: 'unknown', noSubsetting: false, bitmapOnly: false, fsType: null },
  };
}

const XML_ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const xmlEsc = (s: string): string => String(s).replace(/[&<>"]/g, (c) => XML_ESC[c]!);

/** A spread's page items as a plain preview SVG - rects/ellipses for shapes, text
 *  for frames. Not a faithful render (no wrapping or kerning), just enough to
 *  recognise the page beside its extracted prose. */
function idmlNodesToSvg(nodes: IdmlNode[], width: number, height: number): string {
  const parts = nodes.map((n) => {
    const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    const rot = n.rot ? ` transform="rotate(${n.rot} ${cx} ${cy})"` : '';
    if (n.kind === 'text') {
      const fs = n.fontSize || 16;
      const fill = n.fg || '#0c322c';
      const anchor = n.textAlign === 'center' ? 'middle' : n.textAlign === 'right' ? 'end' : 'start';
      const tx = anchor === 'middle' ? cx : anchor === 'end' ? n.x + n.w : n.x;
      const tspans = plainOfDesignText(String(n.text || '')).split('\n').map((ln, li) =>
        `<tspan x="${tx}" dy="${li === 0 ? fs : fs * 1.25}">${xmlEsc(ln)}</tspan>`).join('');
      return `<text x="${tx}" y="${n.y}" font-size="${fs}" fill="${fill}" text-anchor="${anchor}"${rot}>${tspans}</text>`;
    }
    const fill = n.fill || 'none';
    const stroke = n.fill ? '' : ' stroke="#d5dbd9" stroke-width="1"';
    if (n.shape === 'ellipse') return `<ellipse cx="${cx}" cy="${cy}" rx="${n.w / 2}" ry="${n.h / 2}" fill="${fill}"${stroke}${rot}/>`;
    return `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" fill="${fill}"${stroke}${rot}/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#ffffff"/>${parts.join('')}</svg>`;
}

const emptyPage = (): PageText =>
  ({ blocks: [], text: '', markdown: '', columns: 1, scanned: false, rotated: 0, order: 'geometric' });

/**
 * Open an IDML package for Unpack - one page per spread, in designmap order (which
 * IS reading order, so it is never re-sorted). Text comes from the stories the
 * spread's frames reference; the palette from the document swatches; fonts are
 * REFERENCED, never embedded, so they come back as names-only rows; and linked
 * images are counted, never fetched, because an .idml carries their names, not
 * their pixels.
 */
export async function openIdmlFile(files: Record<string, Uint8Array>): Promise<UnpackHandle> {
  const parser = new DOMParser();
  const xml = (path: string): Document | null => {
    const b = files[path];
    if (!b) return null;
    try {
      return readAdobeXml(strFromU8(b), s => parser.parseFromString(s, 'application/xml'), 8 * 1024 * 1024);
    } catch { return null; }
  };

  const designmap = xml('designmap.xml');
  if (!designmap) throw new Error('This .idml is missing its designmap.xml.');
  const pkgSrcs = (localName: string): string[] => elems(designmap)
    .filter((el) => el.localName === localName && el.getAttribute('src'))
    .map((el) => el.getAttribute('src') as string);

  const spreadSrcs = pkgSrcs('Spread');
  if (!spreadSrcs.length) throw new Error('This .idml has no spreads to take apart.');

  const swatches = parseSwatches(xml(pkgSrcs('Graphic')[0] || 'Resources/Graphic.xml'));
  const stories: Record<string, Parameters<typeof parseStories>[2][string]> = {};
  for (const src of pkgSrcs('Story')) { const d = xml(src); if (d) parseStories(d, swatches, stories); }

  // Referenced font families - Fonts.xml is the authoritative list; fall back to
  // the families the stories actually applied.
  const fontFamilies: string[] = [];
  const seenFont = new Set<string>();
  const addFont = (fam: string): void => {
    const f = (fam || '').trim();
    if (f && !seenFont.has(f.toLowerCase())) { seenFont.add(f.toLowerCase()); fontFamilies.push(f); }
  };
  const fontsDoc = xml(pkgSrcs('Fonts')[0] || 'Resources/Fonts.xml');
  if (fontsDoc) for (const ff of Array.from(fontsDoc.getElementsByTagName('FontFamily'))) addFont(ff.getAttribute('Name') || '');
  if (!fontFamilies.length) for (const s of Object.values(stories)) addFont(s.font);

  // Linked images - count distinct linked resources across every spread (an .idml
  // stores their URIs, never the bytes).
  const linkedUris = new Set<string>();
  for (const src of spreadSrcs) {
    const d = xml(src);
    if (!d) continue;
    for (const link of Array.from(d.getElementsByTagName('Link'))) {
      const uri = link.getAttribute('LinkResourceURI');
      if (uri) linkedUris.add(uri);
    }
  }

  const frames = await readIdmlSpreads(files, s => parser.parseFromString(s, 'application/xml'));
  const spreadNodes = (i: number): { nodes: IdmlNode[]; width: number; height: number } => {
    const frame = frames[i];
    if (!frame) throw new Error(`No spread ${i + 1} in this IDML.`);
    return frame;
  };
  const palette = [...new Set(Object.values(swatches).filter(hex => /^#[0-9a-f]{6}$/i.test(hex)))];

  return {
    pageCount: spreadSrcs.length,
    async pageToSvg(i: number): Promise<PdfPageSvg> {
      const { nodes, width, height } = spreadNodes(i);
      return { svg: idmlNodesToSvg(nodes, width, height), width, height, elementCount: nodes.length };
    },
    pageToText(i: number): PageText {
      const { nodes } = spreadNodes(i);
      const blocks: TextBlock[] = [];
      for (const n of nodes) {
        if (n.kind !== 'text') continue;
        const txt = plainOfDesignText(n.text || '').trim();
        if (!txt) continue;
        blocks.push({ kind: 'paragraph', text: txt, size: n.fontSize || 0, bold: (n.fontWeight || 400) >= 600, column: 0 });
      }
      if (!blocks.length) return emptyPage();
      const text = blocks.map((b) => b.text).join('\n\n');
      return { blocks, text, markdown: text, columns: 1, scanned: false, rotated: 0, order: 'geometric' };
    },
    listPalette(): string[] {
      return palette;
    },
    listFonts(): EmbeddedFont[] {
      return fontFamilies.map(namesOnlyFont);
    },
    listImages(): Promise<EmbeddedImageScan> {
      return Promise.resolve({ images: [], skipped: linkedUris.size, skippedFilters: [] });
    },
  };
}
