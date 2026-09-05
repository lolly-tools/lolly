// SPDX-License-Identifier: MPL-2.0
/**
 * epub-read.test.ts - round-trips writeEpub → readEpub.
 *
 * We build a REAL .epub with the existing writer (its OCF zip, container.xml,
 * OPF spine and nav are the genuine article), then assert readEpub recovers the
 * chapter count, titles and body text as markdown, in reading order.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { writeEpub } from '../engine/src/epub.ts';
import { storeZip } from '../engine/src/zip.ts';
import {
  readEpub, EPUB_READ_MAX_MANIFEST_ITEMS, EPUB_READ_MAX_PART_BYTES,
  EPUB_READ_MAX_PARTS, EPUB_READ_MAX_TITLE_CHARS,
} from '../engine/src/epub-read.ts';

const enc = new TextEncoder();

function epubWithOpf(opf: string): Uint8Array {
  return storeZip([
    { name: 'mimetype', bytes: enc.encode('application/epub+zip') },
    {
      name: 'META-INF/container.xml',
      bytes: enc.encode('<container><rootfile full-path="OEBPS/content.opf"/></container>'),
    },
    { name: 'OEBPS/content.opf', bytes: enc.encode(opf) },
  ], { mimetypeFirst: true });
}

function u32(b: Uint8Array, o: number): number {
  return (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;
}

function setU16(b: Uint8Array, o: number, n: number): void {
  b[o] = n & 0xff;
  b[o + 1] = (n >>> 8) & 0xff;
}

function setU32(b: Uint8Array, o: number, n: number): void {
  b[o] = n & 0xff;
  b[o + 1] = (n >>> 8) & 0xff;
  b[o + 2] = (n >>> 16) & 0xff;
  b[o + 3] = (n >>> 24) & 0xff;
}

test('readEpub round-trips a two-chapter book from writeEpub', () => {
  const doc = {
    title: 'Brand Voice Handbook',
    author: 'Acme',
    chapters: [
      {
        title: 'Our Promise',
        xhtml:
          '<h1>Our Promise</h1>\n' +
          '<p>We ship <strong>on-brand</strong> assets, <em>fast</em>.</p>\n' +
          '<p>Simple in, polished out.</p>',
      },
      {
        title: 'Voice &amp; Tone',
        xhtml:
          '<h1>Voice &amp; Tone</h1>\n' +
          '<p>Say it plainly.</p>\n' +
          '<ul><li>Be warm</li><li>Be exact</li></ul>',
      },
    ],
  };

  const bytes = writeEpub(doc);
  assert.ok(bytes instanceof Uint8Array && bytes.length > 0, 'writeEpub produced bytes');

  const read = readEpub(bytes);

  // Book title.
  assert.equal(read.title, 'Brand Voice Handbook');

  // Chapter count + reading order preserved.
  assert.equal(read.chapters.length, 2);

  // Titles: first chapter from its <h1>; second decodes the entity in title/nav.
  assert.equal(read.chapters[0]!.title, 'Our Promise');
  assert.equal(read.chapters[1]!.title, 'Voice & Tone');

  // Body text, markdown-normalized.
  assert.equal(
    read.chapters[0]!.markdown,
    '# Our Promise\n\nWe ship **on-brand** assets, _fast_.\n\nSimple in, polished out.',
  );
  assert.equal(
    read.chapters[1]!.markdown,
    '# Voice & Tone\n\nSay it plainly.\n\n- Be warm\n- Be exact',
  );
});

test('readEpub falls back to the nav/TOC label when a chapter has no heading', () => {
  const doc = {
    title: 'Snippets',
    chapters: [
      { title: 'Legal Footer', xhtml: '<p>Copyright Acme. All rights reserved.</p>' },
    ],
  };

  const read = readEpub(writeEpub(doc));
  assert.equal(read.chapters.length, 1);
  // No <h1> in the body → title comes from the nav TOC label writeEpub emitted.
  assert.equal(read.chapters[0]!.title, 'Legal Footer');
  assert.equal(read.chapters[0]!.markdown, 'Copyright Acme. All rights reserved.');
});

test('readEpub rejects a non-EPUB byte blob', () => {
  assert.throws(() => readEpub(new Uint8Array([1, 2, 3, 4])), /zip|EPUB/i);
});

test('readEpub rejects archive and per-part expansion claims before inflation', () => {
  const countBomb = writeEpub({ title: 'T', chapters: [] }).slice();
  const eocd = countBomb.length - 22;
  setU16(countBomb, eocd + 8, EPUB_READ_MAX_PARTS + 1);
  setU16(countBomb, eocd + 10, EPUB_READ_MAX_PARTS + 1);
  assert.throws(() => readEpub(countBomb), /archive has .* entries; maximum/);

  const partBomb = writeEpub({ title: 'T', chapters: [] }).slice();
  const partEocd = partBomb.length - 22;
  const central = u32(partBomb, partEocd + 16);
  setU32(partBomb, central + 24, EPUB_READ_MAX_PART_BYTES + 1);
  assert.throws(() => readEpub(partBomb), /entry .* expands to .* maximum/);
});

test('readEpub caps XML cardinality and returned title size', () => {
  const items = Array.from(
    { length: EPUB_READ_MAX_MANIFEST_ITEMS + 1 },
    (_, i) => `<item id="x${i}" href="x${i}.xhtml"/>`,
  ).join('');
  assert.throws(() => readEpub(epubWithOpf(`<package><title>T</title><manifest>${items}</manifest></package>`)), /manifest items/);

  const title = 'x'.repeat(EPUB_READ_MAX_TITLE_CHARS + 1);
  assert.throws(() => readEpub(writeEpub({ title, chapters: [] })), /book title exceeds/);
});

test('malformed emphasis tag storms are scanned in linear time', () => {
  const xhtml = '<strong>'.repeat(50_000);
  const epub = writeEpub({ title: 'T', chapters: [{ title: 'C', xhtml }] });
  const started = performance.now();
  const read = readEpub(epub);
  assert.equal(read.chapters.length, 1);
  assert.ok(performance.now() - started < 1_000, 'bounded scanner should not backtrack quadratically');
});
