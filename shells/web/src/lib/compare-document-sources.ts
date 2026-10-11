// SPDX-License-Identifier: MPL-2.0
import type { ComparisonDocumentUnit, ComparisonIdentity, ComparisonSource } from '@lolly-tools/core/host-v1';
import type { DocBlock, DocInline } from '../../../../engine/src/doc-model.ts';
import { comparisonOfficeParts, comparisonXml as xml } from './compare-office-parts.ts';

const MAX_TEXT = 2 * 1024 * 1024, MAX_UNITS = 2_000, MAX_SLIDES = 200, MAX_PAGES = 64;
const LIMIT = 'Document reading is limited to 2,000 blocks, 200 slides, 64 PDF pages and 2 MiB of extracted text per side. Unread content may differ.';
const BAD_OFFICE = 'This document could not be read safely. Choose a valid DOCX or PPTX file within the reading limits.';
const inlineText = (values: readonly DocInline[]): string => values.map(value => 'text' in value ? value.text : 'inlines' in value ? inlineText(value.inlines) : value.type === 'br' ? '\n' : '').join('');
function blockText(block: DocBlock): string {
  if ('inlines' in block) return inlineText(block.inlines);
  if (block.type === 'code') return block.text;
  if (block.type === 'image') return block.alt;
  if (block.type === 'list') return block.items.map(item => inlineText(item.inlines)).join('\n');
  return [...(block.header ? [block.header] : []), ...block.rows].map(row => row.map(cell => inlineText(cell.inlines)).join('\t')).join('\n');
}

function boundedUnits(input: readonly ComparisonDocumentUnit[]): { units: ComparisonDocumentUnit[]; partial: boolean } {
  const units: ComparisonDocumentUnit[] = []; let chars = 0, partial = false;
  for (const unit of input) {
    if (units.length >= MAX_UNITS || chars >= MAX_TEXT) { partial = true; break; }
    const text = unit.text.slice(0, MAX_TEXT - chars); chars += text.length;
    partial ||= text.length !== unit.text.length; units.push({ ...unit, text });
  }
  return { units, partial };
}

async function officeUnits(bytes: Uint8Array, format: 'docx' | 'pptx', signal?: AbortSignal): Promise<{ units: ComparisonDocumentUnit[]; partial: boolean; limitations: string[] }> {
  let parts: Record<string, Uint8Array>;
  try {
    parts = await comparisonOfficeParts(bytes, signal);
    signal?.throwIfAborted();
    if (Object.keys(parts).some(name => /vbaProject\.bin$/i.test(name))) throw new Error(BAD_OFFICE);
    if (format === 'docx') {
      const { readDocx } = await import('../../../../engine/src/docx-read.ts'); signal?.throwIfAborted();
      const main = parts['word/document.xml']; if (!main) throw new Error(BAD_OFFICE);
      const text = new TextDecoder('utf-8', { fatal: true }).decode(main), document = xml(text);
      if (document.documentElement.localName !== 'document') throw new Error(BAD_OFFICE);
      const read = readDocx(parts, xml);
      const partial = read.truncated || /<(?:\w+:)?(?:drawing|oMath|del|ins|txbxContent)\b/.test(text)
        || Object.keys(parts).some(name => /^word\/(?:header|footer|comments)/.test(name));
      return { units: read.blocks.map((block, index) => ({ text: blockText(block), location: { block: index + 1 } })), partial,
        limitations: ['DOCX compares extracted body text and footnotes, with accepted tracked changes. Headers, footers, comments, drawings and equations are outside this reading. Blocks are reading positions, not pages or stable IDs.'] };
    }
    const { readPptx, readingOrder } = await import('../../../../engine/src/pptx-read.ts'); signal?.throwIfAborted();
    const main = parts['ppt/presentation.xml']; if (!main) throw new Error(BAD_OFFICE);
    const doc = xml(new TextDecoder('utf-8', { fatal: true }).decode(main));
    if (doc.documentElement.localName !== 'presentation') throw new Error(BAD_OFFICE);
    const items = Array.from(doc.getElementsByTagNameNS('*', 'sldId'));
    const rels = parts['ppt/_rels/presentation.xml.rels'];
    const relations = rels ? Array.from(xml(new TextDecoder().decode(rels)).getElementsByTagNameNS('*', 'Relationship')) : [];
    const trustworthy = items.every(item => {
      const matches = relations.filter(rel => rel.getAttribute('Id') === item.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));
      const target = matches[0]?.getAttribute('Target')?.replace(/^\/ppt\//, '');
      return matches.length === 1 && matches[0]!.getAttribute('TargetMode') !== 'External' && /\/slide$/.test(matches[0]!.getAttribute('Type') ?? '')
        && !!target && /^slides\/[^/]+\.xml$/.test(target) && !!parts[`ppt/${target}`];
    });
    const ids = items.map(item => item.getAttribute('id'));
    const read = readPptx(parts, xml); if (!read.slides.length && ids.length) throw new Error(BAD_OFFICE);
    const units = read.slides.slice(0, MAX_SLIDES).map(slide => {
      const texts = readingOrder([...(slide.inherited ?? []), ...slide.nodes]).flatMap(node => node.type === 'text'
        ? [node.paras.map(para => para.runs.map(run => run.text).join('')).join('\n')]
        : node.type === 'table' ? [node.rows.map(row => row.join('\t')).join('\n')] : []);
      if (slide.notes) texts.push(slide.notes);
      const id = ids[slide.index];
      return { ...(trustworthy && id && /^\d+$/.test(id) ? { id: `slide:${id}` } : {}), text: texts.join('\n\n'), location: { slide: slide.index + 1 } };
    });
    return { units, partial: read.slides.length > MAX_SLIDES || !!read.warnings?.length || (!trustworthy && !!items.length),
      limitations: ['PPTX compares extracted slide text, tables and speaker notes. Pictures, charts, media and animations are outside this reading. Slide IDs come from the presentation and are useful only for related revisions.'] };
  } catch { signal?.throwIfAborted(); throw new Error(BAD_OFFICE); }
}

