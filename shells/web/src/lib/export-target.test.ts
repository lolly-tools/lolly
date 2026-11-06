// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addressedFramePage, fansOutPerPage, stagePages } from './export-target.ts';

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

test('a paged document fans its stills out per page, as a page strip and Design frames do', () => {
  assert.deepEqual(stagePages({ paged: true }, false), { frames: false, paged: true });
  assert.deepEqual(stagePages({ pages: { count: 'frames' } }, false), { frames: true, paged: false });
  assert.deepEqual(stagePages({}, true), { frames: true, paged: false });
  // Record declares both: the page strip's rule is the one it already had.
  assert.deepEqual(stagePages({ pages: { count: 'frames' }, paged: true }, false), { frames: true, paged: false });
  assert.equal(stagePages({}, false), null, 'a tool without page boxes keeps one file');
  assert.equal(stagePages({ paged: false }, false), null);
});

test('single pictures fan out; whole documents, motion and a paged document\'s text do not', () => {
  const paged = { frames: false, paged: true };
  const frames = { frames: true, paged: false };
  for (const fmt of ['png', 'jpg', 'webp', 'avif', 'svg', 'tiff', 'cmyk-tiff', 'emf', 'pdf-cmyk']) {
    assert.equal(fansOutPerPage(fmt, false, paged), true, `${fmt} is written per page`);
    assert.equal(fansOutPerPage(fmt, false, frames), true, `${fmt} per frame, as before`);
  }
  for (const fmt of ['pdf', 'zip', 'html', 'pptx', 'penpot', 'rpm', 'tar.gz']) {
    assert.equal(fansOutPerPage(fmt, false, paged), false, `${fmt} holds every page`);
    assert.equal(fansOutPerPage(fmt, false, frames), false);
  }
  assert.equal(fansOutPerPage('gif', true, paged), false, 'motion is a timeline');
  for (const fmt of ['md', 'docx', 'odt', 'txt', 'json', 'csv']) {
    assert.equal(fansOutPerPage(fmt, false, paged), false, `a paged document's ${fmt} stays whole`);
  }
  // A page strip or Design frames keep the rule they had for these (Record's sidecars).
  assert.equal(fansOutPerPage('srt', false, frames), true);
  assert.equal(fansOutPerPage('vtt', false, frames), true);
});
