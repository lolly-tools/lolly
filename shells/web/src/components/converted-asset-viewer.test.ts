// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { _setBaseForTests } from '../lib/instance.ts';
import { mountConvertedAssetViewer } from './converted-asset-viewer.ts';

test('a converted preview is asked of the connected instance, not of the app\'s own server', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://lolly.tools' });
  Object.assign(globalThis, { document: dom.window.document, location: dom.window.location });
  _setBaseForTests('https://work.example');
  const seen: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push(`${init?.method ?? 'GET'} ${String(input)}`);
    return String(input).includes('file-preview') ? new Response('', { status: 500 }) : new Response(new Uint8Array([1, 2, 3]));
  }) as typeof fetch;
  try {
    const root = dom.window.document.querySelector<HTMLElement>('#root')!;
    await mountConvertedAssetViewer(root, { id: 'inst/a', groupId: 'inst/a', fileId: null, revision: '', format: 'eps', kind: 'converted', originalUrl: 'https://work.example/catalog/inst/a/file', name: 'a.eps' }, new AbortController().signal);
    root.querySelector('button')!.click();
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.ok(seen.includes('POST https://work.example/api/v1/catalog/file-preview'), seen.join('\n'));
    assert.ok(!seen.some(line => line.startsWith('POST /') || line.includes('lolly.tools/api')), 'nothing is posted to the app\'s own origin');
  } finally {
    globalThis.fetch = realFetch;
    _setBaseForTests('');
  }
});
