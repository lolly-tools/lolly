// SPDX-License-Identifier: MPL-2.0
/**
 * Whether bytes are an SVG picture (format-sniff.ts `isSvgDocument`), which the
 * CLI's picture check and the canvas decoder both read.
 *
 * Run directly:  node --test packages/node-shell/test/svg-document-sniff.test.ts
 *
 * The root element decides, found past the XML declaration, comments and a
 * DOCTYPE. A legacy Adobe Illustrator export puts a DOCTYPE with a block of ENTITY
 * declarations before its `<svg>` (byte 722 in the fixture), so a sniff of the
 * first 512 bytes refused a real logo. A text or HTML file that mentions `<svg`
 * is still not a picture.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isSvgDocument, SVG_SNIFF_BYTES } from '../src/format-sniff.ts';
import { sniffImageMime } from '../src/canvas.ts';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
/** Leading bytes (a byte-order mark, written as numbers) and then UTF-8 text. */
const withBytes = (lead: number[], s: string): Uint8Array => new Uint8Array([...lead, ...enc(s)]);
const ILLUSTRATOR = new Uint8Array(readFileSync(new URL('../../../tests/fixtures/adobe/illustrator-legacy-logo.svg', import.meta.url)));

test('a legacy Illustrator export, its <svg> after a DOCTYPE and ENTITY block, is an SVG', () => {
  const text = new TextDecoder().decode(ILLUSTRATOR);
  assert.ok(text.indexOf('<svg') > 512, 'the fixture puts its root element past the first 512 bytes');
  assert.equal(isSvgDocument(ILLUSTRATOR), true);
  assert.equal(sniffImageMime(ILLUSTRATOR), 'image/svg+xml', 'the canvas decoder reads it as an SVG too');
});

test('the root element decides, past declarations, comments and a DOCTYPE', () => {
  assert.equal(isSvgDocument(enc('<svg xmlns="http://www.w3.org/2000/svg"/>')), true);
  assert.equal(isSvgDocument(withBytes([0xef, 0xbb, 0xbf], '  \n<svg>')), true, 'a byte-order mark and white space first');
  assert.equal(isSvgDocument(enc('<?xml version="1.0"?><!-- <html> --><svg:svg xmlns:svg="http://www.w3.org/2000/svg"/>')), true, 'a prefixed root');
  assert.equal(isSvgDocument(enc('<!DOCTYPE svg [ <!ENTITY a "]>"> <!-- ] > --> ]><svg width="1"/>')), true, 'brackets and > inside the internal subset');
  assert.equal(isSvgDocument(enc(`<?xml version="1.0"?><!--${' '.repeat(20000)}--><svg/>`)), true, 'a long comment first');
  const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('<?xml version="1.0" encoding="UTF-16"?><svg/>', 'utf16le')]);
  assert.equal(isSvgDocument(new Uint8Array(utf16)), true, 'UTF-16 with its byte-order mark');
});

test('a file that only mentions <svg is not a picture', () => {
  assert.equal(isSvgDocument(enc('<!DOCTYPE html><html><body><svg viewBox="0 0 1 1"></svg></body></html>')), false, 'HTML with an inline drawing');
  assert.equal(isSvgDocument(enc('notes: draw a <svg> here\n')), false, 'text');
  assert.equal(isSvgDocument(enc('[default]\naws_secret_access_key = <svg>\n')), false, 'a credentials file');
  assert.equal(isSvgDocument(enc('<?xml version="1.0"?><!-- <svg> --><plist/>')), false, 'an <svg> inside a comment');
  assert.equal(isSvgDocument(enc('<svgx/>')), false, 'another element whose name starts with svg');
  assert.equal(isSvgDocument(enc('<!-- never closed <svg>')), false, 'an unterminated comment');
  assert.equal(isSvgDocument(enc('')), false);
  assert.equal(sniffImageMime(enc('<?xml version="1.0"?><plist/>')), 'application/octet-stream', 'an XML declaration alone is not an SVG');
});

test('only the first 64 KiB are read', () => {
  assert.equal(SVG_SNIFF_BYTES, 64 * 1024);
  const late = enc(`<!--${' '.repeat(SVG_SNIFF_BYTES)}--><svg/>`);
  assert.equal(isSvgDocument(late), false, 'a root element past the window is not looked for');
});

test('a byte-order mark is dropped by the decoder itself, in each encoding the sniff reads', () => {
  // TextDecoder's default (ignoreBOM false) removes the mark of its own encoding,
  // which is why the sniff has no replace of its own.
  const utf8 = new TextDecoder('utf-8').decode(new Uint8Array([0xef, 0xbb, 0xbf, 0x3c]));
  assert.equal(utf8, '<');
  assert.equal(utf8.charCodeAt(0), 0x3c, 'the first character is the "<" after the mark');
  assert.equal(new TextDecoder('utf-16le').decode(new Uint8Array([0xff, 0xfe, 0x3c, 0x00])), '<');
  assert.equal(new TextDecoder('utf-16be').decode(new Uint8Array([0xfe, 0xff, 0x00, 0x3c])), '<');
  // Each one, with the root element straight after the mark.
  assert.equal(isSvgDocument(withBytes([0xef, 0xbb, 0xbf], '<svg/>')), true, 'UTF-8');
  const le = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('<svg/>', 'utf16le')]);
  assert.equal(isSvgDocument(new Uint8Array(le)), true, 'UTF-16 little-endian');
  const be = Buffer.from('<svg/>', 'utf16le').swap16();
  assert.equal(isSvgDocument(new Uint8Array(Buffer.concat([Buffer.from([0xfe, 0xff]), be]))), true, 'UTF-16 big-endian');
  assert.equal(isSvgDocument(withBytes([0xef, 0xbb, 0xbf], 'notes: <svg>')), false, 'a mark does not make text a picture');
});

test('the sniff and this test hold no invisible characters', () => {
  // Hidden characters are banned from the tree; a byte-order mark in a test is
  // written as bytes, as above.
  const hidden = /[\u00ad\u200b-\u200f\u2028-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/u;
  for (const rel of ['../src/format-sniff.ts', './svg-document-sniff.test.ts']) {
    const text = readFileSync(new URL(rel, import.meta.url), 'utf8');
    assert.doesNotMatch(text, hidden, rel);
  }
});
