// SPDX-License-Identifier: MPL-2.0
/**
 * Tests for engine/src/docx-read.ts - the .docx part-map reader (plan 139 WP4).
 *
 * The fixtures are hand-written WordprocessingML held as an in-memory part map,
 * which is exactly the module's contract: the CALLER inflates the zip, the reader
 * reads the parts. One test additionally authors the same parts as a real archive
 * with `storeZip` and reads it back with `readZip`, so the Uint8Array decode path
 * is covered and not just the string one.
 *
 * The injected `parseXml` adapter is built from the jsdom already in devDeps (the
 * web shell passes the native DOMParser); the engine imports no DOM library.
 *
 * Coverage: headings by pStyle AND by outlineLvl through one w:basedOn hop,
 * nested unordered plus ordered lists, a table with gridSpan and vMerge,
 * hyperlinks, a footnote, an image with alt text, xml:space, accepted track
 * changes, and the hardening regime (hostile parts never throw, a macro-enabled
 * document is refused, the paragraph cap holds).
 *
 * Run with: node --test tests/docx-read.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom'; // typed by tests/jsdom.d.ts (no @types/jsdom exists)

import { isDocx, readDocx } from '../engine/src/docx-read.ts';
import type { DocxParts } from '../engine/src/docx-read.ts';
import type { DocBlock, DocInline } from '../engine/src/doc-model.ts';
import { storeZip, readZip } from '../engine/src/zip.ts';

// ─── the injected parser (jsdom stands in for the shell's native DOMParser) ───

const win = new JSDOM('').window;
const domParser = new win.DOMParser();
const parseXml = (xml: string): Document =>
  domParser.parseFromString(xml, 'application/xml') as unknown as Document;

// ─── fixtures ────────────────────────────────────────────────────────────────

const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const DOC_OPEN = `${XML_DECL}<w:document xmlns:w="${NS_W}" xmlns:r="${NS_R}" xmlns:a="${NS_A}" xmlns:wp="${NS_WP}"><w:body>`;
const DOC_CLOSE = '</w:body></w:document>';

/** Wrap body XML in the document part shell. */
const documentXml = (body: string): string => `${DOC_OPEN}${body}${DOC_CLOSE}`;

