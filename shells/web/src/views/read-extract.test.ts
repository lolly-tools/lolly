// SPDX-License-Identifier: MPL-2.0
/**
 * The Read and extract view's pure pieces (views/read-extract.ts): the bounds the
 * person types become `readExtract` options, each block says where its words came
 * from, and the page sections escape what the file says.
 *
 * Run with: node --import ./tests/css-stub.mjs --test shells/web/src/views/read-extract.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ExtractBlockV1, ReadExtractV1 } from '@lolly-tools/core';
import { extractOptions, originLine, renderExtractHtml } from './read-extract.ts';

const SHA = (c: string): string => c.repeat(64);
const block = (extra: Partial<ExtractBlockV1>): ExtractBlockV1 => ({ id: 'p1.0', page: 1, order: 0, kind: 'text', text: 'x', ...extra });

test('blank bounds ask for nothing, and typed ones become readExtract options', () => {
  assert.deepEqual(extractOptions({ pages: '  ', maxChars: '', minConfidence: '' }), {});
  assert.deepEqual(extractOptions({ pages: ' 1-3 ', maxChars: '500', minConfidence: '0.7' }, 'p2.1'), { pages: '1-3', maxChars: 500, minConfidence: 0.7, from: 'p2.1' });
});

test('each block says where its words came from, with the model and its confidence when recognised', () => {
  assert.equal(originLine(block({ origin: 'authored' })), 'Written in the file');
  assert.equal(originLine(block({ origin: 'text-layer' })), 'From the text layer the scan carries');
  assert.equal(
    originLine(block({ origin: 'recognized', recognition: { model: 'ppocr-v5-mobile', modelVersion: 'v5-mobile', confidence: 0.914, minConfidence: 0.8, lines: 2 } })),
    'Read by text recognition (ppocr-v5-mobile v5-mobile), confidence 91%, lowest line 80%',
  );
  assert.equal(originLine(block({ kind: 'picture' })), '');
});

test('the page sections escape the file\'s words, mark scans, and show pictures through the URL they are given', () => {
  const extract: ReadExtractV1 = {
    version: 'lolly/read-extract-v1',
    inventory: 'lolly/content-inventory-v1',
    source: { name: 'a.pdf', sha256: SHA('a'), bytes: 1, kind: 'pdf', pages: 2 },
    request: { pages: [1, 2], kinds: ['text', 'table', 'picture'] },
    pages: [{ number: 1, blocks: 3 }, { number: 2, scanned: true, read: 'not-read', blocks: 0 }],
    blocks: [
      block({ text: '<script>alert(1)</script>', origin: 'authored', role: 'title' }),
      block({ id: 'p1.1', order: 1, kind: 'table', text: 'a\tb', rows: [['<b>', 'c'], ['d', 'e']] }),
      block({ id: 'p1.2', order: 2, kind: 'picture', text: '', picture: { ref: 'user/media/p', sha256: SHA('b'), mime: 'image/png', kind: 'photo' } }),
    ],
    chars: 26,
    complete: true,
    warnings: [],
  };
  const html = renderExtractHtml(extract, (ref) => (ref === 'user/media/p' ? 'blob:fake' : null));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('<th scope="col">&lt;b&gt;</th>'));
  assert.ok(html.includes('<img src="blob:fake" alt=""'));
  assert.ok(html.includes('The file gives this picture no description.'));
  assert.ok(html.includes('data-read="not-read"'));
  assert.ok(html.includes('Nothing on this page in this extract.'));
});