async function pdfUnits(bytes: Uint8Array, signal?: AbortSignal): Promise<{ units: ComparisonDocumentUnit[]; partial: boolean; limitations: string[] }> {
  const limitations = ['PDF compares extracted text only, without OCR. Page numbers are positions, not stable IDs; reading order may be inferred from geometry.'];
  try {
    const [{ loadPdfDocument, interpretPdfDocPage, readPdfStructOrder }, { extractPageText }] = await Promise.all([
      import('../../../../packages/node-shell/src/pdf-read.ts'), import('../../../../engine/src/pdf-text.ts'),
    ]);
    signal?.throwIfAborted(); const document = await loadPdfDocument(bytes); signal?.throwIfAborted(); const pageCount = document.getPageCount();
    const units: ComparisonDocumentUnit[] = []; let partial = pageCount > MAX_PAGES, scanned = false, warning = false, chars = 0;
    for (let index = 0; index < Math.min(pageCount, MAX_PAGES); index++) {
      await new Promise<void>(resolve => setTimeout(resolve, 0)); signal?.throwIfAborted();
      const { nodes, width, height } = interpretPdfDocPage(document, index, { diag: () => { warning = true; } });
      let tagged: ReturnType<typeof readPdfStructOrder> = [];
      try { tagged = readPdfStructOrder(document, index); } catch { warning = true; }
      const page = extractPageText(nodes, { width, height, tagged });
      scanned ||= page.scanned; partial ||= page.scanned || !!page.rotated;
      units.push({ text: page.text, location: { page: index + 1 } }); chars += page.text.length;
      if (chars >= MAX_TEXT && index + 1 < pageCount) { partial = true; break; }
    }
    if (scanned) limitations.push('A scanned PDF page has no extracted text. Its contents may differ; OCR was not run.');
    if (warning) limitations.push('Some PDF text or reading-order information could not be decoded. Unread content may differ.');
    return { units, partial: partial || warning, limitations };
  } catch { signal?.throwIfAborted(); throw new Error('This PDF text could not be read safely. Choose an unencrypted PDF within the reading limits.'); }
}

export async function comparisonDocumentBytes(bytes: Uint8Array, identity: ComparisonIdentity, format: string, signal?: AbortSignal): Promise<ComparisonSource> {
  signal?.throwIfAborted();
  if (!['docx', 'pptx', 'pdf'].includes(format)) throw new Error('Choose a DOCX, PPTX or PDF document.');
  const read = format === 'pdf' ? await pdfUnits(bytes, signal) : await officeUnits(bytes, format as 'docx' | 'pptx', signal);
  signal?.throwIfAborted(); const bounded = boundedUnits(read.units), partial = read.partial || bounded.partial;
  if (partial && (bounded.partial || read.units.length >= MAX_SLIDES || read.units.length >= MAX_PAGES)) read.limitations.push(LIMIT);
  return { identity, bytes, content: { kind: 'document', units: bounded.units }, fidelity: { level: partial ? 'partial' : 'complete', limitations: read.limitations } };
}