const BODY =
  // headings: one by pStyle name, one through a style based on Heading2, one by
  // a style that only declares an outlineLvl.
  `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Chapter One</w:t></w:r></w:p>` +
  `<w:p><w:pPr><w:pStyle w:val="MyHead"/></w:pPr><w:r><w:t>Custom Section</w:t></w:r></w:p>` +
  `<w:p><w:pPr><w:pStyle w:val="Callout"/></w:pPr><w:r><w:t>Outlined Only</w:t></w:r></w:p>` +
  // run marks
  `<w:p>` +
  `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Bold </w:t></w:r>` +
  `<w:r><w:rPr><w:i/></w:rPr><w:t>italic</w:t></w:r>` +
  `<w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t xml:space="preserve"> under</w:t></w:r>` +
  `<w:r><w:rPr><w:strike/></w:rPr><w:t xml:space="preserve"> struck</w:t></w:r>` +
  `<w:r><w:rPr><w:b w:val="0"/></w:rPr><w:t xml:space="preserve"> plain</w:t></w:r>` +
  `</w:p>` +
  // xml:space: the first w:t is trimmed, the second keeps its padding
  `<w:p><w:r><w:t>  padded  </w:t></w:r></w:p>` +
  `<w:p><w:r><w:t xml:space="preserve">  kept  </w:t></w:r></w:p>` +
  // a bullet list with one nested item, then a separate decimal list
  `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Alpha</w:t></w:r></w:p>` +
  `<w:p><w:pPr><w:numPr><w:ilvl w:val="1"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Alpha nested</w:t></w:r></w:p>` +
  `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Beta</w:t></w:r></w:p>` +
  `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr></w:pPr><w:r><w:t>First</w:t></w:r></w:p>` +
  `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr></w:pPr><w:r><w:t>Second</w:t></w:r></w:p>` +
  // hyperlink through the document rels
  `<w:p><w:hyperlink r:id="rId4"><w:r><w:t>SUSE</w:t></w:r></w:hyperlink></w:p>` +
  // footnote reference (the note body lives in footnotes.xml under id 2)
  `<w:p><w:r><w:t>Claim</w:t></w:r><w:r><w:footnoteReference w:id="2"/></w:r></w:p>` +
  // an inline picture with alt text
  `<w:p><w:r><w:drawing><wp:inline>` +
  `<wp:docPr id="1" name="Picture 1" descr="A green lolly"/>` +
  `<a:graphic><a:graphicData><a:blip r:embed="rId5"/></a:graphicData></a:graphic>` +
  `</wp:inline></w:drawing></w:r></w:p>` +
  // track changes: the insertion is accepted, the deletion is gone
  `<w:p><w:ins w:id="9" w:author="A"><w:r><w:t>kept</w:t></w:r></w:ins>` +
  `<w:del w:id="10" w:author="A"><w:r><w:delText>gone</w:delText></w:r></w:del></w:p>` +
  // a quote style
  `<w:p><w:pPr><w:pStyle w:val="Quote"/></w:pPr><w:r><w:t>Quoted line</w:t></w:r></w:p>` +
  // a table: a declared header row with a horizontal merge, then a vertical merge
  `<w:tbl>` +
  `<w:tr><w:trPr><w:tblHeader/></w:trPr>` +
  `<w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr><w:p><w:r><w:t>Wide head</w:t></w:r></w:p></w:tc>` +
  `<w:tc><w:p><w:r><w:t>C</w:t></w:r></w:p></w:tc>` +
  `</w:tr>` +
  `<w:tr>` +
  `<w:tc><w:tcPr><w:vMerge w:val="restart"/></w:tcPr><w:p><w:r><w:t>Tall</w:t></w:r></w:p></w:tc>` +
  `<w:tc><w:p><w:r><w:t>b2</w:t></w:r></w:p></w:tc>` +
  `<w:tc><w:p><w:r><w:t>c2</w:t></w:r></w:p></w:tc>` +
  `</w:tr>` +
  `<w:tr>` +
  `<w:tc><w:tcPr><w:vMerge/></w:tcPr><w:p/></w:tc>` +
  `<w:tc><w:p><w:r><w:t>b3</w:t></w:r></w:p></w:tc>` +
  `<w:tc><w:p><w:r><w:t>c3</w:t></w:r></w:p></w:tc>` +
  `</w:tr>` +
  `</w:tbl>`;

const DOCUMENT = documentXml(BODY);

const STYLES = `${XML_DECL}<w:styles xmlns:w="${NS_W}">` +
  `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>` +
  `<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style>` +
  `<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr></w:style>` +
  `<w:style w:type="paragraph" w:styleId="MyHead"><w:name w:val="My Head"/><w:basedOn w:val="Heading2"/></w:style>` +
  `<w:style w:type="paragraph" w:styleId="Callout"><w:name w:val="Callout"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="2"/></w:pPr></w:style>` +
  `<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/></w:style>` +
  `<w:style w:type="character" w:styleId="Heading9"><w:name w:val="heading 9"/></w:style>` +
  `</w:styles>`;

const NUMBERING = `${XML_DECL}<w:numbering xmlns:w="${NS_W}">` +
  `<w:abstractNum w:abstractNumId="0">` +
  `<w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl>` +
  `<w:lvl w:ilvl="1"><w:numFmt w:val="bullet"/></w:lvl>` +
  `</w:abstractNum>` +
  `<w:abstractNum w:abstractNumId="1">` +
  `<w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl>` +
  `</w:abstractNum>` +
  `<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>` +
  `<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>` +
  `</w:numbering>`;

