// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { writeEpub } from '../engine/src/epub.ts';

const dec = new TextDecoder();

const DOC = {
  title: 'A Tale of Two <Cities>',
  author: 'C. D. & Co.',
  lang: 'en-GB',
  chapters: [
    { title: 'Chapter One', xhtml: '<h1>One</h1><p>It was the best of times.</p>' },
    { title: 'Chapter Two', xhtml: '<h1>Two</h1><p>It was the worst of times.</p>' },
    { title: 'Chapter Three', xhtml: '<h1>Three</h1><p>The end.</p>' },
  ],
};

// Read a little-endian u16/u32 from a byte array.
const u16 = (b: Uint8Array, o: number) => b[o]! | (b[o + 1]! << 8);
const u32 = (b: Uint8Array, o: number) => (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;

test('mimetype is the first entry and STORED with the exact media type', () => {
  const bytes = writeEpub(DOC);

  // First local file header at offset 0.
  assert.equal(u32(bytes, 0), 0x04034b50, 'first entry is a local file header');
  const method = u16(bytes, 8); // compression method field
  assert.equal(method, 0, 'mimetype must be STORED (method 0)');

  const nameLen = u16(bytes, 26);
  const extraLen = u16(bytes, 28);
  assert.equal(extraLen, 0, 'mimetype must carry no extra field');
  const name = dec.decode(bytes.subarray(30, 30 + nameLen));
  assert.equal(name, 'mimetype');

  const compSize = u32(bytes, 18);
  const dataStart = 30 + nameLen + extraLen;
  const body = dec.decode(bytes.subarray(dataStart, dataStart + compSize));
  assert.equal(body, 'application/epub+zip');
});

test('round-trips through unzipSync with the expected entry set', () => {
  const entries = unzipSync(writeEpub(DOC));
  const names = Object.keys(entries);
  assert.ok(names.includes('mimetype'));
  assert.ok(names.includes('META-INF/container.xml'));
  assert.ok(names.includes('OEBPS/content.opf'));
  assert.ok(names.includes('OEBPS/nav.xhtml'));
  for (let i = 1; i <= 3; i++) {
    assert.ok(names.includes(`OEBPS/chapter-${String(i).padStart(3, '0')}.xhtml`));
  }
});

test('container.xml points at the OPF', () => {
  const entries = unzipSync(writeEpub(DOC));
  const container = dec.decode(entries['META-INF/container.xml']!);
  assert.match(container, /full-path="OEBPS\/content\.opf"/);
  assert.match(container, /media-type="application\/oebps-package\+xml"/);
});

test('OPF spine lists every chapter in reading order', () => {
  const entries = unzipSync(writeEpub(DOC));
  const opf = dec.decode(entries['OEBPS/content.opf']!);

  // Manifest + nav present.
  assert.match(opf, /properties="nav"/);
  assert.match(opf, /version="3.0"/);

  const spine = opf.slice(opf.indexOf('<spine>'), opf.indexOf('</spine>'));
  const order = [...spine.matchAll(/idref="(chapter-\d+)"/g)].map((m) => m[1]);
  assert.deepEqual(order, ['chapter-001', 'chapter-002', 'chapter-003']);
});

test('metadata is XML-escaped', () => {
  const entries = unzipSync(writeEpub(DOC));
  const opf = dec.decode(entries['OEBPS/content.opf']!);
  assert.match(opf, /<dc:title>A Tale of Two &lt;Cities&gt;<\/dc:title>/);
  assert.match(opf, /<dc:creator id="author">C\. D\. &amp; Co\.<\/dc:creator>/);
  assert.match(opf, /<dc:language>en-GB<\/dc:language>/);
});

test('chapter body markup is wrapped and preserved verbatim', () => {
  const entries = unzipSync(writeEpub(DOC));
  const ch1 = dec.decode(entries['OEBPS/chapter-001.xhtml']!);
  assert.match(ch1, /xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/);
  assert.match(ch1, /<title>Chapter One<\/title>/);
  assert.ok(ch1.includes('<h1>One</h1><p>It was the best of times.</p>'));
});

test('nav lists chapters with links to their files', () => {
  const entries = unzipSync(writeEpub(DOC));
  const nav = dec.decode(entries['OEBPS/nav.xhtml']!);
  assert.match(nav, /epub:type="toc"/);
  assert.match(nav, /<a href="chapter-001\.xhtml">Chapter One<\/a>/);
  assert.match(nav, /<a href="chapter-003\.xhtml">Chapter Three<\/a>/);
});

test('output is deterministic', () => {
  assert.deepEqual(writeEpub(DOC), writeEpub(DOC));
});

test('language defaults to en when omitted or blank', () => {
  const entries = unzipSync(writeEpub({ title: 'T', chapters: [{ title: 'C', xhtml: '<p>x</p>' }] }));
  const opf = dec.decode(entries['OEBPS/content.opf']!);
  assert.match(opf, /<dc:language>en<\/dc:language>/);
});
