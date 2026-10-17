// SPDX-License-Identifier: MPL-2.0
/**
 * The effects report for host.pdf.organize: what a page operation does to the
 * bookmarks, annotations, links, form fields and signatures its inputs carry.
 *
 * Every operation except rotating a single PDF builds a new document with
 * pdf-lib's copyPages. That copies each page dictionary and everything it
 * refers to, and nothing from the document catalog: the outline, the AcroForm
 * field list and the named destinations stay behind. So in the new document
 *
 *   - bookmarks are gone,
 *   - comments, highlights and other annotations travel with their pages,
 *   - a link to another page points at a detached copy of that page and goes
 *     nowhere, even when the target page is in the output,
 *   - form widgets still draw but no longer belong to a form,
 *   - a signature widget may still draw, but the document is unsigned.
 *
 * Rotating a single PDF edits that document in place and keeps all of it, but
 * the re-save still invalidates any digital signature.
 *
 * Read-only, bounded and cycle-guarded like pdf-structure.ts: a hostile outline
 * or field tree gives a smaller count, never an error.
 */
import { PDFArray, PDFDict, PDFName, PDFRawStream, PDFRef } from 'pdf-lib';
import type { PDFContext, PDFDocument, PDFObject } from 'pdf-lib';
import type { PdfPageEffect } from '@lolly-tools/core/host-v1';

const MAX_ITEMS = 10_000;
const MAX_ANNOTS_PER_PAGE = 2_000;
const MAX_DEPTH = 32;

/** What one source page carries. */
export interface PageFeatures {
  /** Comments, highlights, stamps and other annotations that are not links, widgets or popups. */
  annotations: number;
  /** Links to a destination inside the same document. */
  links: number;
  /** Form fields (not signatures) with a widget on this page, by object reference. */
  fields: string[];
}

export interface DocumentFeatures {
  bookmarks: number;
  /** Signature fields that hold a signature value. */
  signatures: number;
  pages: PageFeatures[];
}

type Ref = PDFObject | null | undefined;

function look(ctx: PDFContext, o: Ref): PDFObject | undefined {
  try { return ctx.lookup(o as PDFObject | undefined); } catch { return undefined; }
}

function dictOf(ctx: PDFContext, o: Ref): PDFDict | null {
  const v = look(ctx, o);
  return v instanceof PDFRawStream ? v.dict : v instanceof PDFDict ? v : null;
}

function arrOf(ctx: PDFContext, o: Ref): PDFObject[] | null {
  const v = look(ctx, o);
  return v instanceof PDFArray ? v.asArray() : null;
}

