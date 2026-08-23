// SPDX-License-Identifier: MPL-2.0
/**
 * doc-quality.test.ts - the deterministic half of plan 139's quality harness
 * (WP6). "Did a serialiser start dropping content" becomes a number that CI can
 * fail on, with no LibreOffice, no network and no corpus on disk.
 *
 * TWO METRICS, adopted from anydoc's bench method:
 *   1. STRUCTURE COUNTS - headings, list items, table cells, links, images and
 *      footnote markers counted in the EMITTED markdown, asserted as exact
 *      values. An exact assertion is what turns a dropped block type into a
 *      failure; a `>= 0` bound would pass an empty string.
 *   2. WORD-TRIGRAM CONTAINMENT - every source text unit (one pptx paragraph,
 *      one `w:t` run, one block's inlines) reduces to lowercase word trigrams,
 *      and at least 98% of them must appear in the markdown. Counts cannot see a
 *      paragraph whose words were mangled; trigrams cannot see a missing table.
 *      The pair is the point.
 *
 * Source text is read from the FIXTURE, never from the module under test, so
 * neither metric can pass by agreeing with a broken reader. The exception is
 * stated where it applies: a docx fixture's source is its own `w:t` elements,
 * which is authored input, not reader output.
 *
 * Fixtures are authored here in full - a pptx read-model literal, a hand-written
 * WordprocessingML part map (the style tests/docx-read.test.ts uses), and a
 * DocBlock literal. Nothing is read from disk and nothing is committed.
 *
 * tests/doc-md.test.ts pins the serialisers' CONVENTIONS (what a span emits, how
 * a URL is filtered). This file pins how much CONTENT survives them, which is a
 * different failure and needs a different assertion.
 *
 * The soffice side-by-side render is scripts/doc-quality-bench.ts: it needs a
 * binary and a private corpus, so it stays manual and out of CI.
 *
 * Run with: node --test tests/doc-quality.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom'; // typed by tests/jsdom.d.ts (no @types/jsdom exists)

import { deckToMarkdown } from '../engine/src/deck-md.ts';
import type { PptxDeckRead, PptxTextNode, PptxTableNode } from '../engine/src/pptx-read.ts';
import { readDocx } from '../engine/src/docx-read.ts';
import type { DocxParts } from '../engine/src/docx-read.ts';
import { mdFromBlocks } from '../engine/src/doc-md.ts';
import type { DocBlock, DocInline } from '../engine/src/doc-model.ts';

// ─── metric 1: structure counts over the emitted markdown ────────────────────

interface Structure {
  headings: number;
  listItems: number;
  tableCells: number;
  links: number;
  images: number;
  /** Both `[^1]` references and `[^1]: text` definitions - a lost note moves it. */
  footnotes: number;
}

/** A pipe-table alignment row carries no content, so it is not a row of cells. */
const isDelimiterRow = (line: string): boolean => /^\|[\s:|-]*\|$/.test(line);

/** Cells split on an UNESCAPED pipe: `\|` is one cell's content, not a boundary. */
const cellsIn = (line: string): number => line.trim().slice(1, -1).split(/(?<!\\)\|/).length;

function countStructure(md: string): Structure {
  const out: Structure = { headings: 0, listItems: 0, tableCells: 0, links: 0, images: 0, footnotes: 0 };
  for (const line of md.split('\n')) {
    const t = line.trim();
    if (/^#{1,6}\s/.test(t)) out.headings++;
    else if (/^(?:[-*+]|\d+[.)])\s/.test(t)) out.listItems++;
    else if (t.startsWith('|') && t.endsWith('|') && !isDelimiterRow(t)) out.tableCells += cellsIn(t);
  }
  // A link is a bracket pair with a destination that is neither an image (`!`
  // before it) nor a footnote marker (`^` after it).
  out.links = (md.match(/(?<![!\\])\[(?!\^)[^\]]*\]\([^)]*\)/g) ?? []).length;
  out.images = (md.match(/!\[[^\]]*\]\([^)]*\)/g) ?? []).length;
  out.footnotes = (md.match(/\[\^[^\]\s]+\]/g) ?? []).length;
  return out;
}

// ─── metric 2: word-trigram containment ──────────────────────────────────────

/** Lowercase, drop everything that is not a letter or digit, split on space.
 *  Markup the serialisers add (`**`, `\|`, `- `, `[]()`) vanishes here, so a
 *  trigram compares CONTENT and never formatting. */
