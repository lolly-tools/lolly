// SPDX-License-Identifier: MPL-2.0
/**
 * DOCX (Word / WordprocessingML OOXML) builder — pure, DOM-free, platform-agnostic.
 *
 * The document twin of `pptx.ts`: a .docx is a ZIP of XML parts, and the point of the
 * format is the same PowerPoint pitch made to Word — hand over REAL editable text, not a
 * rasterised picture. `writeDocx` takes a tiny block model (headings + paragraphs) and
 * emits a minimal, spec-valid WordprocessingML package that opens and stays fully editable
 * in Word, LibreOffice Writer and Google Docs.
 *
 * The five parts every conforming Word document needs:
 *   • `[Content_Types].xml`        — declares the .rels + .xml defaults and the main-document
 *                                     + styles part content types.
 *   • `_rels/.rels`                — the package root relationship → word/document.xml (the
 *                                     `officeDocument` root; without it Word can't find the body).
 *   • `word/document.xml`          — `w:document/w:body`: one `w:p` per block. A run is
 *                                     `w:r/w:t`, and every `w:t` carries `xml:space="preserve"`
 *                                     so leading/trailing spaces survive. Headings reference a
 *                                     `w:pStyle` ("Heading1".."Heading6"); paragraphs carry none.
 *                                     The body's trailing `w:sectPr` (page geometry) is required
 *                                     for Word to treat the document as laid out.
 *   • `word/styles.xml`            — defines Normal (the document default) + Heading1..6, so a
 *                                     `pStyle` reference actually resolves to a visible style
 *                                     (bold, graded sizes) rather than a dangling id.
 *   • `word/_rels/document.xml.rels` — relates the main document to styles.xml.
 *
 * Namespace trap (shared with pptx.ts): the .rels CONTAINER namespace is
 * …/package/2006/relationships, NOT the …/officeDocument/… relationship-TYPE base. The main
 * document uses the `w:` WordprocessingML namespace throughout.
 *
 * Scope: headings + plain paragraphs only — the deliberate floor that proves the editable-text
 * path, matching EPUB's "one XHTML file per chapter" minimalism. Runs carry no inline styling
 * (bold/italic/colour) yet; that is additive and can land without touching this contract.
 * Returns the finished zip bytes via the shared `storeZip`; no DOM, no deps beyond the named
 * engine primitives.
 */

import { storeZip, type ZipStoreEntry } from './zip.ts';

const encoder = new TextEncoder();

// WordprocessingML + OPC namespaces.
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CT_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';

/** One block of the document. A heading carries a `level` (1..6, clamped); a paragraph ignores it. */
export interface DocxBlock {
  type: 'heading' | 'paragraph';
  /** Heading depth 1..6 → pStyle "Heading1".."Heading6". Out-of-range values clamp. */
  level?: number;
  text: string;
}

/** The document model `writeDocx` serializes. `title` names the document for callers; it is
 *  currently unused by the emitted parts (there is no docProps part) but kept so callers pass a
 *  document, not a bare block list, and a future core.xml is a purely additive change. */
export interface DocxDoc {
  title?: string;
  blocks: DocxBlock[];
}

// Strip the chars ILLEGAL in XML 1.0's Char production BEFORE entity-escaping — the C0
// controls (below U+0020 except tab/LF/CR) plus U+FFFE/U+FFFF. A stray one in user text is a
// hard parse-fail (Word "unreadable content" repair), so drop it at the single chokepoint.
const xmlEsc = (s: string): string =>
  s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Clamp a heading level to the 1..6 range Word defines styles for. Non-finite → 1. */
const clampLevel = (n: number | undefined): number =>
  Number.isFinite(n) ? Math.min(6, Math.max(1, Math.trunc(n as number))) : 1;

/** One `w:p`. A heading references its `w:pStyle`; a run is a single `w:r/w:t` with
 *  `xml:space="preserve"` so surrounding whitespace is not collapsed away. */
