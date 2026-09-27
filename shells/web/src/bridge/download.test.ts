// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDownload, deferredDownload, deliveryFor, outcomeOf, receiptOf, reportingDownload } from './download.ts';
import type { DeliveryReport } from './download.ts';
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

// plans/277, P9. The Tauri overrides replace the export module, and the web bridge
// reaches their download through the lazy facade (bridge/index.ts). These drive that
// exact pairing, deferredDownload around a reportingDownload implementation, with a
// native write that succeeds, fails and is cancelled.
test('a native write reports its receipt through the lazy facade; HostV1 still resolves void', async () => {
  const blob = new Blob(['rendered once']);
  const written: Array<{ blob: Blob; filename: string }> = [];
  let revealed = 0;
  let mode: 'save' | 'fail' | 'cancel' = 'save';
  const native = reportingDownload(async (data, filename): Promise<DeliveryReport> => {
    if (mode === 'fail') throw new Error('Disk full');
    if (mode === 'cancel') throw new DOMException('Save cancelled', 'AbortError');
    written.push({ blob: data, filename });
    return { saved: true, name: 'qr (1).png', place: 'Downloads/Lolly', reveal: async () => { revealed++; } };
  });
  const facade = deferredDownload(async () => native);
  const deliver = deliveryFor(facade)!;
  assert.ok(deliver, 'the facade keeps delivery evidence for a registered native download');

  const report = await deliver(blob, 'qr.png');
  assert.equal(outcomeOf(report), 'saved', 'a completed native write is a save, not a request');
  const receipt = receiptOf(report)!;
  assert.equal(receipt.name, 'qr (1).png');
  assert.equal(receipt.place, 'Downloads/Lolly');
  await receipt.reveal!();
  assert.equal(revealed, 1);
  assert.deepEqual(written, [{ blob, filename: 'qr.png' }], 'the exact bytes and asked-for name');

  assert.equal(await facade(blob, 'qr.png'), undefined, 'the HostV1 facade still resolves void');
  assert.equal(await native(blob, 'qr.png'), undefined, 'and so does the native download itself');

  mode = 'fail';
  await assert.rejects(deliver(blob, 'qr.png'), /Disk full/, 'a failed write is not reported as anything but a failure');
  await assert.rejects(facade(blob, 'qr.png'), /Disk full/);
  mode = 'cancel';
  await assert.rejects(deliver(blob, 'qr.png'), { name: 'AbortError' }, 'a dismissed dialog stays a cancellation for deliverFile to read');
});

test('an unregistered or silent native download reads exactly as before', async () => {
  const blob = new Blob(['x']);
  const calls: string[] = [];
  const legacy = deferredDownload(async () => async (_: Blob, name: string) => { calls.push(name); });
  assert.equal(await deliveryFor(legacy)!(blob, 'a.png'), 'requested', 'no registration: requested, as today');
  const bare = reportingDownload(async () => ({ saved: true }) as const);
  const plain = await deliveryFor(deferredDownload(async () => bare))!(blob, 'b.png');
  assert.equal(outcomeOf(plain), 'saved');
  assert.deepEqual(receiptOf(plain), { saved: true }, 'a receipt with no detail is a plain save');
  const junk = reportingDownload(async () => ({ saved: 'yes', name: 7 }) as unknown as DeliveryReport);
  assert.equal(await deliveryFor(junk)!(blob, 'c.png'), 'requested', 'an unrecognised report is never promoted to a save');
  const requested = reportingDownload(async () => 'requested');
  assert.equal(await deliveryFor(requested)!(blob, 'd.png'), 'requested');
  assert.deepEqual(calls, ['a.png']);
  assert.deepEqual(receiptOf({ saved: true, name: '', place: 5, reveal: 'no' }), { saved: true }, 'malformed fields are dropped, not trusted');
});