const words = (s: string): string[] =>
  s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ').filter(Boolean);

/** Every window of three consecutive words. A source under three words yields
 *  none and is therefore exempt, which is why short cells never inflate a score. */
function trigrams(s: string): string[] {
  const w = words(s);
  const out: string[] = [];
  for (let i = 0; i + 2 < w.length; i++) out.push(`${w[i]} ${w[i + 1]} ${w[i + 2]}`);
  return out;
}

/** A markdown destination is markup, not prose, so `[label](url)` compares as
 *  `label`. Without this a link's URL sits between the words on either side of
 *  it and breaks two otherwise intact trigrams. A link that went MISSING is
 *  caught by the structure count, which is the metric that owns that question. */
const stripDestinations = (md: string): string => md.replace(/\]\([^)]*\)/g, ']');

interface Containment {
  score: number;
  total: number;
  missing: string[];
}

/**
 * Fraction of the sources' trigrams present in the emitted text. Sources are
 * scored SEPARATELY and pooled, so a trigram is never satisfied by two adjacent
 * paragraphs happening to run together.
 */
function containment(sources: string[], emitted: string): Containment {
  const have = new Set(trigrams(stripDestinations(emitted)));
  const missing: string[] = [];
  let total = 0;
  let hit = 0;
  for (const src of sources) {
    for (const t of trigrams(src)) {
      total++;
      if (have.has(t)) hit++;
      else missing.push(t);
    }
  }
  return { score: total ? hit / total : 1, total, missing };
}

const MIN_CONTAINMENT = 0.98;

function assertContainment(name: string, sources: string[], md: string, minTrigrams: number): void {
  const c = containment(sources, md);
  assert.ok(
    c.total >= minTrigrams,
    `${name}: the fixture yields only ${c.total} trigrams, too few to measure anything`,
  );
  assert.ok(
    c.score >= MIN_CONTAINMENT,
    `${name}: containment ${c.score.toFixed(4)} < ${MIN_CONTAINMENT} ` +
      `(${c.missing.length}/${c.total} missing, first: ${c.missing.slice(0, 5).join(' / ')})`,
  );
}

// ─── fixture A: a pptx read-model ────────────────────────────────────────────
// Four slides: a title pair, two-level bullets with a bold run and a picture, a
// three-column table, and a closing list. Slide one also carries a footer
// placeholder, which is furniture the branded writers regenerate.

const DECK: PptxDeckRead = {
  widthEmu: 12_192_000,
  heightEmu: 6_858_000,
  theme: { colors: {} },
  slides: [
    {
      index: 0,
      notes: 'Open with the promise that nothing is silently dropped.',
      nodes: [
        {
          type: 'text', xEmu: 600_000, yEmu: 1_000_000, cxEmu: 8_000_000, cyEmu: 1_200_000,
          ph: { type: 'ctrTitle' },
          paras: [{ runs: [{ text: 'Rebrand the whole quarter deck' }] }],
        },
        {
          type: 'text', xEmu: 600_000, yEmu: 2_400_000, cxEmu: 8_000_000, cyEmu: 900_000,
          ph: { type: 'subTitle', idx: 1 },
          paras: [{ runs: [{ text: 'One measured round trip from PowerPoint to markdown' }] }],
        },
        {
          type: 'text', xEmu: 600_000, yEmu: 6_200_000, cxEmu: 3_000_000, cyEmu: 300_000,
          ph: { type: 'ftr', idx: 11 },
          paras: [{ runs: [{ text: 'Confidential draft 2026' }] }],
        },
      ],
    },
    {
      index: 1,
      notes: 'Mention that media is handed over as a manifest of part paths.',
      nodes: [
        {
          type: 'text', xEmu: 400_000, yEmu: 300_000, cxEmu: 8_000_000, cyEmu: 700_000,
          ph: { type: 'title' },
          paras: [{ runs: [{ text: 'What the reader keeps' }] }],
        },
        {
          type: 'text', xEmu: 400_000, yEmu: 1_200_000, cxEmu: 5_000_000, cyEmu: 3_000_000,
          ph: { type: 'body', idx: 1 },
          paras: [
            { runs: [{ text: 'The positioned read model keeps every text box' }] },
            {
              lvl: 1,
              runs: [
                { text: 'Outline levels survive as ' },
                { text: 'two spaces', bold: true },
                { text: ' of indent' },
              ],
            },
            { runs: [{ text: 'Speaker notes ride along in a trailing comment' }] },
          ],
        },
        {
          type: 'pic', xEmu: 6_000_000, yEmu: 1_200_000, cxEmu: 3_000_000, cyEmu: 2_000_000,
          embed: 'rId4', media: 'ppt/media/image3.png',
        },
      ],
    },
    {
      index: 2,
      nodes: [
        {
          type: 'text', xEmu: 400_000, yEmu: 300_000, cxEmu: 8_000_000, cyEmu: 700_000,
          ph: { type: 'title' },
          paras: [{ runs: [{ text: 'Where the numbers land' }] }],
        },
        {
          type: 'table', xEmu: 400_000, yEmu: 1_500_000, cxEmu: 8_000_000, cyEmu: 2_000_000,
          rows: [
            ['Metric', 'Before the harness', 'After the harness'],
            ['Median render time in seconds', '4.2', '1.8'],
            ['Dropped table cells | per deck', '17', '0'],
          ],
        },
      ],
    },
    {
      index: 3,
      notes: 'Close on the next two work packages.',
      nodes: [
        {
          type: 'text', xEmu: 400_000, yEmu: 300_000, cxEmu: 8_000_000, cyEmu: 700_000,
          ph: { type: 'title' },
          paras: [{ runs: [{ text: 'What we do next' }] }],
        },
        {
          type: 'text', xEmu: 400_000, yEmu: 1_200_000, cxEmu: 8_000_000, cyEmu: 2_000_000,
          ph: { type: 'body', idx: 1 },
          paras: [
            { runs: [{ text: 'Wire the extraction into the convert view' }] },
            { runs: [{ text: 'Teach the document studio to import a Word file' }] },
          ],
        },
      ],
    },
  ],
};

