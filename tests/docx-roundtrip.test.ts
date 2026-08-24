// SPDX-License-Identifier: MPL-2.0
/**
 * The docx round-trip contract (plan 139 WP5): `DocBlock[]` -> `writeDocx` -> unzip ->
 * `readDocx` -> `DocBlock[]`, asserting structural equality on everything both halves
 * support. It is the docx twin of the deck round-trip test, and the reason the writer's
 * choices are the way they are: the reader is the spec the writer is written against.
 *
 * The fixture is deliberately the whole supported surface at once - headings, run marks
 * including the explicit bold opt-out, a hyperlink used twice, nested bullet plus decimal
 * lists, a table with BOTH gridSpan and vMerge, an image with alt text, a footnote and its
 * reference, and text whose padding only survives `xml:space="preserve"`.
 *
 * The FIXTURE IS ALREADY CANONICAL, which the round trip cannot prove on its own:
 *  - marks nest strong > em > underline > strike, the order docx-read.ts rebuilds them in;
 *  - adjacent runs are never re-merged, so one text inline per mark group;
 *  - an image `ref` is `media/N.ext` numbered by first use, the reader's own naming;
 *  - footnote ids run 1..N in first-reference order, because the reader renumbers to that.
 * A fixture that broke any of those would round-trip LOSSILY and the failure would look
 * like a writer bug. The per-feature losses are listed in the writer's header.
 *
 * Plus two guards that have nothing to do with the round trip: the pre-doc-model
 * `{ type, level?, text }` block list still produces the exact five parts and the exact
 * document.xml it always did, and a document with no list emits no numbering.xml.
 *
 * Run with: node --test tests/docx-roundtrip.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom'; // typed by tests/jsdom.d.ts (no @types/jsdom exists)

import { writeDocx } from '../engine/src/docx.ts';
import type { DocxDoc } from '../engine/src/docx.ts';
import { readDocx } from '../engine/src/docx-read.ts';
import type { DocxParts } from '../engine/src/docx-read.ts';
import type { DocBlock } from '../engine/src/doc-model.ts';
import { readZip } from '../engine/src/zip.ts';

const win = new JSDOM('').window;
const domParser = new win.DOMParser();
const parseXml = (xml: string): Document =>
  domParser.parseFromString(xml, 'application/xml') as unknown as Document;

const decoder = new TextDecoder('utf-8');

/** The written archive as the part map `readDocx` consumes, plus the part order. */
function unzip(bytes: Uint8Array): { parts: DocxParts; names: string[] } {
  const parts: DocxParts = {};
  const names: string[] = [];
  for (const e of readZip(bytes)) {
    parts[e.name] = e.bytes;
    names.push(e.name);
  }
  return { parts, names };
}

const text = (parts: DocxParts, name: string): string => {
  const v = parts[name];
  assert.ok(v !== undefined, `expected part ${name}`);
  return typeof v === 'string' ? v : decoder.decode(v);
};

const roundTrip = (doc: DocxDoc) => {
  const { parts, names } = unzip(writeDocx(doc));
  return { ...readDocx(parts, parseXml), parts, names };
};

// ─── fixtures ────────────────────────────────────────────────────────────────

// A 320x240 PNG header: the IHDR is the first chunk, which is all `imagePx` reads.
const PNG = new Uint8Array(24);
PNG.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
PNG.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8);
PNG.set([0, 0, 0x01, 0x40], 16); // width 320
PNG.set([0, 0, 0, 0xf0], 20); // height 240

const HREF = 'https://www.suse.com/';

