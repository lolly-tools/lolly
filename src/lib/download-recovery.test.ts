// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountDownloadRecovery, offerDownloadRecovery, deliverWithRecovery, releaseDeliveryFor } from './download-recovery.ts';
import { deliverBatchFile, releaseBackgroundDelivery } from './background-delivery.ts';
import type { DeliveryHost } from './deliver-file.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { getHostRef, setHostRef } from './host-ref.ts';
import { createClipboardAPI } from '../bridge/clipboard.ts';
import { DeliveryResult } from './delivery-result.ts';
import { consumeSaveAsNext, requestSaveAsNext, saveFileWithPicker } from '../bridge/export-save-picker.ts';

const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

/** Install a JSDOM window/document as the globals for one test; returns the restore. */
function withDom(html: string): { dom: JSDOM; restore: () => void } {
  const dom = new JSDOM(html);
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document });
  return {
    dom,
    restore: () => {
      dom.window.close();
      if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else delete (globalThis as any).window;
      if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument); else delete (globalThis as any).document;
    },
  };
}

const buttons = (status: Element): HTMLButtonElement[] => [...status.querySelectorAll<HTMLButtonElement>('button')];
const byText = (status: Element, text: string): HTMLButtonElement | undefined => buttons(status).find(b => b.textContent === text);

test('clipboard fallback retains its generated image when the first file write fails', async () => {
  const { restore } = withDom('<main></main>');
  const previous = getHostRef();
  const blob = new Blob(['prepared image'], { type: 'image/png' });
  let calls = 0;
  const host = { export: { download: async (data: Blob, name: string) => {
    assert.equal(data, blob); assert.equal(name, 'image.png');
    if (++calls === 1) throw new Error('Induced clipboard fallback failure');
  } } } as HostV1;
  try {
    setHostRef(host);
    assert.deepEqual(await createClipboardAPI().writeImage(blob), { method: 'download' });
    const result = document.querySelector('.background-delivery')!;
    assert.match(result.textContent!, /Induced clipboard fallback failure/);
    byText(result, 'Retry download')!.click(); await tick();
    assert.equal(calls, 2);
    assert.match(result.textContent!, /Download requested/);
  } finally { releaseBackgroundDelivery(); setHostRef(previous as HostV1); restore(); }
});

test('failed first delivery and a background retry retain exactly one prepared archive', async () => {
  const { restore } = withDom('<div id="owner"><p role="status"></p></div>');
  const owner = document.querySelector<HTMLElement>('#owner')!;
  const surface = owner.querySelector('p')!;
  const blob = new Blob(['already encrypted archive']);
  const writes: Blob[] = [];
  let fail = true;
  const host = { export: { download: async (data: Blob, filename: string) => {
    writes.push(data);
    assert.equal(filename, 'event.zip');
    if (fail) throw new Error('Disk unavailable');
  } } } as DeliveryHost;
  try {
    const first = await deliverWithRecovery(owner, surface, { blob, filename: 'event.zip', label: 'Three outputs' }, host);
    assert.equal(first.state, 'failed');
    assert.equal(first.file?.blob, blob);
    assert.match(surface.textContent!, /Disk unavailable/);
    fail = false;
    await first.retry();
    assert.equal(first.state, 'requested');
    assert.deepEqual(writes, [blob, blob]);
    releaseDeliveryFor(owner);
    assert.equal(first.file, null);

    owner.remove();
    const second = await deliverBatchFile(owner, surface, { blob, filename: 'event.zip', label: 'Three outputs' }, host);
    const visible = document.querySelector<HTMLElement>('.background-delivery')!;
    assert.ok(visible.isConnected, 'a detached batch owner has a visible recovery surface');
    await second.retry();
    assert.equal(writes.at(-1), blob);
    byText(visible, 'Dismiss')!.click();
    assert.equal(second.disposed, true);
    assert.equal(document.querySelector('.background-delivery'), null);
  } finally { releaseDeliveryFor(owner); releaseBackgroundDelivery(); restore(); }
});