/** The footer placeholder is furniture: excluded from the sources below and
 *  asserted absent, because a serialiser that starts emitting it is a defect
 *  containment would otherwise reward. */
const DECK_FURNITURE = 'Confidential draft 2026';

/** Source units straight off the fixture literal: one per pptx paragraph, one
 *  per table cell, one per note. `deckToMarkdown` is never consulted. */
function deckSources(deck: PptxDeckRead): string[] {
  const out: string[] = [];
  for (const slide of deck.slides) {
    for (const node of slide.nodes) {
      if (node.type === 'text') {
        if ((node as PptxTextNode).ph?.type === 'ftr') continue;
        for (const para of (node as PptxTextNode).paras ?? []) {
          out.push((para.runs ?? []).map((r) => r.text ?? '').join(''));
        }
      } else if (node.type === 'table') {
        for (const row of (node as PptxTableNode).rows ?? []) out.push(...row);
      }
    }
    if (slide.notes) out.push(slide.notes);
  }
  return out;
}

// ─── fixture B: a hand-written .docx part map ────────────────────────────────

const win = new JSDOM('').window;
const domParser = new win.DOMParser();
const parseXml = (xml: string): Document =>
  domParser.parseFromString(xml, 'application/xml') as unknown as Document;

const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/** Alt text lives in an attribute, so it is listed rather than scraped. */
const DOCX_IMAGE_ALT = 'The lolly mascot waving beside a stack of documents';

