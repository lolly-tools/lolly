// SPDX-License-Identifier: MPL-2.0
/**
 * Unpack - the SVG reader (shells/web/src/views/svg-unpack.ts).
 *
 * Every helper is pure and takes a parsed Document (or the raw string for the
 * palette), so these run against jsdom with no browser. The parser is XML - 
 * `contentType: 'image/svg+xml'` - to mirror the browser's own
 * `new DOMParser().parseFromString(text, 'image/svg+xml')` that `openSvgFile` uses.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  svgPalette, svgImages, svgTextContent, svgFonts, svgVectors, parseDataUri, rasterSize,
} from '../shells/web/src/views/svg-unpack.ts';

// contentType makes jsdom parse as XML (like the browser's DOMParser 'image/svg+xml');
// the option is cast because @types/jsdom here predates it, though the runtime honours it.
const parse = (svg: string): Document =>
  new JSDOM(svg, { contentType: 'image/svg+xml' } as ConstructorParameters<typeof JSDOM>[1]).window.document as unknown as Document;

const b64 = (bytes: number[]): string => Buffer.from(Uint8Array.from(bytes)).toString('base64');

// A minimal PNG: 8-byte signature + an IHDR chunk declaring 16×9. rasterSize reads
// width at byte 16 and height at byte 20, so this is all it needs.
const PNG_16x9 = [
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
  0, 0, 0, 16, 0, 0, 0, 9, 8, 6, 0, 0, 0,
];

test('palette: fills, strokes, CSS declarations and gradient stops, never url() servers', () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <style>.a{fill:#123456}.b{stroke:rgb(0,128,0)}</style>
    <rect class="a" fill="#ff0000" stroke="#0000ff" width="10" height="10"/>
    <defs><linearGradient id="g"><stop stop-color="#abcdef"/><stop stop-color="rebeccapurple"/></linearGradient></defs>
    <circle fill="url(#g)" cx="5" cy="5" r="4"/>
  </svg>`;
  const pal = svgPalette(svg);
  for (const c of ['#ff0000', '#0000ff', '#123456', '#008000', '#abcdef', 'rebeccapurple']) {
    assert.ok(pal.includes(c), `palette should include ${c}, got ${pal.join(', ')}`);
  }
  // The paint-server reference itself is never a colour.
  assert.ok(!pal.some((c) => c.includes('url')), 'url(#g) leaked into the palette');
});

test('rasterSize reads PNG / GIF / JPEG headers, null otherwise', () => {
  assert.deepEqual(rasterSize(Uint8Array.from(PNG_16x9)), { w: 16, h: 9 });
  // GIF: "GIF8" then screen width/height little-endian (5, 3).
  assert.deepEqual(rasterSize(Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 5, 0, 3, 0])), { w: 5, h: 3 });
  assert.equal(rasterSize(Uint8Array.from([1, 2, 3, 4, 5])), null);
});

test('images: a data: raster round-trips its bytes and reports header dimensions', () => {
  const doc = parse(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <image href="data:image/png;base64,${b64(PNG_16x9)}" width="7" height="0"/>
  </svg>`);
  const { images, skipped } = svgImages(doc);
  assert.equal(images.length, 1);
  assert.equal(skipped, 0);
  assert.equal(images[0]!.mime, 'image/png');
  // Header wins over the (wrong) element attributes.
  assert.equal(images[0]!.width, 16);
  assert.equal(images[0]!.height, 9);
  assert.deepEqual([...images[0]!.bytes], PNG_16x9);
});

test('images: a linked href is counted, never fetched, and yields no bytes', () => {
  const doc = parse(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <image href="photo.png"/>
    <image xlink:href="https://example.test/x.jpg"/>
    <image href="#frag"/>
  </svg>`);
  const { images, skipped } = svgImages(doc);
  assert.equal(images.length, 0);
  assert.equal(skipped, 3);
});

test('text: one block per <text>, in document order, with weight read', () => {
  const doc = parse(`<svg xmlns="http://www.w3.org/2000/svg">
    <text font-size="20" font-weight="700">Hello</text>
    <g><text>there <tspan>world</tspan></text></g>
    <text> </text>
  </svg>`);
  const pt = svgTextContent(doc);
  assert.equal(pt.blocks.length, 2, 'the whitespace-only <text> is dropped');
  assert.equal(pt.blocks[0]!.text, 'Hello');
  assert.equal(pt.blocks[0]!.bold, true);
  assert.equal(pt.blocks[0]!.size, 20);
  assert.equal(pt.blocks[1]!.text, 'there world');
  assert.equal(pt.text, 'Hello\n\nthere world');
  assert.equal(pt.columns, 1);
  assert.equal(pt.scanned, false);
});

test('text: an outlined-to-paths SVG honestly yields nothing', () => {
  const doc = parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v10H0z"/></svg>`);
  const pt = svgTextContent(doc);
  assert.equal(pt.blocks.length, 0);
  assert.equal(pt.text, '');
});

test('fonts: a data: face is downloadable bytes; a names-only face is not', () => {
  // A woff2 magic ("wOF2") so sniffContainer names the format from the bytes.
  const woff2 = b64([0x77, 0x4f, 0x46, 0x32, 1, 2, 3, 4, 5, 6, 7, 8]);
  const doc = parse(`<svg xmlns="http://www.w3.org/2000/svg"><style>
    @font-face { font-family: "Embedded One"; src: url(data:font/woff2;base64,${woff2}) format('woff2'); }
    @font-face { font-family: 'Linked Two'; src: local('Linked Two'), url(linked.woff2) format('woff2'); }
  </style></svg>`);
  const fonts = svgFonts(doc);
  assert.equal(fonts.length, 2);
  const embedded = fonts.find((f) => f.family === 'Embedded One')!;
  assert.ok(embedded, 'the data: face was not found');
  assert.equal(embedded.installable, true);
  assert.equal(embedded.ext, 'woff2');
  assert.ok(embedded.bytes.length > 0);
  const named = fonts.find((f) => f.family === 'Linked Two')!;
  assert.ok(named, 'the names-only face was not found');
  assert.equal(named.installable, false);
  assert.equal(named.bytes.length, 0, 'a names-only face must carry no bytes');
  assert.equal(named.embedding.permission, 'unknown', 'absence of bytes is not a licence');
});

test('vectors: symbols become standalone SVGs; a <use>-heavy file yields no broken marks', () => {
  const doc = parse(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 100">
    <defs>
      <symbol id="ico" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="#ff0000"/></symbol>
    </defs>
    <use href="#ico" x="0"/><use href="#ico" x="30"/><use href="#ico" x="60"/>
  </svg>`);
  const vecs = svgVectors(doc);
  assert.equal(vecs.length, 1, 'exactly the symbol — the <use> refs produce no entries');
  const v = vecs[0]!;
  assert.equal(v.width, 24);
  assert.equal(v.height, 24);
  assert.ok(v.shapes >= 1);
  assert.ok(v.svg.startsWith('<svg') && v.svg.includes('viewBox="0 0 24 24"'), 'the mark is a well-formed standalone SVG');
  assert.ok(v.svg.includes('<path'), 'the mark carries its geometry');
  assert.ok(v.fills.includes('#ff0000'));
});

test('vectors: a group with no computable frame is skipped, not guessed', () => {
  const doc = parse(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <g id="layer1"><path d="M0 0h10"/></g>
  </svg>`);
  // A <g> has no viewBox and cannot be framed by attribute math - left for a
  // layout-aware pass rather than emitted at the wrong size.
  assert.equal(svgVectors(doc).length, 0);
});

test('parseDataUri: base64 and plain, mime lower-cased; non-data returns null', () => {
  const png = parseDataUri(`data:image/PNG;base64,${b64([1, 2, 3])}`);
  assert.deepEqual(png, { mime: 'image/png', bytes: Uint8Array.from([1, 2, 3]) });
  const plain = parseDataUri('data:text/plain,Hi%20there');
  assert.equal(new TextDecoder().decode(plain!.bytes), 'Hi there');
  assert.equal(parseDataUri('https://x/y.png'), null);
});