const FIXTURE: DocBlock[] = [
  { type: 'heading', level: 1, inlines: [{ type: 'text', text: 'Round Trip' }] },
  // A heading that mixes a styled and a plain run: the Heading style is bold, so the plain
  // run only stays plain if the writer spells out `<w:b w:val="0"/>`.
  {
    type: 'heading',
    level: 2,
    inlines: [
      { type: 'strong', inlines: [{ type: 'text', text: 'Styled' }] },
      { type: 'text', text: ' and plain' },
    ],
  },
  {
    type: 'para',
    inlines: [
      { type: 'strong', inlines: [{ type: 'text', text: 'bold' }] },
      { type: 'text', text: ' ' },
      { type: 'em', inlines: [{ type: 'text', text: 'italic' }] },
      { type: 'text', text: ' ' },
      { type: 'underline', inlines: [{ type: 'text', text: 'under' }] },
      { type: 'text', text: ' ' },
      { type: 'strike', inlines: [{ type: 'text', text: 'struck' }] },
      { type: 'strong', inlines: [{ type: 'em', inlines: [{ type: 'text', text: ' both' }] }] },
      { type: 'br' },
      // Padding only survives because every w:t is written xml:space="preserve".
      { type: 'text', text: '  kept  ' },
    ],
  },
  {
    type: 'para',
    inlines: [
      { type: 'text', text: 'See ' },
      { type: 'link', href: HREF, inlines: [{ type: 'text', text: 'SUSE' }] },
      { type: 'text', text: ' and ' },
      { type: 'link', href: HREF, inlines: [{ type: 'text', text: 'again' }] },
    ],
  },
  { type: 'quote', inlines: [{ type: 'text', text: 'Quoted line' }] },
  {
    type: 'list',
    ordered: false,
    items: [
      { level: 0, inlines: [{ type: 'text', text: 'Alpha' }] },
      { level: 1, inlines: [{ type: 'text', text: 'Alpha nested' }] },
      { level: 0, inlines: [{ type: 'text', text: 'Beta' }] },
    ],
  },
  {
    type: 'list',
    ordered: true,
    items: [
      { level: 0, inlines: [{ type: 'text', text: 'First' }] },
      { level: 0, inlines: [{ type: 'text', text: 'Second' }] },
    ],
  },
  {
    type: 'table',
    header: [
      { inlines: [{ type: 'text', text: 'Wide head' }], colspan: 2 },
      { inlines: [{ type: 'text', text: 'C' }] },
    ],
    rows: [
      [
        { inlines: [{ type: 'text', text: 'Tall' }], rowspan: 2 },
        { inlines: [{ type: 'text', text: 'b2' }] },
        { inlines: [{ type: 'text', text: 'c2' }] },
      ],
      [
        { inlines: [{ type: 'text', text: 'b3' }] },
        { inlines: [{ type: 'text', text: 'c3' }] },
      ],
    ],
    htmlSpans: true,
  },
  { type: 'image', ref: 'media/1.png', alt: 'A green lolly' },
  {
    type: 'para',
    inlines: [{ type: 'text', text: 'Claim' }, { type: 'footnoteRef', id: '1' }],
  },
  // The reader appends note bodies after the flow, in first-reference order.
  { type: 'footnote', id: '1', inlines: [{ type: 'text', text: 'The note body.' }] },
];

const DOC: DocxDoc = {
  title: 'Round Trip',
  blocks: FIXTURE,
  media: [{ name: 'media/1.png', bytes: PNG }],
};

// ─── the contract ────────────────────────────────────────────────────────────

test('DocBlocks survive writeDocx -> readDocx unchanged', () => {
  const { blocks, media, truncated } = roundTrip(DOC);
  assert.equal(truncated, false);
  assert.deepEqual(blocks, FIXTURE);
  assert.deepEqual(media, [{ path: 'word/media/image1.png', name: 'media/1.png' }]);
});

test('the written package carries the conditional parts the fixture needs', () => {
  const { names, parts } = roundTrip(DOC);
  for (const need of [
    '[Content_Types].xml',
    '_rels/.rels',
    'word/document.xml',
    'word/styles.xml',
    'word/_rels/document.xml.rels',
    'word/numbering.xml',
    'word/footnotes.xml',
    'word/media/image1.png',
  ]) {
    assert.ok(names.includes(need), `missing part ${need}`);
  }
  // Every conditional part registers its own content type.
  const ct = text(parts, '[Content_Types].xml');
  assert.match(ct, /PartName="\/word\/numbering\.xml"/);
  assert.match(ct, /PartName="\/word\/footnotes\.xml"/);
  assert.match(ct, /<Default Extension="png" ContentType="image\/png"\/>/);
});

test('one relationship per unique hyperlink target, external and deduped', () => {
  const { parts } = roundTrip(DOC);
  const rels = text(parts, 'word/_rels/document.xml.rels');
  const links = rels.match(/Type="[^"]*\/hyperlink"/g) ?? [];
  assert.equal(links.length, 1, 'the same href twice is one relationship');
  assert.match(rels, new RegExp(`Target="${HREF}" TargetMode="External"`));
  assert.match(rels, /Type="[^"]*\/image" Target="media\/image1\.png"/);
  assert.match(rels, /Type="[^"]*\/numbering" Target="numbering\.xml"/);
  assert.match(rels, /Type="[^"]*\/footnotes" Target="footnotes\.xml"/);
});