const DOCX_BODY =
  `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Quarterly platform report</w:t></w:r></w:p>` +
  `<w:p><w:r><w:t>This report explains how the extraction path preserves the structure of a document.</w:t></w:r></w:p>` +
  `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Findings from the corpus</w:t></w:r></w:p>` +
  `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>` +
  `<w:r><w:t>Headings resolve through the style table</w:t></w:r></w:p>` +
  `<w:p><w:pPr><w:numPr><w:ilvl w:val="1"/><w:numId w:val="1"/></w:numPr></w:pPr>` +
  `<w:r><w:t>Even when a custom style is based on another style</w:t></w:r></w:p>` +
  `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>` +
  `<w:r><w:t>Consecutive numbered paragraphs merge into a single list</w:t></w:r></w:p>` +
  `<w:p><w:r><w:t xml:space="preserve">Read more on </w:t></w:r>` +
  `<w:hyperlink r:id="rId4"><w:r><w:t>the openSUSE project page</w:t></w:r></w:hyperlink></w:p>` +
  `<w:p><w:r><w:t>Throughput doubled in the second half of the year</w:t></w:r>` +
  `<w:r><w:footnoteReference w:id="2"/></w:r></w:p>` +
  `<w:p><w:r><w:drawing><wp:inline>` +
  `<wp:docPr id="1" name="Picture 1" descr="${DOCX_IMAGE_ALT}"/>` +
  `<a:graphic><a:graphicData><a:blip r:embed="rId5"/></a:graphicData></a:graphic>` +
  `</wp:inline></w:drawing></w:r></w:p>` +
  `<w:tbl>` +
  `<w:tr><w:trPr><w:tblHeader/></w:trPr>` +
  `<w:tc><w:p><w:r><w:t>Document type</w:t></w:r></w:p></w:tc>` +
  `<w:tc><w:p><w:r><w:t>Blocks recovered</w:t></w:r></w:p></w:tc>` +
  `<w:tc><w:p><w:r><w:t>What the reader noticed</w:t></w:r></w:p></w:tc>` +
  `</w:tr>` +
  `<w:tr>` +
  `<w:tc><w:p><w:r><w:t>Word document</w:t></w:r></w:p></w:tc>` +
  `<w:tc><w:p><w:r><w:t>142</w:t></w:r></w:p></w:tc>` +
  `<w:tc><w:p><w:r><w:t>Lists and tables came through intact</w:t></w:r></w:p></w:tc>` +
  `</w:tr>` +
  `<w:tr>` +
  `<w:tc><w:p><w:r><w:t>Presentation</w:t></w:r></w:p></w:tc>` +
  `<w:tc><w:p><w:r><w:t>88</w:t></w:r></w:p></w:tc>` +
  `<w:tc><w:p><w:r><w:t>Speaker notes were carried over as comments</w:t></w:r></w:p></w:tc>` +
  `</w:tr>` +
  `</w:tbl>`;

const DOCX_DOCUMENT =
  `${XML_DECL}<w:document xmlns:w="${NS_W}" xmlns:r="${NS_R}" xmlns:a="${NS_A}" xmlns:wp="${NS_WP}">` +
  `<w:body>${DOCX_BODY}</w:body></w:document>`;

const DOCX_STYLES = `${XML_DECL}<w:styles xmlns:w="${NS_W}">` +
  `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>` +
  `<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/>` +
  `<w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style>` +
  `<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/>` +
  `<w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr></w:style>` +
  `</w:styles>`;

const DOCX_NUMBERING = `${XML_DECL}<w:numbering xmlns:w="${NS_W}">` +
  `<w:abstractNum w:abstractNumId="0">` +
  `<w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl>` +
  `<w:lvl w:ilvl="1"><w:numFmt w:val="bullet"/></w:lvl>` +
  `</w:abstractNum>` +
  `<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>` +
  `</w:numbering>`;

const DOCX_RELS = `${XML_DECL}<Relationships xmlns="${NS_PKG_REL}">` +
  `<Relationship Id="rId1" Type="${NS_R}/styles" Target="styles.xml"/>` +
  `<Relationship Id="rId2" Type="${NS_R}/numbering" Target="numbering.xml"/>` +
  `<Relationship Id="rId3" Type="${NS_R}/footnotes" Target="footnotes.xml"/>` +
  `<Relationship Id="rId4" Type="${NS_R}/hyperlink" Target="https://www.opensuse.org/" TargetMode="External"/>` +
  `<Relationship Id="rId5" Type="${NS_R}/image" Target="media/image1.png"/>` +
  `</Relationships>`;

const DOCX_FOOTNOTES = `${XML_DECL}<w:footnotes xmlns:w="${NS_W}">` +
  `<w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote>` +
  `<w:footnote w:id="2"><w:p><w:r>` +
  `<w:t>Measured across the same corpus of documents as the previous quarter.</w:t>` +
  `</w:r></w:p></w:footnote>` +
  `</w:footnotes>`;

const DOCX_PARTS: DocxParts = {
  '[Content_Types].xml': `${XML_DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`,
  'word/document.xml': DOCX_DOCUMENT,
  'word/_rels/document.xml.rels': DOCX_RELS,
  'word/styles.xml': DOCX_STYLES,
  'word/numbering.xml': DOCX_NUMBERING,
  'word/footnotes.xml': DOCX_FOOTNOTES,
  'word/media/image1.png': Uint8Array.of(0x89, 0x50, 0x4e, 0x47),
};

/** Source units straight off the fixture XML: one per `w:t`. This is authored
 *  input, not reader output, so the metric stays independent of `readDocx`.
 *  The fixture is deliberately entity-free, so no unescaping is needed. */
