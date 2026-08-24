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

  // Real editable text - the strings live inside w:t elements, not a picture blip.
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

// ─── docProps (plans/144 Wave 2 G3) ──────────────────────────────────────────

test('every docx carries docProps/core.xml + app.xml with Lolly defaults', () => {
  const bytes = writeDocx({ title: 'My Doc', blocks: [{ type: 'paragraph', text: 'x' }] });
  const names = readZip(bytes).map((e) => e.name);
  assert.ok(names.includes('docProps/core.xml'));
  assert.ok(names.includes('docProps/app.xml'));
  const core = part(bytes, 'docProps/core.xml');
  assert.ok(core.includes('<dc:title>My Doc</dc:title>'), 'doc title becomes dc:title');
  assert.ok(core.includes('<dc:creator>Lolly</dc:creator>'), 'creator defaults to Lolly');
  assert.ok(core.includes('dcterms:created'), 'created timestamp present');
  assert.ok(part(bytes, 'docProps/app.xml').includes('<Application>Lolly</Application>'));
  // The package rels + content types must both name the parts, or Word ignores them.
  const rels = part(bytes, '_rels/.rels');
  assert.ok(rels.includes('package/2006/relationships/metadata/core-properties'), 'OPC package rel type');
  assert.ok(part(bytes, '[Content_Types].xml').includes('/docProps/core.xml'));
});

test('docx core props: meta.author becomes dc:creator, description joins in', () => {
  const bytes = writeDocx({
    title: 'Fallback',
    blocks: [],
    meta: { author: 'Ana Kovac', description: 'A memo', title: 'Meta Title' },
    now: '2026-08-24T00:00:00Z',
  });
  const core = part(bytes, 'docProps/core.xml');
  assert.ok(core.includes('<dc:creator>Ana Kovac</dc:creator>'));
  assert.ok(core.includes('<dc:title>Meta Title</dc:title>'), 'meta.title outranks doc.title');
  assert.ok(core.includes('<dc:description>A memo</dc:description>'));
  assert.ok(core.includes('2026-08-24T00:00:00Z'));
});

test('both authors when they differ: sourceAuthor + author share dc:creator (plans/144 G6)', () => {
  const both = part(writeDocx({
    blocks: [],
    meta: { author: 'Andy Fitzsimon', sourceAuthor: 'Ana Kovac' },
  }), 'docProps/core.xml');
  assert.ok(both.includes('<dc:creator>Ana Kovac; Andy Fitzsimon</dc:creator>'), 'source first, Word separator');
  assert.ok(both.includes('<cp:lastModifiedBy>Andy Fitzsimon</cp:lastModifiedBy>'), 'last modified stays the current actor');

  // Identical names (trimmed, case-insensitive) collapse to one.
  const same = part(writeDocx({
    blocks: [],
    meta: { author: 'Ana Kovac', sourceAuthor: ' ana kovac ' },
  }), 'docProps/core.xml');
  assert.ok(same.includes('<dc:creator>Ana Kovac</dc:creator>'));
  assert.ok(!same.includes(';'), 'no separator when the authors are one person');

  // A source author with no current user still survives; Lolly stays the actor.
  const srcOnly = part(writeDocx({
    blocks: [],
    meta: { sourceAuthor: 'Ana Kovac' },
  }), 'docProps/core.xml');
  assert.ok(srcOnly.includes('<dc:creator>Ana Kovac</dc:creator>'));
  assert.ok(srcOnly.includes('<cp:lastModifiedBy>Lolly</cp:lastModifiedBy>'));
});
