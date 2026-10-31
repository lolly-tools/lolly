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
const ILLUSTRATOR = new Uint8Array(readFileSync(new URL('../../../tests/fixtures/adobe/illustrator-legacy-logo.svg', import.meta.url)));

test('a legacy Illustrator export, its <svg> after a DOCTYPE and ENTITY block, is an SVG', () => {
  const text = new TextDecoder().decode(ILLUSTRATOR);
  assert.ok(text.indexOf('<svg') > 512, 'the fixture puts its root element past the first 512 bytes');
  assert.equal(isSvgDocument(ILLUSTRATOR), true);
  assert.equal(sniffImageMime(ILLUSTRATOR), 'image/svg+xml', 'the canvas decoder reads it as an SVG too');
});

test('the root element decides, past declarations, comments and a DOCTYPE', () => {
  assert.equal(isSvgDocument(enc('<svg xmlns="http://www.w3.org/2000/svg"/>')), true);
  assert.equal(isSvgDocument(enc('﻿  \n<svg>')), true, 'a byte-order mark and white space first');
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