const wtRuns = (xml: string): string[] =>
  [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1] ?? '');

// ─── fixture C: a DocBlock literal ───────────────────────────────────────────

const BLOCKS: DocBlock[] = [
  { type: 'heading', level: 1, inlines: [{ type: 'text', text: 'The block model in one page' }] },
  {
    type: 'para',
    inlines: [
      { type: 'text', text: 'Every reader targets ' },
      { type: 'strong', inlines: [{ type: 'text', text: 'the same block shape' }] },
      { type: 'text', text: ', so exactly one serialiser decides how a document is written.' },
      { type: 'footnoteRef', id: '1' },
    ],
  },
  {
    type: 'list',
    ordered: false,
    items: [
      { level: 0, inlines: [{ type: 'text', text: 'Blocks are flat and kept in reading order' }] },
      { level: 1, inlines: [{ type: 'text', text: 'Inlines nest to express combined emphasis' }] },
      { level: 0, inlines: [{ type: 'text', text: 'A table cell holds inlines and nothing else' }] },
    ],
  },
  {
    type: 'list',
    ordered: true,
    items: [
      { level: 0, inlines: [{ type: 'text', text: 'Read the source document into blocks' }] },
      { level: 0, inlines: [{ type: 'text', text: 'Serialise those blocks back out to markdown' }] },
    ],
  },
  { type: 'quote', inlines: [{ type: 'text', text: 'Meaning first, geometry never.' }] },
  { type: 'code', lang: 'ts', text: 'const markdown = mdFromBlocks(blocks);' },
  {
    type: 'table',
    header: [
      { inlines: [{ type: 'text', text: 'Stage' }] },
      { inlines: [{ type: 'text', text: 'What that stage owns' }] },
    ],
    rows: [
      [
        { inlines: [{ type: 'text', text: 'Reader' }] },
        { inlines: [{ type: 'text', text: 'Deciding what the source document means' }] },
      ],
      [
        { inlines: [{ type: 'text', text: 'Serialiser' }] },
        { inlines: [{ type: 'text', text: 'Deciding how that meaning gets written down' }] },
      ],
    ],
  },
  {
    type: 'para',
    inlines: [
      { type: 'text', text: 'See ' },
      {
        type: 'link',
        href: 'https://example.org/dialect',
        inlines: [{ type: 'text', text: 'the pinned dialect notes' }],
      },
      { type: 'text', text: ' before changing any of these conventions.' },
    ],
  },
  { type: 'image', ref: 'media/2.png', alt: 'A diagram of the block pipeline end to end' },
  {
    type: 'footnote',
    id: '1',
    inlines: [{ type: 'text', text: 'The escape-first discipline is documented in doc-md.ts itself.' }],
  },
];

/** Plain text of an inline tree: the content a serialiser must not lose. */
function plainInlines(nodes: DocInline[]): string {
  let out = '';
  for (const n of nodes) {
    if (n.type === 'text' || n.type === 'code') out += n.text;
    else if ('inlines' in n) out += plainInlines(n.inlines);
  }
  return out;
}

/** Source units straight off the block literal: one per block, one per list item,
 *  one per table cell. `mdFromBlocks` is never consulted. */
function blockSources(blocks: DocBlock[]): string[] {
  const out: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case 'heading':
      case 'para':
      case 'quote':
      case 'footnote':
        out.push(plainInlines(b.inlines));
        break;
      case 'list':
        for (const item of b.items) out.push(plainInlines(item.inlines));
        break;
      case 'table':
        for (const c of b.header ?? []) out.push(plainInlines(c.inlines));
        for (const row of b.rows) for (const c of row) out.push(plainInlines(c.inlines));
        break;
      case 'code':
        out.push(b.text);
        break;
      case 'image':
        out.push(b.alt);
        break;
    }
  }
  return out;
}

// ─── the harness's own contract ──────────────────────────────────────────────
// A metric that cannot fail measures nothing, so both are exercised against
// known-bad text before they are trusted on a fixture.

test('the structure counter distinguishes every markdown construct it counts', () => {
  const md = [
    '# Head',
    '',
    '- one',
    '  - two',
    '1. three',
    '',
    '| a | b |',
    '| --- | --- |',
    '| c \\| d | e |',
    '',
    'A [link](https://example.org) and an ![image](media/1.png) and a ref[^1].',
    '',
    '[^1]: note body',
  ].join('\n');
  assert.deepEqual(countStructure(md), {
    headings: 1,
    listItems: 3,
    tableCells: 4,
    links: 1,
    images: 1,
    footnotes: 2,
  });
  assert.deepEqual(countStructure(''), {
    headings: 0, listItems: 0, tableCells: 0, links: 0, images: 0, footnotes: 0,
  });
});

