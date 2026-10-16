// SPDX-License-Identifier: MPL-2.0
// A body repaint must not swap out the upload input. Files chosen for an input go to
// that element (the native picker it opened, or a browser driver that found it a
// moment earlier), and a replaced input has no listener left to take them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { CatCtx } from './context.ts';
import { disposeDropzone, mountDropzone } from './sections.ts';

const dom = new JSDOM('<body></body>');
// jsdom only accepts its own AbortSignal in addEventListener options.
globalThis.AbortController = dom.window.AbortController as unknown as typeof globalThis.AbortController;

function fixture(): { cat: CatCtx; viewEl: HTMLElement; paint: (opts: { uploads: boolean; empty?: boolean }) => void } {
  const viewEl = dom.window.document.createElement('div');
  dom.window.document.body.replaceChildren(viewEl);
  const cat = { host: {}, viewEl, mounted: true, dropzoneDispose: null, dropzoneMount: null } as unknown as CatCtx;
  const paint = ({ uploads, empty = false }: { uploads: boolean; empty?: boolean }): void => {
    viewEl.innerHTML = `<div class="catalog-body">${uploads ? `<div data-dropzone-mount${empty ? ' data-empty' : ''}></div>` : ''}<div class="cat-grid"></div></div>`;
  };
  return { cat, viewEl, paint };
}

/** Whether the zone still answers a file drag, which needs its listeners bound. */
function acceptsFileDrag(zone: Element): boolean {
  const drag = new dom.window.Event('dragover', { cancelable: true });
  Object.defineProperty(drag, 'dataTransfer', { value: { types: ['Files'], dropEffect: 'none' } });
  zone.dispatchEvent(drag);
  return drag.defaultPrevented;
}

test('a repaint puts the mounted upload input back instead of building a new one', () => {
  const { cat, viewEl, paint } = fixture();
  paint({ uploads: true, empty: true });
  mountDropzone(cat);
  const input = viewEl.querySelector('.updz-input');
  assert.ok(input, 'the first paint mounts the dropzone');
  assert.ok(viewEl.querySelector('.updz')?.classList.contains('updz--empty'));

  paint({ uploads: true });
  assert.equal(input.isConnected, false, 'the rebuilt markup detaches the zone');
  mountDropzone(cat);
  assert.equal(viewEl.querySelector('.updz-input'), input, 'the input a picker or driver holds is the live one again');
  assert.equal(viewEl.querySelectorAll('[data-dropzone-mount]').length, 1);
  assert.equal(viewEl.querySelector('[data-dropzone-mount]')?.hasAttribute('data-empty'), false, 'this paint\'s attributes are copied over');
  assert.equal(viewEl.querySelector('.updz')?.classList.contains('updz--empty'), false);
  assert.equal(acceptsFileDrag(viewEl.querySelector('.updz')!), true, 'the zone keeps its listeners');

  disposeDropzone(cat);
  paint({ uploads: true });
  mountDropzone(cat);
  assert.notEqual(viewEl.querySelector('.updz-input'), input, 'once the view ends the zone, the next mount builds a new one');
  disposeDropzone(cat);
});

test('a paint with no uploads section ends the dropzone', () => {
  const { cat, viewEl, paint } = fixture();
  paint({ uploads: true });
  mountDropzone(cat);
  const zone = viewEl.querySelector('.updz')!;
  paint({ uploads: false });
  mountDropzone(cat);
  assert.equal(cat.dropzoneDispose, null);
  assert.equal(cat.dropzoneMount, null);
  assert.equal(acceptsFileDrag(zone), false, 'the ended zone no longer takes files');
  paint({ uploads: true });
  mountDropzone(cat);
  assert.notEqual(viewEl.querySelector('.updz'), zone, 'a later paint with the section mounts a fresh zone');
  disposeDropzone(cat);
});
