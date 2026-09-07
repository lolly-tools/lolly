// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { offerDownloadRecovery } from './download-recovery.ts';
import { consumeSaveAsNext, requestSaveAsNext, saveFileWithPicker } from '../bridge/export-save-picker.ts';

const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

test('download recovery preserves the file, opens the picker on the click, and confirms only a closed write', async () => {
  const dom = new JSDOM('<p role="status">File ready.</p>');
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document });
  const blob = new Blob(['prepared archive'], { type: 'application/x-penpot' });
  const status = document.querySelector('p')!;
  let cleanup = (): void => {};
  try {
    const unsupported = offerDownloadRecovery(status, blob, 'component.penpot', 'Saved.');
    assert.equal(status.querySelector('button'), null);
    assert.match(status.textContent!, /download permissions/);
    unsupported();
    status.textContent = 'File ready.';

    let calls = 0;
    let written: Blob | undefined;
    let close!: () => void;
    (window as any).showSaveFilePicker = function (opts: any) {
      assert.equal(this, window);
      calls++;
      assert.equal(opts.suggestedName, 'component.penpot');
      assert.deepEqual(opts.types[0].accept, { 'application/x-penpot': ['.penpot'] });
      return Promise.resolve({ createWritable: async () => ({
        write: async (data: Blob) => { written = data; },
        close: () => new Promise<void>(resolve => { close = resolve; }),
      }) });
    };
    cleanup = offerDownloadRecovery(status, blob, 'component.penpot', 'Saved.');
    const button = status.querySelector('button')!;
    button.click();
    assert.equal(calls, 1, 'the picker must open synchronously within the click');
    assert.equal(button.disabled, true);
    await tick();
    assert.equal(written, blob, 'save the already-prepared bytes without rebuilding');
    assert.doesNotMatch(status.textContent!, /Saved\./);
    close();
    await tick();
    assert.match(status.textContent!, /Saved\./);
    assert.equal(button.disabled, false);

    (window as any).showSaveFilePicker = async () => { throw new DOMException('cancel', 'AbortError'); };
    button.click();
    await tick();
    assert.match(status.textContent!, /Save cancelled/);
    assert.doesNotMatch(status.textContent!, /Saved\./);
    assert.equal(button.disabled, false);

    (window as any).showSaveFilePicker = async () => ({ createWritable: async () => ({
      write: async () => { throw new DOMException('disk write aborted', 'AbortError'); },
      close: async () => {},
    }) });
    button.click();
    await tick();
    assert.match(status.textContent!, /Could not save: disk write aborted/);
    assert.doesNotMatch(status.textContent!, /Save cancelled|Saved\./);
    assert.equal(button.disabled, false);

    cleanup();
    assert.equal(status.querySelector('button'), null);
    (window as any).showSaveFilePicker = () => { throw new Error('disposed button must not open a picker'); };
    button.click();
    await tick();
  } finally {
    cleanup();
    dom.window.close();
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else delete (globalThis as any).window;
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument); else delete (globalThis as any).document;
  }
});

test('legacy Save As consumes cancellation once and still falls back on API refusal', async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const blob = new Blob(['file']);
  const win = { showSaveFilePicker: async (): Promise<never> => { throw new DOMException('cancel', 'AbortError'); } };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
  try {
    requestSaveAsNext();
    assert.equal(await consumeSaveAsNext(blob, 'file.txt'), true);
    assert.equal(await consumeSaveAsNext(blob, 'file.txt'), false);
    win.showSaveFilePicker = async () => { throw new DOMException('gesture expired', 'SecurityError'); };
    requestSaveAsNext();
    assert.equal(await consumeSaveAsNext(blob, 'file.txt'), false);
    await assert.rejects(saveFileWithPicker(blob, 'file.txt'), { name: 'SecurityError' });
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else delete (globalThis as any).window;
  }
});