function nameOf(ctx: PDFContext, o: Ref): string | null {
  const v = look(ctx, o);
  return v instanceof PDFName ? v.asString().replace(/^\//, '') : null;
}

function get(dict: PDFDict, key: string): PDFObject | undefined {
  return dict.get(PDFName.of(key));
}

function countOutline(ctx: PDFContext, outlines: Ref): number {
  const root = dictOf(ctx, outlines);
  const first = root && get(root, 'First');
  if (!first) return 0;
  const stack: PDFObject[] = [first];
  const seen = new Set<string>();
  let count = 0;
  while (stack.length && count < MAX_ITEMS) {
    const ref = stack.pop()!;
    if (ref instanceof PDFRef) {
      if (seen.has(ref.tag)) continue;
      seen.add(ref.tag);
    }
    const item = dictOf(ctx, ref);
    if (!item) continue;
    count++;
    const next = get(item, 'Next');
    const child = get(item, 'First');
    if (next) stack.push(next);
    if (child) stack.push(child);
  }
  return count;
}

/** A field's inherited value for `key`, walking /Parent from the widget up. */
function inherited(ctx: PDFContext, start: PDFDict, key: string): PDFObject | undefined {
  let node: PDFDict | null = start;
  for (let depth = 0; node && depth < MAX_DEPTH; depth++) {
    const value = get(node, key);
    if (value !== undefined) return value;
    node = dictOf(ctx, get(node, 'Parent'));
  }
  return undefined;
}

/** The reference tag of the field a widget belongs to: the nearest node with a /T. */
function fieldTag(ctx: PDFContext, widgetRef: Ref, widget: PDFDict): string | null {
  let ref: Ref = widgetRef, node: PDFDict | null = widget;
  for (let depth = 0; node && depth < MAX_DEPTH; depth++) {
    if (get(node, 'T') !== undefined) return ref instanceof PDFRef ? ref.tag : null;
    ref = get(node, 'Parent');
    node = dictOf(ctx, ref);
  }
  return widgetRef instanceof PDFRef ? widgetRef.tag : null;
}

function isInternalLink(ctx: PDFContext, link: PDFDict): boolean {
  if (get(link, 'Dest') !== undefined) return true;
  const action = dictOf(ctx, get(link, 'A'));
  return !!action && nameOf(ctx, get(action, 'S')) === 'GoTo';
}

function scanPage(ctx: PDFContext, page: PDFDict): PageFeatures {
  const out: PageFeatures = { annotations: 0, links: 0, fields: [] };
  const annots = arrOf(ctx, get(page, 'Annots')) ?? [];
  const fields = new Set<string>();
  for (const ref of annots.slice(0, MAX_ANNOTS_PER_PAGE)) {
    const annot = dictOf(ctx, ref);
    if (!annot) continue;
    const subtype = nameOf(ctx, get(annot, 'Subtype'));
    if (subtype === 'Link') {
      if (isInternalLink(ctx, annot)) out.links++;
    } else if (subtype === 'Widget') {
      if (nameOf(ctx, inherited(ctx, annot, 'FT')) === 'Sig') continue;
      const tag = fieldTag(ctx, ref, annot);
      if (tag) fields.add(tag);
    } else if (subtype !== 'Popup') {
      out.annotations++;
    }
  }
  out.fields = [...fields];
  return out;
}

function countSignatures(ctx: PDFContext, doc: PDFDocument): number {
  const acro = dictOf(ctx, doc.catalog.get(PDFName.of('AcroForm')));
  const stack: Array<{ ref: PDFObject; depth: number }> = (arrOf(ctx, acro && get(acro, 'Fields')) ?? []).map((ref) => ({ ref, depth: 0 }));
  const seen = new Set<string>();
  let signed = 0, visited = 0;
  while (stack.length && visited++ < MAX_ITEMS) {
    const { ref, depth } = stack.pop()!;
    if (ref instanceof PDFRef) {
      if (seen.has(ref.tag)) continue;
      seen.add(ref.tag);
    }
    const field = dictOf(ctx, ref);
    if (!field) continue;
    const kids = arrOf(ctx, get(field, 'Kids'));
    const isSig = nameOf(ctx, inherited(ctx, field, 'FT')) === 'Sig';
    if (isSig && dictOf(ctx, get(field, 'V'))) { signed++; continue; }
    if (kids && depth < MAX_DEPTH) for (const kid of kids) stack.push({ ref: kid, depth: depth + 1 });
  }
  return signed;
}

/** What a loaded document carries, page by page. */
export function scanPageFeatures(doc: PDFDocument): DocumentFeatures {
  const ctx = doc.context;
  let bookmarks = 0, signatures = 0;
  try { bookmarks = countOutline(ctx, doc.catalog.get(PDFName.of('Outlines'))); } catch { /* malformed outline */ }
  try { signatures = countSignatures(ctx, doc); } catch { /* malformed AcroForm */ }
  const pages: PageFeatures[] = [];
  for (const page of doc.getPages()) {
    try { pages.push(scanPage(ctx, page.node)); } catch { pages.push({ annotations: 0, links: 0, fields: [] }); }
  }
  return { bookmarks, signatures, pages };
}

function say(n: number, one: string, many: string): string {
  return n === 1 ? one : many.replace('#', String(n));
}

/**
 * The report for an operation whose output holds the given global, 1-based
 * source pages. `inPlace` is true only when a single PDF was edited rather
 * than copied into a new document.
 */
export function pageEffects(docs: DocumentFeatures[], outputPages: Iterable<number>, inPlace: boolean): PdfPageEffect[] {
  const all: Array<{ doc: number; page: PageFeatures }> = [];
  docs.forEach((doc, index) => { for (const page of doc.pages) all.push({ doc: index, page }); });
  let annotations = 0, links = 0;
  const fields = new Set<string>();
  for (const n of new Set(outputPages)) {
    const hit = all[n - 1];
    if (!hit) continue;
    annotations += hit.page.annotations;
    links += hit.page.links;
    for (const tag of hit.page.fields) fields.add(`${hit.doc}:${tag}`);
  }
  const bookmarks = docs.reduce((sum, doc) => sum + doc.bookmarks, 0);
  const signatures = docs.reduce((sum, doc) => sum + doc.signatures, 0);
  const effects: PdfPageEffect[] = [];
  if (bookmarks) {
    effects.push(inPlace
      ? { feature: 'bookmarks', count: bookmarks, outcome: 'kept', message: say(bookmarks, '1 bookmark is kept.', '# bookmarks are kept.') }
      : { feature: 'bookmarks', count: bookmarks, outcome: 'removed', message: say(bookmarks, '1 bookmark is not carried into the new PDF.', '# bookmarks are not carried into the new PDF.') });
  }
  if (annotations) {
    effects.push({ feature: 'annotations', count: annotations, outcome: 'kept',
      message: say(annotations, '1 comment or other annotation stays on its page.', '# comments and other annotations stay on their pages.') });
  }
  if (links) {
    effects.push(inPlace
      ? { feature: 'links', count: links, outcome: 'kept', message: say(links, '1 link to another page still works.', '# links to other pages still work.') }
      : { feature: 'links', count: links, outcome: 'broken', message: say(links, '1 link to another page no longer works.', '# links to other pages no longer work.') });
  }
  if (fields.size) {
    const n = fields.size;
    effects.push(inPlace
      ? { feature: 'forms', count: n, outcome: 'kept', message: say(n, '1 form field can still be filled in.', '# form fields can still be filled in.') }
      : { feature: 'forms', count: n, outcome: 'broken', message: say(n, '1 form field can no longer be filled in.', '# form fields can no longer be filled in.') });
  }
  if (signatures) {
    effects.push(inPlace
      ? { feature: 'signatures', count: signatures, outcome: 'invalidated',
        message: say(signatures, '1 digital signature no longer verifies because the PDF is saved again.', '# digital signatures no longer verify because the PDF is saved again.') }
      : { feature: 'signatures', count: signatures, outcome: 'removed',
        message: say(signatures, '1 digital signature does not carry over, so the new PDF is unsigned.', '# digital signatures do not carry over, so the new PDF is unsigned.') });
  }
  return effects;
}