test('containment falls when words go missing and ignores markup and case', () => {
  const src = ['the quick brown fox jumps high'];
  assert.equal(containment(src, '**THE QUICK** brown *fox* jumps high').score, 1);
  // Four trigrams in; dropping the last word costs every window that held it.
  assert.equal(containment(src, 'the quick brown fox jumps').score, 0.75);
  // Dropping a MIDDLE word costs three windows, which is the whole point of a
  // trigram over a word count: position is part of the measurement.
  assert.equal(containment(src, 'the quick fox jumps high').score, 0.25);
  assert.equal(containment(src, '').score, 0);
  // A link destination sits between two words without separating them.
  assert.equal(containment(['see the notes before changing'], 'see [the notes](https://x.example/y) before changing').score, 1);
  // Under three words is exempt, so it contributes no trigrams either way.
  assert.equal(containment(['two words'], '').total, 0);
  // Sources are scored separately: adjacency across two of them is not a match.
  assert.equal(containment(['alpha beta', 'gamma delta'], 'alpha beta gamma delta').total, 0);
  assert.equal(containment(['alpha beta gamma'], 'alpha beta\n\ngamma').score, 1);
});

// ─── fixture A: pptx read-model to markdown ──────────────────────────────────

test('deckToMarkdown keeps every structure the deck fixture declares', () => {
  const { markdown, media } = deckToMarkdown(DECK);
  assert.deepEqual(countStructure(markdown), {
    headings: 4,      // one title per slide, `#` on the first and `##` after it
    listItems: 5,     // three body paragraphs on slide two, two on slide four
    tableCells: 9,    // three rows of three, the alignment row excluded
    links: 0,
    images: 1,        // the one picture node
    footnotes: 0,     // the deck dialect carries notes as comments, not footnotes
  });
  assert.deepEqual(media, [{ path: 'ppt/media/image3.png', name: 'media/1.png' }]);
  assert.equal((markdown.match(/<!-- notes: /g) ?? []).length, 3, 'a comment per slide that has notes');
  assert.ok(!markdown.includes(DECK_FURNITURE), 'a footer placeholder is furniture and must not serialise');
});

test('deckToMarkdown loses no words from the deck fixture', () => {
  const { markdown } = deckToMarkdown(DECK);
  assertContainment('deck', deckSources(DECK), markdown, 40);
});

// ─── fixture B: docx parts to markdown ───────────────────────────────────────

test('readDocx plus mdFromBlocks keeps every structure the docx fixture declares', () => {
  const { blocks, media, truncated } = readDocx(DOCX_PARTS, parseXml);
  assert.equal(truncated, false);
  assert.deepEqual(media, [{ path: 'word/media/image1.png', name: 'media/1.png' }]);
  assert.deepEqual(countStructure(mdFromBlocks(blocks)), {
    headings: 2,      // Heading1 and Heading2
    listItems: 3,     // one bullet run, its nested item included
    tableCells: 9,    // a header row and two body rows of three
    links: 1,         // the hyperlink resolved through document.xml.rels
    images: 1,        // the inline picture
    footnotes: 2,     // the reference plus its definition
  });
});

test('readDocx plus mdFromBlocks loses no words from the docx fixture', () => {
  const { blocks } = readDocx(DOCX_PARTS, parseXml);
  const sources = [...wtRuns(DOCX_DOCUMENT), ...wtRuns(DOCX_FOOTNOTES), DOCX_IMAGE_ALT];
  assertContainment('docx', sources, mdFromBlocks(blocks), 40);
});

// ─── fixture C: DocBlocks to markdown ────────────────────────────────────────

test('mdFromBlocks keeps every structure the block fixture declares', () => {
  assert.deepEqual(countStructure(mdFromBlocks(BLOCKS)), {
    headings: 1,
    listItems: 5,     // three unordered items and two ordered ones
    tableCells: 6,    // a header row and two body rows of two
    links: 1,
    images: 1,
    footnotes: 2,     // the reference in the opening paragraph plus its definition
  });
});

test('mdFromBlocks loses no words from the block fixture', () => {
  assertContainment('blocks', blockSources(BLOCKS), mdFromBlocks(BLOCKS), 40);
});
