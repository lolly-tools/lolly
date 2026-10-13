// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<html><head></head><body></body></html>', { url: 'https://catalog.example.test/' });
Object.assign(globalThis, { location: dom.window.location, Element: dom.window.Element, HTMLScriptElement: dom.window.HTMLScriptElement, HTMLLinkElement: dom.window.HTMLLinkElement, HTMLImageElement: dom.window.HTMLImageElement, HTMLMediaElement: dom.window.HTMLMediaElement, HTMLSourceElement: dom.window.HTMLSourceElement, HTMLIFrameElement: dom.window.HTMLIFrameElement, Event: dom.window.Event });
const { installVerifiedToolElements } = await import('./tool-elements.ts');
const pending = new Map<string, { resolve(url: string): void; reject(error: Error): void }>();
installVerifiedToolElements(url => new Promise((resolve, reject) => pending.set(url, { resolve, reject })), () => true, () => 'https://catalog.example.test/tools/');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
test('dynamic tool scripts and styles have no loadable address until their bytes verify', async () => {
  const script = dom.window.document.createElement('script'); script.src = '/tools/demo/lib/loader.js'; dom.window.document.head.appendChild(script);
  assert.equal(script.hasAttribute('src'), false);
  pending.get('https://catalog.example.test/tools/demo/lib/loader.js')!.resolve('blob:verified-script'); await tick(); assert.equal(script.getAttribute('src'), 'blob:verified-script');
  const link = dom.window.document.createElement('link'); link.setAttribute('href', '/tools/demo/styles.css'); link.rel = 'stylesheet'; dom.window.document.head.appendChild(link);
  assert.equal(link.hasAttribute('href'), false);
  pending.get('https://catalog.example.test/tools/demo/styles.css')!.resolve('blob:verified-style'); await tick(); assert.equal(link.getAttribute('href'), 'blob:verified-style');
});
test('failed, replaced and detached child reads never attach their returned bytes', async () => {
  const script = dom.window.document.createElement('script'); let failed = 0; script.onerror = () => { failed++; }; dom.window.document.head.appendChild(script);
  script.setAttribute('src', '/tools/demo/lib/unavailable.js'); pending.get('https://catalog.example.test/tools/demo/lib/unavailable.js')!.reject(new Error('fixture unavailable')); await tick(); assert.equal(failed, 1); assert.equal(script.hasAttribute('src'), false);
  script.src = '/tools/demo/lib/old.js'; script.src = 'blob:current-script'; pending.get('https://catalog.example.test/tools/demo/lib/old.js')!.resolve('blob:old-script'); await tick(); assert.equal(script.getAttribute('src'), 'blob:current-script');
  script.src = '/tools/demo/lib/detached.js'; script.remove(); pending.get('https://catalog.example.test/tools/demo/lib/detached.js')!.resolve('blob:detached-script'); await tick(); assert.equal(script.getAttribute('src'), 'blob:current-script');
});