const DOC_RELS = `${XML_DECL}<Relationships xmlns="${NS_PKG_REL}">` +
  `<Relationship Id="rId1" Type="${NS_R}/styles" Target="styles.xml"/>` +
  `<Relationship Id="rId2" Type="${NS_R}/numbering" Target="numbering.xml"/>` +
  `<Relationship Id="rId3" Type="${NS_R}/footnotes" Target="footnotes.xml"/>` +
  `<Relationship Id="rId4" Type="${NS_R}/hyperlink" Target="https://www.suse.com/" TargetMode="External"/>` +
  `<Relationship Id="rId5" Type="${NS_R}/image" Target="media/image1.png"/>` +
  `</Relationships>`;

const FOOTNOTES = `${XML_DECL}<w:footnotes xmlns:w="${NS_W}">` +
  `<w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote>` +
  `<w:footnote w:type="continuationSeparator" w:id="0"><w:p/></w:footnote>` +
  `<w:footnote w:id="2"><w:p><w:r><w:t>The note body.</w:t></w:r></w:p></w:footnote>` +
  `</w:footnotes>`;

const PARTS: DocxParts = {
  '[Content_Types].xml': `${XML_DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`,
  'word/document.xml': DOCUMENT,
  'word/_rels/document.xml.rels': DOC_RELS,
  'word/styles.xml': STYLES,
  'word/numbering.xml': NUMBERING,
  'word/footnotes.xml': FOOTNOTES,
  'word/media/image1.png': Uint8Array.of(0x89, 0x50, 0x4e, 0x47),
};

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Flatten an inline tree to its plain text, for assertions about content. */
function plain(nodes: DocInline[]): string {
  let out = '';
  for (const n of nodes) {
    switch (n.type) {
      case 'text':
      case 'code':
        out += n.text;
        break;
      case 'br':
        out += '\n';
        break;
      case 'footnoteRef':
        out += `[^${n.id}]`;
        break;
      default:
        if ('inlines' in n) out += plain(n.inlines);
        break;
    }
  }
  return out;
}

const of = <T extends DocBlock['type']>(blocks: DocBlock[], type: T): Extract<DocBlock, { type: T }>[] =>
  blocks.filter((b) => b.type === type) as Extract<DocBlock, { type: T }>[];

/** Does an inline tree contain a node of this type anywhere? */
function hasType(nodes: DocInline[], type: DocInline['type']): boolean {
  for (const n of nodes) {
    if (n.type === type) return true;
    if ('inlines' in n && hasType(n.inlines, type)) return true;
  }
  return false;
}

// ─── structure ───────────────────────────────────────────────────────────────

test('isDocx sniffs a Word part map', () => {
  assert.equal(isDocx(PARTS), true);
  assert.equal(isDocx({ 'WORD/DOCUMENT.XML': '<x/>' }), true);
  assert.equal(isDocx({ 'ppt/presentation.xml': '<x/>' }), false);
  assert.equal(isDocx({ 'word/document.xml': '' }), false);
  assert.equal(isDocx({} as DocxParts), false);
});

test('headings resolve by pStyle name, by basedOn, and by outlineLvl', () => {
  const { blocks } = readDocx(PARTS, parseXml);
  const heads = of(blocks, 'heading');
  assert.deepEqual(
    heads.map((h) => [h.level, plain(h.inlines)]),
    [
      [1, 'Chapter One'],
      [2, 'Custom Section'],
      [3, 'Outlined Only'],
    ],
  );
});

