// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { detachExportHidden } from './export-canvas-annotations.ts';

test('capture detaches nested editor chrome while retaining cameras and restores adjacent siblings in order', () => {
  const dom = new JSDOM('<main><div id="first" data-export-hide><span data-export-hide>guide</span></div><div id="second" data-export-hide>selection</div><div id="cam" data-export-hide data-cam></div><div id="art">art</div></main>');
  const root = dom.window.document.querySelector('main')!, before = root.innerHTML;
  const restore = detachExportHidden(root);
  assert.deepEqual([...root.children].map(node => node.id), ['cam','art']);
  restore();
  assert.equal(root.innerHTML, before);
  dom.window.close();
});
