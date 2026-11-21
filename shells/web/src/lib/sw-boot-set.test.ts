// SPDX-License-Identifier: MPL-2.0
/**
 * lib/sw-boot-set.ts - the page hands the service worker the build files it loaded.
 *
 * Run directly:  node --test shells/web/src/lib/sw-boot-set.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { BOOT_SET_MESSAGE, bootSetUrls, handOverBootSet } from './sw-boot-set.ts';

const ORIGIN = 'https://lolly.tools';

function page(): Document {
  return new JSDOM(`<!doctype html><html><head>
    <link rel="stylesheet" href="/_app/web-boot-b2.css">
    <link rel="preload" as="font" href="/fonts/SUSE%5Bwght%5D.woff2">
    <link rel="manifest" href="/manifest.webmanifest">
    <link rel="icon" href="/favicon.ico">
    <script type="module" src="/_app/web-boot-a1.js"></script>
    <script src="https://cdn.example/_app/other.js"></script>
  </head><body></body></html>`, { url: `${ORIGIN}/` }).window.document;
}

const entries = [
  { name: `${ORIGIN}/_app/gallery-c3.js` },
  { name: `${ORIGIN}/_app/web-boot-a1.js` },
  { name: `${ORIGIN}/catalog/tools/index.slim.json` },
  { name: `${ORIGIN}/api/auth/config` },
  { name: `${ORIGIN}/_app/x.js?v=2` },
  { name: 'https://elsewhere.example/_app/y.js' },
];

test('only same-origin build and font paths, without queries, sorted and once each', () => {
  assert.deepEqual(bootSetUrls(page(), entries, ORIGIN), [
    '/_app/gallery-c3.js', '/_app/web-boot-a1.js', '/_app/web-boot-b2.css', '/fonts/SUSE%5Bwght%5D.woff2',
  ]);
});

function container(controlled: boolean) {
  const posted: unknown[] = [];
  const listeners = new Map<string, () => void>();
  const worker = { postMessage: (data: unknown) => posted.push(data) };
  const c = {
    controller: controlled ? worker : null,
    addEventListener: (type: string, fn: () => void) => listeners.set(type, fn),
  };
  return { c: c as unknown as ServiceWorkerContainer, posted, take: () => { c.controller = worker; listeners.get('controllerchange')?.(); }, listeners };
}

const now = (fn: () => void): void => fn();

test('a controlled page hands over at the next idle moment, not before', () => {
  const { c, posted } = container(true);
  const queued: Array<() => void> = [];
  handOverBootSet(c, page(), () => entries, ORIGIN, fn => queued.push(fn));
  assert.equal(posted.length, 0, 'nothing is posted while the page is still busy');
  assert.equal(queued.length, 1);
  queued[0]!();
  assert.equal(posted.length, 1);
  assert.deepEqual(posted[0], { type: BOOT_SET_MESSAGE, urls: bootSetUrls(page(), entries, ORIGIN) });
});

test('a first visit hands over when the new worker takes control, with what has loaded by then', () => {
  const { c, posted, take, listeners } = container(false);
  const loaded = [...entries];
  handOverBootSet(c, page(), () => loaded, ORIGIN, now);
  assert.equal(posted.length, 0, 'nothing to post to before a worker controls the page');
  assert.ok(listeners.has('controllerchange'));
  loaded.push({ name: `${ORIGIN}/_app/late-d4.js` });
  take();
  assert.equal(posted.length, 1);
  assert.ok((posted[0] as { urls: string[] }).urls.includes('/_app/late-d4.js'));
});

test('the message type matches the worker, and main.ts hands over after registering', () => {
  const sw = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
  assert.match(sw, new RegExp(`const BOOT_SET_MESSAGE = '${BOOT_SET_MESSAGE}';`));
  const main = readFileSync(new URL('../main.ts', import.meta.url), 'utf8');
  assert.match(main, /navigator\.serviceWorker\.register\('\/sw\.js'\)\s*\.then\(\(\) => handOverBootSet\(navigator\.serviceWorker, document, \(\) => performance\.getEntriesByType\('resource'\), location\.origin\)\)/);
});