test('run marks nest, and an explicit w:val="0" opts out', () => {
  const { blocks } = readDocx(PARTS, parseXml);
  const marked = of(blocks, 'para').find((p) => plain(p.inlines).startsWith('Bold '));
  assert.ok(marked, 'expected the marked paragraph');
  assert.equal(plain(marked.inlines), 'Bold italic under struck plain');
  assert.equal(hasType(marked.inlines, 'strong'), true);
  assert.equal(hasType(marked.inlines, 'em'), true);
  assert.equal(hasType(marked.inlines, 'underline'), true);
  assert.equal(hasType(marked.inlines, 'strike'), true);
  // The trailing run turns bold OFF, so it must not sit inside a strong node.
  const last = marked.inlines[marked.inlines.length - 1];
  assert.equal(last?.type, 'text');
});

test('xml:space="preserve" keeps padding; its absence trims', () => {
  const { blocks } = readDocx(PARTS, parseXml);
  const texts = of(blocks, 'para').map((p) => plain(p.inlines));
  assert.ok(texts.includes('padded'), 'unmarked w:t should be trimmed');
  assert.ok(texts.includes('  kept  '), 'preserve should keep the padding');
});

test('consecutive numPr paragraphs merge into one list, ordered by numFmt', () => {
  const { blocks } = readDocx(PARTS, parseXml);
  const lists = of(blocks, 'list');
  assert.equal(lists.length, 2, 'bullet run and decimal run are separate blocks');

  const bullets = lists[0]!;
  assert.equal(bullets.ordered, false);
  assert.deepEqual(
    bullets.items.map((i) => [i.level, plain(i.inlines)]),
    [
      [0, 'Alpha'],
      [1, 'Alpha nested'],
      [0, 'Beta'],
    ],
  );

  const numbered = lists[1]!;
  assert.equal(numbered.ordered, true);
  assert.deepEqual(numbered.items.map((i) => plain(i.inlines)), ['First', 'Second']);
});

test('a hyperlink resolves its href through document.xml.rels', () => {
  const { blocks } = readDocx(PARTS, parseXml);
  const para = of(blocks, 'para').find((p) => plain(p.inlines) === 'SUSE');
  assert.ok(para);
  const link = para.inlines[0];
  assert.equal(link?.type, 'link');
  assert.equal(link.type === 'link' ? link.href : '', 'https://www.suse.com/');
});

test('a footnote reference is remapped to a sequential id with its body appended', () => {
  const { blocks } = readDocx(PARTS, parseXml);
  const claim = of(blocks, 'para').find((p) => plain(p.inlines).startsWith('Claim'));
  assert.ok(claim);
  // The producer's id was 2; the emitted document numbers from 1.
  assert.equal(plain(claim.inlines), 'Claim[^1]');

  const notes = of(blocks, 'footnote');
  assert.equal(notes.length, 1);
  assert.equal(notes[0]!.id, '1');
  assert.equal(plain(notes[0]!.inlines), 'The note body.');
});

test('an inline picture becomes an image block plus a media entry', () => {
  const { blocks, media } = readDocx(PARTS, parseXml);
  const images = of(blocks, 'image');
  assert.equal(images.length, 1);
  assert.equal(images[0]!.alt, 'A green lolly');
  assert.equal(images[0]!.ref, 'media/1.png');
  assert.deepEqual(media, [{ path: 'word/media/image1.png', name: 'media/1.png' }]);
});

test('track changes resolve to the accepted text', () => {
  const { blocks } = readDocx(PARTS, parseXml);
  const texts = of(blocks, 'para').map((p) => plain(p.inlines));
  assert.ok(texts.includes('kept'), 'w:ins content is unwrapped');
  assert.ok(!texts.some((t) => t.includes('gone')), 'w:del content is dropped');
});

test('a Quote style becomes a quote block', () => {
  const { blocks } = readDocx(PARTS, parseXml);
  const quotes = of(blocks, 'quote');
  assert.equal(quotes.length, 1);
  assert.equal(plain(quotes[0]!.inlines), 'Quoted line');
});

