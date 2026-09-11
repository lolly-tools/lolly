// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDownload, deferredDownload, deliveryFor } from './download.ts';
import { requestSaveAsNext, cancelSaveAsNext } from './export-save-picker.ts';

test('cancel, refusal and retry keep exact bytes and never silently fall back', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const blob = new Blob(['rendered once']);
  const anchors: Blob[] = [];
  let writes = 0;
  let mode = 'cancel';
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    showSaveFilePicker: async () => {
      if (mode === 'cancel') throw new DOMException('Cancelled', 'AbortError');
      if (mode === 'refuse') throw new DOMException('Refused', 'SecurityError');
      return { createWritable: async () => ({
        write: async (bytes: Blob) => { assert.equal(bytes, blob); writes++; }, close: async () => {},
      }) };
    },
  } });
  try {
    const implementation = createDownload(bytes => anchors.push(bytes));
    const deliver = deliveryFor(deferredDownload(async () => implementation))!;
    requestSaveAsNext();
    assert.equal(await deliver(blob, 'same.svg'), 'cancelled');
    mode = 'refuse'; requestSaveAsNext();
    await assert.rejects(deliver(blob, 'same.svg'), { name: 'SecurityError' });
    assert.equal(anchors.length, 0);
    mode = 'save'; requestSaveAsNext();
    assert.equal(await deliver(blob, 'same.svg'), 'saved');
    assert.equal(writes, 1);
    assert.equal(await deliver(blob, 'same.svg'), 'requested');
    assert.deepEqual(anchors, [blob]);
  } finally {
    cancelSaveAsNext();
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('overlapping picker and ordinary download have independent outcomes', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    showSaveFilePicker: async () => ({ createWritable: async () => ({
      write: async () => pending, close: async () => {},
    }) }),
  } });
  try {
    const download = createDownload(() => {});
    const deliver = deliveryFor(download)!;
    requestSaveAsNext();
    const saved = deliver(new Blob(['a']), 'a.svg');
    assert.equal(await deliver(new Blob(['b']), 'b.svg'), 'requested');
    release();
    assert.equal(await saved, 'saved');
    assert.equal(deliveryFor(async () => {}), undefined, 'a native override is not the web delivery');
    assert.equal(await download(new Blob(['c']), 'c.svg'), undefined, 'HostV1 still returns void');
  } finally {
    release(); cancelSaveAsNext();
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
