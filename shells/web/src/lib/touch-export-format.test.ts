// SPDX-License-Identifier: MPL-2.0
/** node --test shells/web/src/lib/touch-export-format.test.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startingFormat } from './touch-export-format.ts';

test('an SVG-first tool starts on PNG on a touch-only device, and on SVG at a desk', () => {
  const qr = ['svg', 'penpot', 'png', 'jpeg', 'pdf'];
  assert.equal(startingFormat(qr, true), 'png');
  assert.equal(startingFormat(qr, false), 'svg');
});

test('every other list keeps its first format on a phone', () => {
  assert.equal(startingFormat(['pdf', 'png'], true), 'pdf', 'a document stays a document');
  assert.equal(startingFormat(['svg', 'pdf'], true), 'svg', 'no PNG to fall back on');
  assert.equal(startingFormat(['png', 'svg'], true), 'png');
  assert.equal(startingFormat([], true), undefined);
});
