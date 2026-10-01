// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addressedFramePage } from './export-target.ts';

/** Three artboards as the canvas renders them: [data-pdf-page] with their frame ids. */
function canvasOf(ids: string[]) {
  const pages = ids.map((id, i) => ({ id, i, getAttribute: (name: string) => (name === 'data-frame-id' ? id : null) }));
  return { querySelectorAll: (sel: string) => (sel === '[data-pdf-page]' ? pages : []) } as unknown as ParentNode;
}

test('a deep link s= picks the artboard it names, by position or by frame id', () => {
  const root = canvasOf(['s01', 's02', 's09']);
  assert.equal((addressedFramePage(root, 'png', '3') as unknown as { id: string }).id, 's09');
  assert.equal((addressedFramePage(root, 'jpg', 's02') as unknown as { id: string }).id, 's02');
});

test('no address, a whole-deck or motion format, or a miss leaves the export whole', () => {
  const root = canvasOf(['s01', 's02']);
  assert.equal(addressedFramePage(root, 'png', null), null);
  assert.equal(addressedFramePage(root, 'pdf', '2'), null, 'a PDF carries every slide');
  assert.equal(addressedFramePage(root, 'pptx', '2'), null);
  assert.equal(addressedFramePage(root, 'mp4', '2'), null, 'a timeline is addressed by time, not slide');
  assert.equal(addressedFramePage(root, 'png', '7'), null, 'an address that names nothing is not slide 1');
  assert.equal(addressedFramePage(null, 'png', '1'), null);
});
