// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { installStaleShellRecovery, looksLikeChunkError } from './stale-shell.ts';

function fixture(native = false) {
  const dom = new JSDOM('<html><head></head><body><main id="view">Tools</main></body></html>', { url: 'https://shell.example.test/' });
  let recoveries = 0;
  installStaleShellRecovery(dom.window as unknown as Window, native, () => { recoveries++; });
  const reject = (reason: Error) => {
    const event = new dom.window.Event('unhandledrejection', { cancelable: true });
    Object.defineProperty(event, 'reason', { value: reason });
    dom.window.dispatchEvent(event);
    return event;
  };
  const fail = (tag: string, address: string, attributes: Record<string, string> = {}) => {
    const element = dom.window.document.createElement(tag);
    element.setAttribute(tag === 'script' ? 'src' : 'href', address);
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    dom.window.document.head.append(element);
    element.dispatchEvent(new dom.window.Event('error'));
  };
  return { dom, reject, fail, recoveries: () => recoveries };
}

test('ordinary network errors are not evidence of a stale app', () => {
  for (const message of ['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.', 'Tool unavailable']) {
    assert.equal(looksLikeChunkError(new TypeError(message)), false);
  }
  for (const message of ['Failed to fetch dynamically imported module: /assets/view-123.js', 'Importing a module script failed.', 'Unable to preload CSS for /assets/view-123.css']) {
    assert.equal(looksLikeChunkError(new Error(message)), true);
  }
  const f = fixture();
  assert.equal(f.reject(new TypeError('Failed to fetch')).defaultPrevented, false);
  assert.equal(f.recoveries(), 0);
  f.dom.window.close();
});

test('handled Vite preload failures retain their rejection and leave Tools mounted', () => {
  const f = fixture();
  const event = new f.dom.window.Event('vite:preloadError', { cancelable: true });
  Object.defineProperty(event, 'payload', { value: new TypeError('Importing a module script failed.') });
  f.dom.window.dispatchEvent(event);
  assert.equal(event.defaultPrevented, false, 'Vite must still reject the import to the preview caller');
  assert.equal(f.recoveries(), 0);
  assert.equal(f.dom.window.document.getElementById('view')?.textContent, 'Tools');
  f.dom.window.close();
});

test('tool libraries, styles and prefetches cannot trigger shell recovery', () => {
  const f = fixture();
  f.fail('script', '/tools/demo/lib/loader.js');
  f.fail('link', '/tools/demo/styles.css', { rel: 'stylesheet' });
  f.fail('link', '/tools/demo/hooks.js', { rel: 'prefetch', as: 'fetch' });
  f.fail('link', '/assets/optional-123.js', { rel: 'prefetch' });
  f.fail('script', 'https://elsewhere.example.test/assets/app-123.js', { type: 'module' });
  assert.equal(f.recoveries(), 0);
  f.dom.window.close();
});

test('unhandled web app module and bundled stylesheet failures still recover', () => {
  const f = fixture();
  assert.equal(f.reject(new TypeError('Importing a module script failed.')).defaultPrevented, true);
  f.fail('script', '/assets/view-123.js', { type: 'module' });
  f.fail('link', '/assets/view-123.css?version=1', { rel: 'stylesheet' });
  assert.equal(f.recoveries(), 3);
  f.dom.window.close();
});

test('native bundled apps never auto-recover from background loading errors', () => {
  const f = fixture(true);
  f.reject(new TypeError('Importing a module script failed.'));
  f.fail('script', '/assets/view-123.js', { type: 'module' });
  f.fail('link', '/assets/view-123.css', { rel: 'stylesheet' });
  assert.equal(f.recoveries(), 0);
  f.dom.window.close();
});
