// SPDX-License-Identifier: MPL-2.0
/**
 * doc-blocks - DOM → heading/paragraph block model, and an integration check that
 * the model feeds the real engine writers into an editable .docx (w:t runs carry
 * the text, headings map to Heading styles). Mirrors pptx-deck.test.ts's shape.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { domToDocBlocks, domToRichDoc } from './doc-blocks.ts';
import { writeDocx } from '../../../../engine/src/docx.ts';
import { writeOdt } from '../../../../engine/src/odt.ts';
import { readZip } from '../../../../engine/src/zip.ts';

const DOC = `<div class="doc">
  <div class="doc-page"><div class="doc-body">
    <h1 class="doc-h doc-h1">Chapter One</h1>
    <p class="doc-p">Hello <strong>editable</strong> world.</p>
    <p class="doc-p"><br></p>
    <ul class="doc-ul"><li>first</li><li>second</li></ul>
  </div><div class="doc-footer"><span class="doc-footer-title">My Doc</span><span class="doc-footer-page">1</span></div></div>
  <div class="doc-page"><div class="doc-body">
    <h2 class="doc-h doc-h2">Chapter Two</h2>
  </div></div>
</div>`;

function blocks() {
  const dom = new JSDOM(DOC);
  return domToDocBlocks(dom.window.document.querySelector('.doc')!);
}

test('domToDocBlocks: ordered across pages, footer excluded, empties dropped, marks flattened', () => {
  const { title, blocks: b } = blocks();
  assert.equal(title, 'Chapter One', 'title seeds from the first heading');
  assert.deepEqual(b, [
    { type: 'heading', level: 1, text: 'Chapter One' },
    { type: 'paragraph', text: 'Hello editable world.' }, // inline <strong> flattened to text
    { type: 'paragraph', text: 'first' },                  // list items → paragraphs
    { type: 'paragraph', text: 'second' },
    { type: 'heading', level: 2, text: 'Chapter Two' },    // second page kept in order
  ]);
  // The running-footer title must NOT leak in as a block.
  assert.ok(!b.some((x) => x.text === 'My Doc'), 'footer chrome excluded');
});

test('the block model produces a real editable .docx (heading style + w:t text)', () => {
  const bytes = writeDocx(blocks());
  const doc = readZip(bytes).find((e) => e.name === 'word/document.xml')!;
  const xml = new TextDecoder().decode(doc.bytes);
  assert.match(xml, /Chapter One/, 'heading text present');
  assert.match(xml, /w:pStyle w:val="Heading1"/, 'H1 maps to the Heading1 style');
  assert.match(xml, /Hello editable world\./, 'paragraph text present');
});

test('the block model produces a valid .odt (mimetype first, title in meta)', () => {
  const bytes = writeOdt(blocks());
  const entries = readZip(bytes);
  const content = new TextDecoder().decode(entries.find((e) => e.name === 'content.xml')!.bytes);
  assert.match(content, /Chapter One/, 'heading text present in content.xml');
  const meta = entries.find((e) => e.name === 'meta.xml');
  assert.ok(meta, 'a titled doc emits meta.xml');
  assert.match(new TextDecoder().decode(meta!.bytes), /<dc:title>Chapter One<\/dc:title>/);
});

// ── the rich projection (plans/139 WP5): what a .docx now carries ─────────────

// A 1x1 PNG - the smallest thing whose bytes writeDocx will accept as a picture.
const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const RICH = `<div class="doc">
  <div class="doc-page"><div class="doc-body">
    <h1 class="doc-h doc-h1">Rich <em>doc</em></h1>
    <p class="doc-p">Plain <strong>bold</strong> <em>ital</em> <u>under</u> <s>gone</s> <code class="doc-code">x=1</code> and <a href="https://lolly.tools/">a link</a>.</p>
    <ul class="doc-ul">
      <li><div class="doc-li-p">top</div><ul class="doc-ul"><li><div class="doc-li-p">nested</div></li></ul></li>
      <li><div class="doc-li-p">second</div></li>
    </ul>
    <ol class="doc-ol"><li>one</li></ol>
    <blockquote class="doc-quote"><p>quoted</p></blockquote>
    <pre class="doc-pre"><code>line one
line two</code></pre>
    <table><thead><tr><th>A</th><th>B</th></tr></thead>
      <tbody><tr><td colspan="2">wide</td></tr><tr><td>c</td><td>d</td></tr></tbody></table>
    <div class="doc-table doc-tb-grid" style="grid-template-columns:repeat(2,1fr)">
      <div class="doc-cell doc-cell-head">H1</div><div class="doc-cell doc-cell-head">H2</div>
      <div class="doc-cell">r1</div><div class="doc-cell">r2</div>
    </div>
    <figure class="doc-fig"><img src="${PNG_1PX}" alt="a dot"></figure>
    <hr class="doc-hr">
  </div></div>
</div>`;

const richDoc = (): ReturnType<typeof domToRichDoc> =>
  domToRichDoc(new JSDOM(RICH).window.document.querySelector('.doc')!);

test('domToRichDoc: headings, styled runs and a link survive as nested inlines', async () => {
  const { title, blocks } = await richDoc();
  assert.equal(title, 'Rich doc', 'the title flattens the heading’s inline runs');
  assert.deepEqual(blocks[0], {
    type: 'heading', level: 1,
    inlines: [{ type: 'text', text: 'Rich ' }, { type: 'em', inlines: [{ type: 'text', text: 'doc' }] }],
  });
  const para = blocks[1] as { type: string; inlines: Array<Record<string, unknown>> };
  assert.equal(para.type, 'para');
  assert.deepEqual(para.inlines.map((i) => i.type),
    ['text', 'strong', 'text', 'em', 'text', 'underline', 'text', 'strike', 'text', 'code', 'text', 'link', 'text']);
  assert.deepEqual(para.inlines.find((i) => i.type === 'link'),
    { type: 'link', href: 'https://lolly.tools/', inlines: [{ type: 'text', text: 'a link' }] });
});

test('domToRichDoc: a nested list keeps its levels, an ordered list its flag', async () => {
  const { blocks } = await richDoc();
  assert.deepEqual(blocks.find((b) => b.type === 'list' && !b.ordered), {
    type: 'list', ordered: false,
    items: [
      { level: 0, inlines: [{ type: 'text', text: 'top' }] },
      { level: 1, inlines: [{ type: 'text', text: 'nested' }] },
      { level: 0, inlines: [{ type: 'text', text: 'second' }] },
    ],
  });
  assert.deepEqual(blocks.find((b) => b.type === 'list' && b.ordered), {
    type: 'list', ordered: true, items: [{ level: 0, inlines: [{ type: 'text', text: 'one' }] }],
  });
});

test('domToRichDoc: quote, code block, spanned table and doc-studio’s grid table', async () => {
  const { blocks } = await richDoc();
  assert.deepEqual(blocks.find((b) => b.type === 'quote'),
    { type: 'quote', inlines: [{ type: 'text', text: 'quoted' }] });
  assert.deepEqual(blocks.find((b) => b.type === 'code'), { type: 'code', text: 'line one\nline two' });

  const tables = blocks.filter((b) => b.type === 'table');
  assert.equal(tables.length, 2, 'a <table> and the .doc-table grid both land');
  const [html, grid] = tables;
  assert.deepEqual(html!.header?.map((c) => c.inlines), [[{ type: 'text', text: 'A' }], [{ type: 'text', text: 'B' }]]);
  assert.equal(html!.rows[0]![0]!.colspan, 2, 'colspan is carried, not flattened');
  assert.equal(html!.htmlSpans, true, 'a merged cell flags that a pipe table cannot express this');
  assert.equal(html!.rows.length, 2);
  assert.deepEqual(grid!.header?.map((c) => c.inlines), [[{ type: 'text', text: 'H1' }], [{ type: 'text', text: 'H2' }]]);
  assert.deepEqual(grid!.rows, [[{ inlines: [{ type: 'text', text: 'r1' }] }, { inlines: [{ type: 'text', text: 'r2' }] }]]);
});

test('domToRichDoc: a data-URL image becomes an image block plus its bytes', async () => {
  const { blocks, media } = await richDoc();
  const img = blocks.find((b) => b.type === 'image') as { ref: string; alt: string };
  assert.equal(img.alt, 'a dot');
  assert.match(img.ref, /\.png$/, 'the media name carries the extension writeDocx keys the part on');
  assert.equal(media.length, 1);
  assert.equal(media[0]!.name, img.ref, 'the block’s ref names the media entry');
  assert.deepEqual([...media[0]!.bytes.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], 'PNG magic, decoded from the data URL');
});

test('the rich model reaches Word: list numbering, a table, a hyperlink and a picture part', async () => {
  const { title, blocks, media } = await richDoc();
  const bytes = writeDocx({ title, blocks, media });
  const entries = readZip(bytes);
  const xml = new TextDecoder().decode(entries.find((e) => e.name === 'word/document.xml')!.bytes);
  assert.match(xml, /<w:numPr>/, 'list items reference a numbering definition');
  assert.match(xml, /<w:tbl>/, 'the table is a real w:tbl');
  assert.match(xml, /w:gridSpan w:val="2"/, 'the merged cell spans two grid columns');
  assert.match(xml, /<w:hyperlink/, 'the link is a hyperlink, not plain text');
  assert.match(xml, /<w:drawing>/, 'the picture is an inline drawing');
  assert.ok(entries.some((e) => e.name === 'word/numbering.xml'), 'numbering part emitted');
  assert.ok(entries.some((e) => /^word\/media\/image1\.png$/.test(e.name)), 'the image bytes ship as a part');
});

test('the flat projection still feeds writeOdt: rich blocks lower to paragraphs', () => {
  const { title, blocks } = domToDocBlocks(new JSDOM(RICH).window.document.querySelector('.doc')!);
  assert.equal(title, 'Rich doc');
  const texts = blocks.map((b) => b.text);
  assert.ok(texts.includes('top') && texts.includes('nested'), 'every list item is its own paragraph');
  assert.ok(texts.includes('A B'), 'a table row flattens to one paragraph of its cells');
  assert.ok(!texts.some((t) => t.includes('data:image')), 'an image contributes no text');
  assert.ok(writeOdt({ title, blocks }).length > 0);
});
