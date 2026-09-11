// SPDX-License-Identifier: MPL-2.0
/**
 * office-text.ts - the two pieces with real logic of their own, proven against a
 * real .docx written by the engine's own writeDocx:
 *
 *  • docxToHtml inlines each media part ONCE as a data URL (the memo an earlier
 *    unmemoised resolver went OOM without) and reports what it could not inline.
 *  • markdownDownload packs markdown + media/ into a zip, and stays a plain .md
 *    when the document had no images.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { writeDocx, readZip } from '@lolly/engine';
import { docxToHtml, markdownDownload } from './office-text.ts';

/** office-text parses XML through the DOM global the web shell owns; node has none,
 *  so lend it jsdom's - the same injection the CLI bridge makes. */
async function lendDomParser(): Promise<void> {
  const { JSDOM } = await import('jsdom');
  (globalThis as unknown as { DOMParser: unknown }).DOMParser = new JSDOM('').window.DOMParser;
}

// A 1×1 PNG (the smallest thing a browser will actually paint).
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

/** A document whose ONE image is referenced twice - the shape that made an
 *  unmemoised resolver encode the same part twice. */
const twoRefsToOneImage = (): Uint8Array => writeDocx({
  blocks: [
    { type: 'heading', level: 1, inlines: [{ type: 'text', text: 'Brand book' }] },
    { type: 'image', ref: 'logo.png', alt: 'The logo' },
    { type: 'para', inlines: [{ type: 'text', text: 'Again below' }] },
    { type: 'image', ref: 'logo.png', alt: 'The logo' },
  ],
  media: [{ name: 'logo.png', bytes: PNG }],
});

test('docxToHtml: images inline as data URLs, each part encoded once', async () => {
  await lendDomParser();
  const { html, dropped } = await docxToHtml(twoRefsToOneImage());
  assert.equal(dropped, 0, 'a png is inlineable');
  assert.match(html, /<h1>Brand book<\/h1>/);
  const srcs = [...html.matchAll(/<img src="(data:image\/png;base64,[^"]+)"/g)].map((m) => m[1]);
  assert.equal(srcs.length, 2, 'both references render an image');
  assert.equal(srcs[0], srcs[1], 'the same part resolves to the same string (memoised)');
  assert.match(html, /alt="The logo"/);
});

test('markdownDownload: media makes it a zip, no media keeps it markdown', async () => {
  const plain = markdownDownload({ markdown: '# Hi', media: [] }, 'doc.md');
  assert.equal(plain.type, 'text/markdown');
  assert.equal(await plain.text(), '# Hi');

  const packed = markdownDownload({ markdown: '![](media/1.png)', media: [{ name: 'media/1.png', bytes: PNG }] }, 'deck.md');
  assert.equal(packed.type, 'application/zip');
  const entries = readZip(new Uint8Array(await packed.arrayBuffer()));
  const names = entries.map((e) => e.name).sort();
  assert.deepEqual(names, ['deck.md', 'media/1.png']);
});
