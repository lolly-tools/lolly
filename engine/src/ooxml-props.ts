// SPDX-License-Identifier: MPL-2.0
/**
 * Shared OPC docProps/core.xml writer (plans/144 Wave 2 G3): one core-properties
 * shape for every OOXML package the engine writes (pptx.ts, docx.ts), so the
 * authorship fields cannot drift between them. dc:creator comes from the user's
 * opted-in author name, falling back to 'Lolly'.
 */
export interface OoxmlCoreMeta {
  title?: string;
  description?: string;
  source?: string;
  contact?: string;
  /** dc:creator / cp:lastModifiedBy - the user's name when they opted their details in. */
  author?: string;
  /** The IMPORTED source document's own author (plans/144 G6 follow-up, Andy's
   *  call 2026-08-24: "both authors if not the same"). When present and
   *  different from `author`, dc:creator carries both, source first, joined
   *  with Word's "; " multi-author separator; cp:lastModifiedBy stays the
   *  current actor. Identical names (trimmed, case-insensitive) collapse to one. */
  sourceAuthor?: string;
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function corePropsXml(meta: OoxmlCoreMeta | null | undefined, now: string, fallbackTitle: string): string {
  const title = esc(meta?.title ?? fallbackTitle);
  const desc = [meta?.description, meta?.contact, meta?.source].filter(Boolean).map(String).join(' · ');
  const current = (meta?.author ?? '').trim();
  const source = (meta?.sourceAuthor ?? '').trim();
  const both = source && current && source.toLowerCase() !== current.toLowerCase();
  // Collapsed (same person, or only one present): the current author's own
  // casing wins over the source file's.
  const creator = esc((both ? `${source}; ${current}` : current || source) || 'Lolly');
  const lastModifiedBy = esc(current || 'Lolly');
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:title>${title}</dc:title>` + (desc ? `<dc:description>${esc(desc)}</dc:description>` : '') +
    `<dc:creator>${creator}</dc:creator><cp:lastModifiedBy>${lastModifiedBy}</cp:lastModifiedBy>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>` +
    `</cp:coreProperties>`
  );
}
