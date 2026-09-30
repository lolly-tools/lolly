// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { openHtmlFile } from './html-unpack.ts';
import { setPendingUtility, takePendingUtility } from '../lib/utility-handoff.ts';

test('utility handoffs retain original bytes, select a destination and consume once', async () => {
  const file = new File(['original'], 'source.html', { type: 'text/html' });
  setPendingUtility('unpack', file);
  assert.equal(takePendingUtility('prepare'), null);
  assert.equal(takePendingUtility('unpack'), file);
  assert.equal(takePendingUtility('unpack'), null);
  setPendingUtility('prepare', file);
  assert.equal(await takePendingUtility('prepare')?.text(), 'original');
});

test('HTML unpack reads text and local images without executing scripts or loading links', async () => {
  const dom = new JSDOM('<body></body>');
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { value: dom.window.document, configurable: true });
  try {
    const handle = await openHtmlFile(new Blob(['<h1>Title</h1><p>Readable text</p><script>BAD_SCRIPT</script><img src="https://example.invalid/photo.png"><img src="data:image/png;base64,aGVsbG8="><p hidden>Hidden</p><svg viewBox="0 0 20 20"><path d="M0 0H20V20Z"/></svg>']));
    assert.equal(handle.pageToText?.(0).text, 'Title\n\nReadable text');
    assert.equal((await handle.listVectors?.())?.length, 1);
    const scan = await handle.listImages?.();
    assert.equal(scan?.images.length, 1);
    assert.equal(scan?.skipped, 1);
    assert.equal(new TextDecoder().decode(scan?.images[0]?.bytes), 'hello');
  } finally {
    if (original) Object.defineProperty(globalThis, 'document', original);
    else Reflect.deleteProperty(globalThis, 'document');
    dom.window.close();
  }
});