test('a plain run inside a mixed heading writes the explicit bold opt-out', () => {
  const { parts } = roundTrip(DOC);
  const doc = text(parts, 'word/document.xml');
  assert.match(doc, /<w:rPr><w:b w:val="0"\/><\/w:rPr><w:t xml:space="preserve"> and plain<\/w:t>/);
  // A single-run heading has nothing to opt out of, so it stays bare.
  assert.match(doc, /Heading1"\/><\/w:pPr><w:r><w:t xml:space="preserve">Round Trip/);
});

test('numbering.xml holds exactly two abstractNums of nine levels each', () => {
  const { parts } = roundTrip(DOC);
  const num = text(parts, 'word/numbering.xml');
  assert.equal((num.match(/<w:abstractNum /g) ?? []).length, 2);
  assert.equal((num.match(/<w:lvl w:ilvl="/g) ?? []).length, 18);
  assert.equal((num.match(/<w:numFmt w:val="bullet"\/>/g) ?? []).length, 9);
  assert.equal((num.match(/<w:numFmt w:val="decimal"\/>/g) ?? []).length, 9);
  // numId 1 is the bullet list, numId 2 the decimal one.
  assert.match(num, /<w:num w:numId="1"><w:abstractNumId w:val="0"\/><\/w:num>/);
  assert.match(num, /<w:num w:numId="2"><w:abstractNumId w:val="1"\/><\/w:num>/);
});

test('the table writes gridSpan, a vMerge restart and its continuation cell', () => {
  const { parts } = roundTrip(DOC);
  const doc = text(parts, 'word/document.xml');
  assert.match(doc, /<w:trPr><w:tblHeader\/><\/w:trPr>/);
  assert.match(doc, /<w:gridSpan w:val="2"\/>/);
  assert.match(doc, /<w:vMerge w:val="restart"\/>/);
  assert.match(doc, /<w:tcPr><w:vMerge\/><\/w:tcPr><w:p\/>/);
  // Three grid columns: the header's 2-wide cell plus one.
  assert.equal((doc.match(/<w:gridCol /g) ?? []).length, 3);
  // Header emphasis is a paragraph STYLE, so the read-back header text carries no `strong`.
  assert.match(doc, /<w:pStyle w:val="TableHeader"\/>/);
  assert.match(text(parts, 'word/styles.xml'), /w:styleId="TableHeader"/);
});

test('the image is an inline drawing at natural size, capped to the printable width', () => {
  const { parts } = roundTrip(DOC);
  const doc = text(parts, 'word/document.xml');
  // 320x240 px at 96dpi: 9525 EMU per px, well inside the 6.5in text column.
  assert.match(doc, /<wp:extent cx="3048000" cy="2286000"\/>/);
  assert.match(doc, /descr="A green lolly"/);
  assert.match(doc, /<a:blip r:embed="rId\d+"\/>/);
  // The r: and wp: prefixes only exist on the root because this document uses them.
  assert.match(doc, /<w:document [^>]*xmlns:r="[^"]+"[^>]*xmlns:wp="[^"]+">/);
  assert.deepEqual(parts['word/media/image1.png'], PNG);

  // A picture wider than the text column scales down, never up.
  const wide = new Uint8Array(PNG);
  wide.set([0, 0, 0x0f, 0xa0], 16); // width 4000
  const doc2 = text(
    unzip(
      writeDocx({
        blocks: [{ type: 'image', ref: 'media/1.png', alt: 'wide' }],
        media: [{ name: 'media/1.png', bytes: wide }],
      }),
    ).parts,
    'word/document.xml',
  );
  const cx = Number(/<wp:extent cx="(\d+)"/.exec(doc2)?.[1]);
  assert.ok(cx > 0 && cx <= 6.5 * 914400, `expected a capped width, got ${cx}`);
});

test('footnote bodies live in footnotes.xml behind the two separator pseudo-notes', () => {
  const { parts } = roundTrip(DOC);
  const notes = text(parts, 'word/footnotes.xml');
  assert.match(notes, /w:type="separator" w:id="-1"/);
  assert.match(notes, /w:type="continuationSeparator" w:id="0"/);
  assert.match(notes, /<w:footnote w:id="1"><w:p><w:r><w:footnoteRef\/><\/w:r>/);
  assert.match(notes, /The note body\./);
  // The reference sits in the flow, the body does not.
  assert.match(text(parts, 'word/document.xml'), /<w:footnoteReference w:id="1"\/>/);
});

test('an in-document link becomes a w:anchor, not a relationship', () => {
  const { parts, blocks } = roundTrip({
    blocks: [
      { type: 'para', inlines: [{ type: 'link', href: '#intro', inlines: [{ type: 'text', text: 'Intro' }] }] },
    ],
  });
  assert.match(text(parts, 'word/document.xml'), /<w:hyperlink w:anchor="intro">/);
  assert.equal((text(parts, 'word/_rels/document.xml.rels').match(/hyperlink/g) ?? []).length, 0);
  assert.deepEqual(blocks, [
    { type: 'para', inlines: [{ type: 'link', href: '#intro', inlines: [{ type: 'text', text: 'Intro' }] }] },
  ]);
});

// ─── the compatibility guards ────────────────────────────────────────────────

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const SECT_PR =
  '<w:sectPr>' +
  '<w:pgSz w:w="12240" w:h="15840"/>' +
  '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>' +
  '</w:sectPr>';

/** What the pre-doc-model writer emitted for this input, character for character. */
const LEGACY_DOCUMENT_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  `<w:document xmlns:w="${W_NS}"><w:body>` +
  '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t xml:space="preserve">Chapter One</w:t></w:r></w:p>' +
  '<w:p><w:r><w:t xml:space="preserve">Hello, editable world.</w:t></w:r></w:p>' +
  SECT_PR +
  '</w:body></w:document>';

test('the pre-doc-model block list still emits the same parts and document.xml', () => {
  const { parts, names } = unzip(
    writeDocx({
      title: 'My Doc',
      blocks: [
        { type: 'heading', level: 1, text: 'Chapter One' },
        { type: 'paragraph', text: 'Hello, editable world.' },
      ],
    }),
  );
  // Part list: the original five plus docProps/core.xml + app.xml, which every
  // document now carries (plans/144 Wave 2 G3 - see docx.test.ts for their content).
  assert.deepEqual(names, [
    '[Content_Types].xml',
    '_rels/.rels',
    'docProps/core.xml',
    'docProps/app.xml',
    'word/document.xml',
    'word/styles.xml',
    'word/_rels/document.xml.rels',
  ]);
  assert.equal(text(parts, 'word/document.xml'), LEGACY_DOCUMENT_XML);
  // No hyperlink, image, numbering or footnote relationship joins styles.xml.
  assert.equal((text(parts, 'word/_rels/document.xml.rels').match(/<Relationship /g) ?? []).length, 1);
  // The conditional styles stay out of styles.xml when nothing references them.
  const styles = text(parts, 'word/styles.xml');
  for (const id of ['Quote', 'TableHeader', 'Code']) {
    assert.doesNotMatch(styles, new RegExp(`w:styleId="${id}"`));
  }
});

test('a document with no list emits no numbering.xml', () => {
  const { names, parts } = unzip(
    writeDocx({ blocks: [{ type: 'para', inlines: [{ type: 'text', text: 'no lists here' }] }] }),
  );
  assert.ok(!names.includes('word/numbering.xml'));
  assert.doesNotMatch(text(parts, '[Content_Types].xml'), /numbering/);
  assert.doesNotMatch(text(parts, 'word/_rels/document.xml.rels'), /numbering/);
});

test('the two block shapes mix in one document', () => {
  const { blocks } = roundTrip({
    blocks: [
      { type: 'heading', level: 1, text: 'Legacy heading' },
      { type: 'para', inlines: [{ type: 'strong', inlines: [{ type: 'text', text: 'model para' }] }] },
      { type: 'paragraph', text: 'legacy para' },
    ],
  });
  assert.deepEqual(blocks, [
    { type: 'heading', level: 1, inlines: [{ type: 'text', text: 'Legacy heading' }] },
    { type: 'para', inlines: [{ type: 'strong', inlines: [{ type: 'text', text: 'model para' }] }] },
    { type: 'para', inlines: [{ type: 'text', text: 'legacy para' }] },
  ]);
});
