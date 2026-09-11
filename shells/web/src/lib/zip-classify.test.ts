// SPDX-License-Identifier: MPL-2.0
/**
 * zip-classify - the OOXML/OCF/archive disambiguation ladder, proven against REAL
 * bytes built by the engine's own writers. The property that matters is ordering:
 * every dedicated-reader format (pptx/xlsx/docx/epub/odt/lottie) must win before the
 * generic 'archive' verdict, so a "drop a .zip → explode it" path can never shred a
 * PowerPoint or an EPUB into raw parts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { storeZip, writeEpub, writeOdt, writeXlsx, writeDocx } from '@lolly/engine';
import { classifyZipBytes, classifyZipName, classifyZipContainer, classifyZipEntries } from './zip-classify.ts';

const enc = new TextEncoder();
const file = (name: string, type = '') => ({ name, type });

// ── name/MIME rung ───────────────────────────────────────────────────────────
test('classifyZipName maps extensions and MIMEs, mirroring isPptxUpload', () => {
  assert.equal(classifyZipName(file('deck.pptx')), 'pptx');
  assert.equal(classifyZipName(file('sheet.xlsx')), 'xlsx');
  assert.equal(classifyZipName(file('letter.docx')), 'docx');
  assert.equal(classifyZipName(file('book.epub')), 'epub');
  assert.equal(classifyZipName(file('notes.odt')), 'odt');
  assert.equal(classifyZipName(file('spin.lottie')), 'lottie');
  assert.equal(classifyZipName(file('deck', 'application/vnd.openxmlformats-officedocument.presentationml.presentation')), 'pptx');
  assert.equal(classifyZipName(file('book', 'application/epub+zip')), 'epub');
  assert.equal(classifyZipName(file('bundle.zip')), null, 'a plain .zip is not name-identifiable');
  assert.equal(classifyZipName(file('photo.png')), null);
});

// ── byte-peek: dedicated readers win before 'archive' ────────────────────────
test('an EPUB (OCF mimetype) classifies as epub, not archive', () => {
  const epub = writeEpub({ title: 'T', chapters: [{ title: 'C1', xhtml: '<p>hi</p>' }] });
  assert.equal(classifyZipBytes(epub), 'epub');
});

test('an ODT (OCF mimetype) classifies as odt, not archive', () => {
  const odt = writeOdt({ title: 'T', blocks: [{ type: 'paragraph', text: 'hi' }] });
  assert.equal(classifyZipBytes(odt), 'odt');
});

test('an XLSX ([Content_Types].xml + xl/workbook.xml) classifies as xlsx', () => {
  const xlsx = writeXlsx({ rows: [['h1', 'h2'], [1, 2]] });
  assert.equal(classifyZipBytes(xlsx), 'xlsx');
});

test('a DOCX ([Content_Types].xml + word/document.xml) classifies as docx', () => {
  const docx = writeDocx({ blocks: [{ type: 'paragraph', text: 'hi' }] });
  assert.equal(classifyZipBytes(docx), 'docx');
});

test('a PPTX-shaped zip classifies as pptx via its defining part', () => {
  // Minimal shape: the two markers the ladder keys on. (Full pptx writing lives in
  // pptx.ts; here we only assert the disambiguation, not a real deck.)
  const pptx = storeZip([
    { name: '[Content_Types].xml', bytes: enc.encode('<Types/>') },
    { name: 'ppt/presentation.xml', bytes: enc.encode('<p:presentation/>') },
  ]);
  assert.equal(classifyZipBytes(pptx), 'pptx');
});

test('a dotLottie (manifest.json + animations/) classifies as lottie', () => {
  const lottie = storeZip([
    { name: 'manifest.json', bytes: enc.encode('{"animations":[{"id":"a"}]}') },
    { name: 'animations/a.json', bytes: enc.encode('{"v":"5"}') },
  ]);
  assert.equal(classifyZipBytes(lottie), 'lottie');
});

// ── the generic-archive verdict, and its guards ──────────────────────────────
test('a plain multi-file zip classifies as archive', () => {
  const zip = storeZip([
    { name: 'readme.txt', bytes: enc.encode('hello') },
    { name: 'data/points.csv', bytes: enc.encode('a,b\n1,2') },
  ]);
  assert.equal(classifyZipBytes(zip), 'archive');
  assert.equal(classifyZipEntries([
    { name: 'readme.txt', bytes: enc.encode('hello') },
    { name: 'data/points.csv', bytes: enc.encode('a,b\n1,2') },
  ]), 'archive');
});

test('an unknown OOXML family is NOT treated as a plain archive', () => {
  // [Content_Types].xml present but no known defining part → null, never 'archive',
  // so an unfamiliar Office package is never shredded.
  const weird = storeZip([
    { name: '[Content_Types].xml', bytes: enc.encode('<Types/>') },
    { name: 'visio/document.xml', bytes: enc.encode('<x/>') },
  ]);
  assert.equal(classifyZipBytes(weird), null);
});

test('non-zip and malformed inputs classify as null', () => {
  assert.equal(classifyZipBytes(enc.encode('not a zip at all, just text')), null);
  assert.equal(classifyZipBytes(Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0])), null, 'truncated PK header is unreadable');
});

// ── combined entry point: name rung short-circuits the byte-peek ──────────────
test('classifyZipContainer uses the name rung first, byte-peek as fallback', async () => {
  const xlsx = writeXlsx({ rows: [['a']] });
  // A wrong extension but real xlsx bytes → the byte-peek still identifies it.
  const blank = new File([xlsx as BlobPart], 'mystery', { type: '' });
  assert.equal(await classifyZipContainer(blank, xlsx), 'xlsx');
  // The name rung wins without reading bytes we did not pass.
  assert.equal(await classifyZipContainer(new File([], 'deck.pptx')), 'pptx');
});