function paragraphXml(block: DocxBlock): string {
  const pPr =
    block.type === 'heading' ? `<w:pPr><w:pStyle w:val="Heading${clampLevel(block.level)}"/></w:pPr>` : '';
  const run = `<w:r><w:t xml:space="preserve">${xmlEsc(block.text ?? '')}</w:t></w:r>`;
  return `<w:p>${pPr}${run}</w:p>`;
}

// Body page geometry — US-Letter (12240×15840 twips) with 1" margins. A body with no trailing
// w:sectPr is technically parseable but every real producer emits one, and its absence trips
// Word's layout heuristics; keep it fixed so output is deterministic.
const SECT_PR =
  '<w:sectPr>' +
  '<w:pgSz w:w="12240" w:h="15840"/>' +
  '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>' +
  '</w:sectPr>';

function documentXml(blocks: DocxBlock[]): string {
  // An empty body is invalid (Word repairs a bodyless document), so a document with no blocks
  // still emits one empty paragraph before the sectPr.
  const paras = blocks.length ? blocks.map(paragraphXml).join('') : '<w:p/>';
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<w:document xmlns:w="${W_NS}"><w:body>${paras}${SECT_PR}</w:body></w:document>`
  );
}

// Heading point sizes (half-points, so 32 = 16pt … stepping down to 20 = 10pt at Heading6),
// each bold — enough that a pStyle reference resolves to a visibly distinct style.
const HEADING_HALF_PT = [32, 28, 26, 24, 22, 20];

function stylesXml(): string {
  // docDefaults + Normal give every paragraph a resolved base; each Heading1..6 is a paragraph
  // style based on Normal, so a run inherits the base font and only overrides size/weight.
  let styles =
    `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>`;
  for (let i = 0; i < HEADING_HALF_PT.length; i++) {
    const lvl = i + 1;
    const sz = HEADING_HALF_PT[i]!;
    styles +=
      `<w:style w:type="paragraph" w:styleId="Heading${lvl}">` +
      `<w:name w:val="heading ${lvl}"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="9"/>` +
      `<w:pPr><w:keepNext/><w:outlineLvl w:val="${i}"/></w:pPr>` +
      `<w:rPr><w:b/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>` +
      `</w:style>`;
  }
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<w:styles xmlns:w="${W_NS}">` +
    `<w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault/></w:docDefaults>` +
    styles +
    `</w:styles>`
  );
}

const CONTENT_TYPES_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<Types xmlns="${CT_NS}">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
  `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
  `</Types>`;

const ROOT_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<Relationships xmlns="${PKG_REL_NS}">` +
  `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/>` +
  `</Relationships>`;

const DOCUMENT_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<Relationships xmlns="${PKG_REL_NS}">` +
  `<Relationship Id="rId1" Type="${REL}/styles" Target="styles.xml"/>` +
  `</Relationships>`;

/**
 * Build a valid WordprocessingML .docx (as ZIP bytes) from a heading/paragraph block model.
 *
 * The text stays real and editable: each block becomes a `w:p`, headings reference a
 * "Heading1".."Heading6" `pStyle` defined in `word/styles.xml`, and paragraphs use the default
 * style. Opens in Word, LibreOffice Writer and Google Docs.
 *
 * @param doc  `{ title?, blocks }`. An empty `blocks` still yields a valid one-paragraph doc.
 * @returns the finished .docx archive bytes.
 */
export function writeDocx(doc: DocxDoc): Uint8Array {
  const blocks = Array.isArray(doc?.blocks) ? doc.blocks : [];
  const str = (s: string): Uint8Array => encoder.encode(s);
  const entries: ZipStoreEntry[] = [
    { name: '[Content_Types].xml', bytes: str(CONTENT_TYPES_XML) },
    { name: '_rels/.rels', bytes: str(ROOT_RELS) },
    { name: 'word/document.xml', bytes: str(documentXml(blocks)) },
    { name: 'word/styles.xml', bytes: str(stylesXml()) },
    { name: 'word/_rels/document.xml.rels', bytes: str(DOCUMENT_RELS) },
  ];
  return storeZip(entries);
}