test('download recovery preserves the file, opens the picker on the click, and confirms only a closed write', async () => {
  const { restore } = withDom('<p role="status">File ready.</p>');
  const blob = new Blob(['prepared archive'], { type: 'application/x-penpot' });
  const status = document.querySelector('p')!;
  let cleanup = (): void => {};
  try {
    // No picker in this browser: an ordinary Retry is still offered, plus honest guidance,
    // and nothing can promise a disk-write acknowledgement.
    const unsupported = offerDownloadRecovery(status, blob, 'component.penpot', 'Saved.');
    assert.equal(byText(status, 'Save file…'), undefined, 'no dialog this browser cannot open');
    assert.ok(byText(status, 'Retry download'), 'the plain retry remains');
    assert.match(status.textContent!, /download permissions/);
    unsupported();
    assert.equal(buttons(status).length, 0);
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
    const button = byText(status, 'Save file…')!;
    assert.ok(button, 'the picker is the first control where it exists');
    assert.match(status.textContent!, /component\.penpot/, 'the retained file is labelled');
    button.click();
    assert.equal(calls, 1, 'the picker must open synchronously within the click');
    assert.equal(button.disabled, true);
    button.click();
    assert.equal(calls, 1, 'a second click while saving starts nothing');
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
    assert.equal(buttons(status).length, 0);
    (window as any).showSaveFilePicker = () => { throw new Error('disposed button must not open a picker'); };
    button.click();
    await tick();
  } finally {
    cleanup();
    restore();
  }
});

test('retry re-delivers the same bytes through the owner-supplied path and reports a request, not a save', async () => {
  const { restore } = withDom('<p role="status"></p>');
  const status = document.querySelector('p')!;
  try {
    const blob = new Blob(['poster'], { type: 'application/pdf' });
    const delivered: Blob[] = [];
    const result = new DeliveryResult(
      { blob, filename: 'poster.pdf', label: 'Export from 12:04' },
      async (b) => { delivered.push(b); return 'requested'; },
    );
    const unmount = mountDownloadRecovery(status, result, { ready: 'File ready.', saved: 'Saved.' });
    assert.match(status.textContent!, /Export from 12:04/, 'the label says which export this is');
    const retry = byText(status, 'Retry download')!;
    retry.click();
    assert.equal(retry.disabled, true);
    await tick();
    assert.equal(delivered.length, 1);
    assert.equal(delivered[0], blob, 'the exact retained bytes');
    assert.match(status.textContent!, /Download requested/);
    assert.doesNotMatch(status.textContent!, /Saved\./, 'an anchor path never claims a save');
    assert.equal(retry.disabled, false);

    // Unmounting the control leaves the owner's result alone.
    unmount();
    assert.equal(buttons(status).length, 0);
    assert.equal(result.disposed, false);
    assert.ok(result.file);
    result.dispose();
  } finally {
    restore();
  }
});

test('a result replaced or released cannot repaint the surface from a late completion', async () => {
  const { restore } = withDom('<p role="status"></p>');
  const status = document.querySelector('p')!;
  try {
    let release!: (o: 'saved') => void;
    const result = new DeliveryResult(
      { blob: new Blob(['a']), filename: 'a.txt', label: 'Export A' },
      () => new Promise<'saved'>(resolve => { release = resolve; }),
    );
    const unmount = mountDownloadRecovery(status, result, { ready: 'File ready.', saved: 'Saved.' });
    byText(status, 'Retry download')!.click();
    assert.match(status.textContent!, /Saving/);
    // The owner moves on: a newer export replaces this one.
    unmount();
    result.dispose();
    status.textContent = 'A newer file is ready.';
    release('saved');
    await tick();
    assert.equal(status.textContent, 'A newer file is ready.', 'the stale completion painted nothing');
  } finally {
    restore();
  }
});

test('Save As preserves cancellation and refusal without starting an anchor download', async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const blob = new Blob(['file']);
  const win = { showSaveFilePicker: async (): Promise<never> => { throw new DOMException('cancel', 'AbortError'); } };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
  try {
    requestSaveAsNext();
    assert.equal(await consumeSaveAsNext(blob, 'file.txt'), 'cancelled');
    assert.equal(await consumeSaveAsNext(blob, 'file.txt'), null);
    win.showSaveFilePicker = async () => { throw new DOMException('gesture expired', 'SecurityError'); };
    requestSaveAsNext();
    await assert.rejects(consumeSaveAsNext(blob, 'file.txt'), { name: 'SecurityError' });
    assert.equal(await consumeSaveAsNext(blob, 'file.txt'), null);
    await assert.rejects(saveFileWithPicker(blob, 'file.txt'), { name: 'SecurityError' });
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else delete (globalThis as any).window;
  }
});