test('gridSpan becomes colspan and vMerge becomes rowspan', () => {
  const { blocks } = readDocx(PARTS, parseXml);
  const tables = of(blocks, 'table');
  assert.equal(tables.length, 1);
  const t = tables[0]!;
  assert.equal(t.htmlSpans, true);

  assert.ok(t.header, 'w:tblHeader marks the first row as the header');
  assert.deepEqual(t.header.map((c) => plain(c.inlines)), ['Wide head', 'C']);
  assert.equal(t.header[0]!.colspan, 2);

  assert.equal(t.rows.length, 2, 'the vMerge continuation row is not a third row of cells');
  assert.deepEqual(t.rows[0]!.map((c) => plain(c.inlines)), ['Tall', 'b2', 'c2']);
  assert.equal(t.rows[0]![0]!.rowspan, 2);
  assert.deepEqual(t.rows[1]!.map((c) => plain(c.inlines)), ['b3', 'c3']);
});

test('a table with a bold first row and no w:tblHeader still gets a header', () => {
  const body =
    `<w:tbl>` +
    `<w:tr><w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Name</w:t></w:r></w:p></w:tc>` +
    `<w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Role</w:t></w:r></w:p></w:tc></w:tr>` +
    `<w:tr><w:tc><w:p><w:r><w:t>Ada</w:t></w:r></w:p></w:tc>` +
    `<w:tc><w:p><w:r><w:t>Engineer</w:t></w:r></w:p></w:tc></w:tr>` +
    `</w:tbl>`;
  const { blocks } = readDocx({ 'word/document.xml': documentXml(body) }, parseXml);
  const t = of(blocks, 'table')[0];
  assert.ok(t);
  assert.deepEqual(t.header?.map((c) => plain(c.inlines)), ['Name', 'Role']);
  assert.equal(t.rows.length, 1);
  assert.equal(t.htmlSpans, undefined, 'no merges means no HTML escape hatch');
});

test('a plain table keeps every row when nothing marks a header', () => {
  const body =
    `<w:tbl>` +
    `<w:tr><w:tc><w:p><w:r><w:t>a1</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>b1</w:t></w:r></w:p></w:tc></w:tr>` +
    `<w:tr><w:tc><w:p><w:r><w:t>a2</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>b2</w:t></w:r></w:p></w:tc></w:tr>` +
    `</w:tbl>`;
  const { blocks } = readDocx({ 'word/document.xml': documentXml(body) }, parseXml);
  const t = of(blocks, 'table')[0];
  assert.ok(t);
  assert.equal(t.header, undefined);
  assert.equal(t.rows.length, 2);
});

test('a cell keeps multiple paragraphs and flattens a nested table', () => {
  const body =
    `<w:tbl><w:tr><w:tc>` +
    `<w:p><w:r><w:t>one</w:t></w:r></w:p>` +
    `<w:p><w:r><w:t>two</w:t></w:r></w:p>` +
    `<w:tbl><w:tr><w:tc><w:p><w:r><w:t>inner</w:t></w:r></w:p></w:tc></w:tr></w:tbl>` +
    `</w:tc></w:tr></w:tbl>`;
  const { blocks } = readDocx({ 'word/document.xml': documentXml(body) }, parseXml);
  const t = of(blocks, 'table')[0];
  assert.ok(t);
  assert.equal(plain(t.rows[0]![0]!.inlines), 'one\ntwo\ninner');
});

test('a content control (w:sdt) is unwrapped and its cached text kept', () => {
  const body =
    `<w:sdt><w:sdtPr/><w:sdtContent>` +
    `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Contents</w:t></w:r></w:p>` +
    `<w:p><w:fldSimple w:instr=" PAGEREF _Toc1 "><w:r><w:t>Cached entry</w:t></w:r></w:fldSimple></w:p>` +
    `</w:sdtContent></w:sdt>`;
  const { blocks } = readDocx({ 'word/document.xml': documentXml(body), 'word/styles.xml': STYLES }, parseXml);
  assert.equal(of(blocks, 'heading')[0]?.level, 1);
  assert.equal(plain(of(blocks, 'para')[0]?.inlines ?? []), 'Cached entry');
});

