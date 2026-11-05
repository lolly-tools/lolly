// SPDX-License-Identifier: MPL-2.0
/** The preview document: inline, inert, and reaching nothing outside itself. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { brandPagePreviewHtml, inlineStylesheet, type PreviewFile } from './brand-page-preview.ts';

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);
const parse = (html: string): Document => new JSDOM(html).window.document;
const file = (path: string, mediaType: string, text: string): PreviewFile => ({ path, mediaType, bytes: encode(text) });

const PAGE = `<!doctype html><html><head><title>Acme</title>
<link rel="stylesheet" href="assets/page.css"><link rel="icon" href="logos/a.svg"></head>
<body><a href="#type">Type</a><a href="index.md">Markdown</a><a href="https://lolly.tools/">Lolly</a>
<img src="logos/a.svg" alt="Acme"><img src="logos/missing.svg" alt="Gone"></body></html>`;

const FILES = [
  file('index.html', 'text/html', PAGE),
  file('assets/page.css', 'text/css', '@font-face{font-family:"A";src:url(../fonts/a.woff2)}body{background:url("../gone.png")}'),
  file('logos/a.svg', 'image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg"/>'),
  file('fonts/a.woff2', 'font/woff2', 'wOF2'),
];

test('the stylesheet and pictures are written inline, so the frame has nothing to fetch', () => {
  const doc = parse(brandPagePreviewHtml(FILES, parse));
  assert.equal(doc.querySelector('link'), null);
  const style = doc.querySelector('style')!.textContent!;
  assert.match(style, /url\(data:font\/woff2;base64,/);
  assert.match(style, /url\(\)/, 'a file the folder does not hold is dropped, never requested');
  const images = [...doc.querySelectorAll('img')];
  assert.equal(images.length, 1, 'a picture with no file is removed');
  assert.match(images[0]!.getAttribute('src')!, /^data:image\/svg\+xml;base64,/);
});

test('a link only moves within the page: a preview has nowhere to go', () => {
  const doc = parse(brandPagePreviewHtml(FILES, parse));
  const hrefs = [...doc.querySelectorAll('a')].map(a => a.getAttribute('href'));
  assert.deepEqual(hrefs, ['#type', null, null]);
});

test('a policy in the document stops anything being fetched', () => {
  const doc = parse(brandPagePreviewHtml(FILES, parse));
  const policy = doc.querySelector('meta[http-equiv="Content-Security-Policy"]')!.getAttribute('content')!;
  assert.match(policy, /default-src 'none'/);
  assert.doesNotMatch(policy, /script-src/);
  assert.equal(doc.head.firstElementChild?.getAttribute('http-equiv'), 'Content-Security-Policy', 'the policy comes first');
});

test('no index.html, no document', () => {
  assert.equal(brandPagePreviewHtml([], parse), '');
});

test('a relative path climbs from the stylesheet, not from the page', () => {
  const css = inlineStylesheet('a{b:url(../logos/a.svg)}', 'assets/page.css', new Map([['logos/a.svg', FILES[2]!]]));
  assert.match(css, /data:image\/svg\+xml/);
});
