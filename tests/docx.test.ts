// SPDX-License-Identifier: MPL-2.0
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { writeDocx } from '../engine/src/docx.ts';
import { readZip } from '../engine/src/zip.ts';

const decoder = new TextDecoder('utf-8');

/** Read one part's text out of a written .docx. */
function part(bytes: Uint8Array, name: string): string {
  const e = readZip(bytes).find((x) => x.name === name);
  assert.ok(e, `expected archive to contain "${name}"`);
  return decoder.decode(e!.bytes);
}

test('writeDocx produces a readable zip with the required OOXML parts', () => {
  const bytes = writeDocx({
    title: 'My Doc',
    blocks: [
      { type: 'heading', level: 1, text: 'Chapter One' },
      { type: 'paragraph', text: 'Hello, editable world.' },
    ],
  });
  assert.ok(bytes instanceof Uint8Array);

  const names = readZip(bytes).map((e) => e.name);
  for (const need of [
    '[Content_Types].xml',
    '_rels/.rels',
    'word/document.xml',
    'word/styles.xml',
    'word/_rels/document.xml.rels',
  ]) {
    assert.ok(names.includes(need), `missing part ${need}`);
  }
});

test('document.xml carries the heading + paragraph text as real w:t runs', () => {
  const bytes = writeDocx({
    blocks: [
      { type: 'heading', level: 2, text: 'A Heading Here' },
      { type: 'paragraph', text: 'A paragraph body.' },
    ],
  });
  const doc = part(bytes, 'word/document.xml');

  // Real editable text — the strings live inside w:t elements, not a picture blip.
  assert.match(doc, /<w:t xml:space="preserve">A Heading Here<\/w:t>/);
  assert.match(doc, /<w:t xml:space="preserve">A paragraph body\.<\/w:t>/);
  // Heading routes through a pStyle; the plain paragraph carries no pStyle.
  assert.match(doc, /<w:pStyle w:val="Heading2"\/>/);
  // Structural sanity: a body wrapping w:p, closed with a sectPr.
  assert.match(doc, /<w:document[^>]*><w:body>.*<w:sectPr>.*<\/w:sectPr><\/w:body><\/w:document>/s);
});

test('heading level clamps to 1..6 and defaults to 1', () => {
  const bytes = writeDocx({
    blocks: [
      { type: 'heading', level: 99, text: 'too deep' },
      { type: 'heading', level: 0, text: 'too shallow' },
      { type: 'heading', text: 'no level' },
    ],
  });
  const doc = part(bytes, 'word/document.xml');
  assert.match(doc, /Heading6"\/><\/w:pPr><w:r><w:t xml:space="preserve">too deep/);
  assert.match(doc, /Heading1"\/><\/w:pPr><w:r><w:t xml:space="preserve">too shallow/);
  assert.match(doc, /Heading1"\/><\/w:pPr><w:r><w:t xml:space="preserve">no level/);
});

test('XML metacharacters and illegal control chars are handled', () => {
  // A BEL control char (U+0007) is illegal in XML 1.0 and must be dropped, not escaped.
  const bytes = writeDocx({
    blocks: [{ type: 'paragraph', text: `a & b < c > "d"${String.fromCharCode(7)} tail` }],
  });
  const doc = part(bytes, 'word/document.xml');
  assert.match(doc, /a &amp; b &lt; c &gt; &quot;d&quot; tail/);
  // No raw metachar or control byte leaked into the text run.
  assert.doesNotMatch(doc, /d" tail/);
  assert.ok(!doc.includes(String.fromCharCode(7)));
});

test('styles.xml defines Normal + Heading1..6', () => {
  const styles = part(writeDocx({ blocks: [] }), 'word/styles.xml');
  assert.match(styles, /w:styleId="Normal"/);
  for (let i = 1; i <= 6; i++) assert.match(styles, new RegExp(`w:styleId="Heading${i}"`));
});

test('an empty document is still a valid one-paragraph docx', () => {
  const doc = part(writeDocx({ blocks: [] }), 'word/document.xml');
  assert.match(doc, /<w:body><w:p\/><w:sectPr>/);
});

test('relationships wire the package root to the document and the document to styles', () => {
  const bytes = writeDocx({ blocks: [{ type: 'paragraph', text: 'x' }] });
  const root = part(bytes, '_rels/.rels');
  const docRels = part(bytes, 'word/_rels/document.xml.rels');
  assert.match(root, /Target="word\/document\.xml"/);
  assert.match(root, /officeDocument"/);
  assert.match(docRels, /Target="styles\.xml"/);
});