// ─── the zip path (bytes, not strings) ───────────────────────────────────────

test('the same fixture read back out of a real archive gives the same blocks', () => {
  const enc = new TextEncoder();
  const zip = storeZip(
    Object.entries(PARTS).map(([name, v]) => ({
      name,
      bytes: typeof v === 'string' ? enc.encode(v) : v,
    })),
  );
  const parts: DocxParts = {};
  for (const e of readZip(zip)) parts[e.name] = e.bytes;

  assert.equal(isDocx(parts), true);
  const fromZip = readDocx(parts, parseXml);
  const fromMap = readDocx(PARTS, parseXml);
  assert.deepEqual(fromZip.blocks, fromMap.blocks);
  assert.deepEqual(fromZip.media, fromMap.media);
});

// ─── hardening ───────────────────────────────────────────────────────────────

test('a macro-enabled document is refused with a clear error', () => {
  assert.throws(
    () => readDocx({ ...PARTS, 'word/vbaProject.bin': Uint8Array.of(1, 2, 3) }, parseXml),
    /macro-enabled/i,
  );
});

test('non-XML bytes in document.xml never throw', () => {
  const junk = new Uint8Array(256);
  for (let i = 0; i < junk.length; i++) junk[i] = (i * 37) & 0xff;
  const res = readDocx({ ...PARTS, 'word/document.xml': junk }, parseXml);
  assert.deepEqual(res.blocks, [], 'an unreadable body yields no blocks');
});

test('a truncated document part yields what parsed instead of throwing', () => {
  const cut = DOCUMENT.slice(0, DOCUMENT.indexOf('<w:tbl>'));
  const res = readDocx({ ...PARTS, 'word/document.xml': cut }, parseXml);
  assert.ok(Array.isArray(res.blocks));
});

test('garbage inputs return an empty document rather than throwing', () => {
  assert.deepEqual(readDocx({} as DocxParts, parseXml), { blocks: [], media: [], truncated: false });
  assert.deepEqual(
    readDocx(Uint8Array.of(1, 2, 3) as unknown as DocxParts, parseXml),
    { blocks: [], media: [], truncated: false },
  );
  assert.deepEqual(
    readDocx(null as unknown as DocxParts, parseXml),
    { blocks: [], media: [], truncated: false },
  );
  assert.deepEqual(
    readDocx(PARTS, null as unknown as typeof parseXml),
    { blocks: [], media: [], truncated: false },
  );
  // A parser that throws on everything is a malformed part, not a crash.
  const angry = (): Document => {
    throw new Error('nope');
  };
  assert.deepEqual(readDocx(PARTS, angry).blocks, []);
});

test('a broken rels or styles part degrades instead of failing the read', () => {
  const res = readDocx(
    { ...PARTS, 'word/_rels/document.xml.rels': '<not xml', 'word/styles.xml': '<<<' },
    parseXml,
  );
  // Heading1 still resolves by its style NAME with no styles part to consult.
  assert.equal(of(res.blocks, 'heading')[0]?.level, 1);
  // The hyperlink loses its href and survives as plain text.
  const para = of(res.blocks, 'para').find((p) => plain(p.inlines) === 'SUSE');
  assert.ok(para);
  assert.equal(para.inlines[0]?.type, 'text');
  assert.deepEqual(res.media, [], 'an unresolvable embed lists no media');
});

test('the paragraph cap bounds a runaway document and reports truncation', () => {
  const many = `<w:p><w:r><w:t>x</w:t></w:r></w:p>`.repeat(20_100);
  const res = readDocx({ 'word/document.xml': documentXml(many) }, parseXml);
  assert.equal(res.truncated, true);
  assert.ok(res.blocks.length <= 20_000, `expected the cap to hold, got ${res.blocks.length}`);
  assert.ok(res.blocks.length >= 19_000, 'the cap should not cut the document short early');
});
