// SPDX-License-Identifier: MPL-2.0
// The apps serve the page from their own bundle and the catalog from an instance on
// another origin. A separate file from tool-elements.test.ts because the guard installs
// once per realm, with one instance root.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<html><head></head><body></body></html>', { url: 'tauri://localhost/' });
Object.assign(globalThis, { location: dom.window.location, Element: dom.window.Element, HTMLScriptElement: dom.window.HTMLScriptElement, HTMLLinkElement: dom.window.HTMLLinkElement, HTMLImageElement: dom.window.HTMLImageElement, HTMLMediaElement: dom.window.HTMLMediaElement, HTMLSourceElement: dom.window.HTMLSourceElement, HTMLIFrameElement: dom.window.HTMLIFrameElement, Event: dom.window.Event });
const { installVerifiedToolElements } = await import('./tool-elements.ts');
const pending = new Map<string, { resolve(url: string): void; reject(error: Error): void }>();
installVerifiedToolElements(url => new Promise((resolve, reject) => pending.set(url, { resolve, reject })), () => true, () => 'https://work.example.test/tools/');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('a root-relative tool script in the app is read from the instance, not the app bundle', async () => {
  const script = dom.window.document.createElement('script');
  script.src = '/tools/susecon-background/lib/orb.js';
  dom.window.document.head.appendChild(script);
  assert.equal(script.hasAttribute('src'), false, 'the bundle never receives the request');
  pending.get('https://work.example.test/tools/susecon-background/lib/orb.js')!.resolve('blob:verified-orb');
  await tick();
  assert.equal(script.getAttribute('src'), 'blob:verified-orb');
});

test('a root-relative address outside the catalog still loads from the app itself', () => {
  const script = dom.window.document.createElement('script');
  script.src = '/_app/chunk.js';
  assert.equal(script.getAttribute('src'), '/_app/chunk.js');
  assert.equal(pending.has('https://work.example.test/_app/chunk.js'), false);
});

test("a root-relative catalog picture is read from the instance too", async () => {
  const img = dom.window.document.createElement('img');
  dom.window.document.body.appendChild(img);
  img.setAttribute('src', '/catalog/previews/demo.svg');
  assert.equal(img.hasAttribute('src'), false);
  assert.ok(pending.has('https://work.example.test/catalog/previews/demo.svg'));
});
