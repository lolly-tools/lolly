// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><body></body>');
for (const key of [
  'window',
  'document',
  'HTMLElement',
  'HTMLInputElement',
  'Element',
  'Node',
  'Event',
  'MouseEvent',
  'AbortController',
  'AbortSignal',
  'URL',
]) {
  (globalThis as Record<string, unknown>)[key] = (dom.window as unknown as Record<string, unknown>)[
    key
  ];
}

const { setupCanvasFileDrop } = await import('./tool-canvas-drop.ts');

test('canvas file-drop disposal removes listeners, picker, drag state, and blob previews', () => {
  const viewEl = document.createElement('div');
  const contentEl = document.createElement('div');
  const picker = document.createElement('button');
  picker.dataset.filePick = '';
  contentEl.appendChild(picker);
  viewEl.appendChild(contentEl);
  document.body.appendChild(viewEl);

  let nativeClicks = 0;
  const originalClick = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function click(): void {
    nativeClicks += 1;
  };
  const revoked: string[] = [];
  const urlType = URL as unknown as { revokeObjectURL?: (url: string) => void };
  const originalRevoke = urlType.revokeObjectURL;
  urlType.revokeObjectURL = (url) => revoked.push(url);

  const runtime = {
    getModel: () => [{ id: 'source', value: { url: 'blob:preview-1' } }],
    setInput() {},
  };
  const dispose = setupCanvasFileDrop({
    viewEl,
    contentEl,
    runtime: runtime as never,
    input: { id: 'source', type: 'file' } as never,
    fileToRef: async () => {
      throw new Error('not used');
    },
    formatBytes: String,
  });

  try {
    picker.click();
    assert.equal(nativeClicks, 1, 'the explicit picker affordance opens the hidden input');
    assert.equal(viewEl.querySelectorAll('input[type="file"]').length, 1);
    contentEl.classList.add('is-file-dragover');

    dispose();
    assert.equal(viewEl.querySelectorAll('input[type="file"]').length, 0);
    assert.equal(contentEl.classList.contains('is-file-dragover'), false);
    assert.deepEqual(revoked, ['blob:preview-1']);

    picker.click();
    assert.equal(nativeClicks, 1, 'the aborted listener cannot reopen a picker after navigation');
  } finally {
    HTMLInputElement.prototype.click = originalClick;
    urlType.revokeObjectURL = originalRevoke;
    viewEl.remove();
  }
});
