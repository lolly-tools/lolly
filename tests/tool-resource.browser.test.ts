// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { chromium, type Browser } from 'playwright-core';

test('browser tool libraries execute only after their requested bytes verify', { timeout: 30000 }, async () => {
  const source = 'window.fixtureLibraryLoaded = (window.fixtureLibraryLoaded || 0) + 1;';
  const expected = createHash('sha256').update(source).digest('hex');
  const seen: string[] = [];
  const server = createServer((request, response) => {
    seen.push(request.url ?? '');
    if (request.url === '/tools/demo/lib/accepted.js') { response.writeHead(200, { 'content-type': 'application/javascript' }); response.end(source); }
    else if (request.url === '/tools/demo/lib/unavailable.js') { response.writeHead(200, { 'content-type': 'application/javascript' }); response.end('changed fixture bytes'); }
    else { response.writeHead(200, { 'content-type': 'text/html' }); response.end('<!doctype html><html><head></head><body></body></html>'); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ channel: process.env.LOLLY_BROWSER_CHANNEL || 'chrome', headless: true });
    const bundle = await build({ stdin: { contents: `
      import { installVerifiedToolElements } from './shells/web/src/catalog/tool-elements.ts';
      import { createVerifiedToolFetch } from './shells/web/src/catalog/tool-bytes.ts';
      const envelope = { files: { 'demo/lib/accepted.js': '${expected}', 'demo/lib/unavailable.js': '${expected}' } };
      const checked = createVerifiedToolFetch({ fetch: window.fetch.bind(window), envelope: async () => envelope, root: () => location.origin + '/tools/', base: () => location.href });
      installVerifiedToolElements(async url => {
        const response = await checked(url);
        return URL.createObjectURL(new Blob([await response.arrayBuffer()], { type: 'application/javascript' }));
      }, () => true, () => location.origin + '/tools/');
    `, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'iife', platform: 'browser', logLevel: 'silent' });
    const page = await browser.newPage(); await page.goto(origin);
    await page.addScriptTag({ content: bundle.outputFiles[0]!.text });
    const accepted = await page.evaluate(() => new Promise<{ initial: boolean; source: string; loaded: number }>(resolve => {
      const script = document.createElement('script'); script.src = '/tools/demo/lib/accepted.js'; const initial = script.hasAttribute('src');
      script.onload = () => resolve({ initial, source: script.src, loaded: (window as unknown as { fixtureLibraryLoaded: number }).fixtureLibraryLoaded });
      document.head.appendChild(script);
    }));
    assert.equal(accepted.initial, false); assert.match(accepted.source, /^blob:/); assert.equal(accepted.loaded, 1);
    const refused = await page.evaluate(() => new Promise<{ source: string | null; loaded: number }>(resolve => {
      const script = document.createElement('script'); script.setAttribute('src', '/tools/demo/lib/unavailable.js');
      script.onerror = () => resolve({ source: script.getAttribute('src'), loaded: (window as unknown as { fixtureLibraryLoaded: number }).fixtureLibraryLoaded });
      document.head.appendChild(script);
    }));
    assert.equal(refused.source, null); assert.equal(refused.loaded, 1);
    assert.equal(seen.filter(path => path === '/tools/demo/lib/accepted.js').length, 1);
    assert.equal(seen.filter(path => path === '/tools/demo/lib/unavailable.js').length, 1);
  } finally { await browser?.close(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
