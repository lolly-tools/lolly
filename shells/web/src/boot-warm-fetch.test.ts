// SPDX-License-Identifier: MPL-2.0
/**
 * The pre-paint warm fetch in index.html, and the two things that depend on its shape.
 *
 * index.html starts the slim tool index's request at HTML parse and parks the promise on
 * `window.__lollyBootFetch[<path>]`; catalog/sync.ts's loadSlimToolIndex adopts it by that
 * exact path string. Nothing at runtime notices if the two drift: the adopt lookup simply
 * misses, sync.ts fetches normally, and the cold load quietly pays for the same file twice
 * again - which is the regression scripts/check-first-load.ts caught in the first place,
 * and it only runs against a deployment.
 *
 * The third assertion is about the build: vite.config.js's slimIndexWarm() strips the whole
 * script from a key-pinned release (which never reads a slim index) and THROWS when its
 * regex matches nothing, so a reworded script would fail the release build. Checking the
 * match here means that failure shows up at commit time instead.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { SLIM_WARM_SCRIPT } from '../vite.config.js';

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(webDir, 'index.html'), 'utf8');
const syncSrc = readFileSync(path.join(webDir, 'src/catalog/sync.ts'), 'utf8');

/** The one path both sides have to spell identically. */
const SLIM_PATH = '/catalog/tools/index.slim.json';

test('index.html starts the slim-index fetch and parks it for adoption', () => {
  const script = html.match(SLIM_WARM_SCRIPT)?.[0];
  assert.ok(
    script,
    'no warm script in index.html - slimIndexWarm() would throw on a release build'
  );
  assert.match(
    script,
    /fetch\(/,
    'the warm must be a real fetch, not a preload hint a fetch cannot adopt'
  );
  assert.match(
    script,
    /__lollyBootFetch/,
    'the promise has to be parked where adoptBootFetch looks'
  );
  assert.ok(script.includes(`'${SLIM_PATH}'`), `the warm must name ${SLIM_PATH}`);
  assert.match(
    script,
    /'sbt-tool-index' in localStorage/,
    'only visitors with no cached index ask for this file'
  );
});

test('loadSlimToolIndex adopts the boot fetch by the same path', () => {
  assert.match(
    syncSrc,
    /adoptBootFetch\(slimPath\)/,
    'loadSlimToolIndex must try the adoption first'
  );
  // sync.ts builds the path from CATALOG_BASE; check the two compose to the same string.
  const base = syncSrc.match(/const CATALOG_BASE = '([^']+)'/)?.[1];
  assert.ok(base, 'CATALOG_BASE not found in catalog/sync.ts');
  assert.equal(`${base}/tools/index.slim.json`, SLIM_PATH);
});

test('the warm script is the only thing in index.html that names the slim index', () => {
  const hits = html.split(SLIM_PATH).length - 1;
  assert.equal(hits, 1, 'a second reference would be a second request the strip does not remove');
});

test('a signed release removes only the warm script and keeps the mobile document head', () => {
  const source = new JSDOM(html);
  const release = new JSDOM(html.replace(SLIM_WARM_SCRIPT, ''));
  try {
    const original = source.window.document;
    const built = release.window.document;
    const warm = original.getElementById('lolly-slim-index-warm');
    assert.ok(warm, 'the warm fetch needs its own build marker');
    warm.remove();
    const elements = (doc: Document) => Array.from(doc.head.children, (el) => el.outerHTML);
    assert.deepEqual(
      elements(built),
      elements(original),
      'all other head elements must survive the signed build'
    );
    assert.equal(built.querySelectorAll('meta[name="viewport"]').length, 1);
    assert.equal(
      built.querySelector('meta[name="viewport"]')?.getAttribute('content'),
      'width=device-width, initial-scale=1.0, viewport-fit=cover'
    );
    assert.equal(built.getElementById('lolly-slim-index-warm'), null);
  } finally {
    source.window.close();
    release.window.close();
  }
});

/** Run the warm script in a page whose storage `seed` prepares; returns the urls it fetched. */
async function runWarm(seed: (dom: JSDOM) => Promise<void> | void): Promise<string[]> {
  const script = html.match(SLIM_WARM_SCRIPT)?.[0];
  assert.ok(script);
  const body = script.replace(/^\s*<script[^>]*>/, '').replace(/<\/script>$/, '');
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://team.example/', runScripts: 'outside-only' });
  try {
    await seed(dom);
    const fetched: string[] = [];
    (dom.window as unknown as { fetch: (u: string) => Promise<Response> }).fetch = (u: string) => {
      fetched.push(u);
      return Promise.resolve(new Response('{}'));
    };
    dom.window.eval(body);
    return fetched;
  } finally {
    dom.window.close();
  }
}

test('a visitor this instance refused last time does not ask for the slim index again', async () => {
  assert.deepEqual(await runWarm(() => {}), [SLIM_PATH], 'control: a cold visitor warms the slim index');
  // The key is written by the real catalog-access module, so the script and the
  // module cannot drift apart on its spelling.
  const fetched = await runWarm(async (dom) => {
    const g = globalThis as unknown as Record<string, unknown>;
    const saved = { window: g.window, document: g.document, localStorage: g.localStorage };
    Object.assign(g, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage });
    try {
      const { _setBaseForTests } = await import('./lib/instance.ts');
      _setBaseForTests('');
      (await import('./lib/catalog-access.ts')).noteCatalogRefused();
    } finally {
      Object.assign(g, saved);
    }
  });
  assert.deepEqual(fetched, [], 'signed out on a gated instance: no request that can only answer 401');
});


async function runAssetWarm(seed: (dom: JSDOM) => void): Promise<string[]> {
  const script = html.match(/<script id="lolly-asset-index-warm">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, 'the asset warm fetch must survive signed builds');
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://team.example/', runScripts: 'outside-only' });
  try {
    seed(dom);
    const fetched: string[] = [];
    (dom.window as unknown as { fetch: (u: string) => Promise<Response> }).fetch = url => {
      fetched.push(url);
      return Promise.resolve(Response.json({ assets: [] }));
    };
    dom.window.eval(script);
    return fetched;
  } finally { dom.window.close(); }
}

test('a fresh document warms only its uncached asset index', async () => {
  assert.deepEqual(await runAssetWarm(() => {}), ['/catalog/assets/index.json']);
  for (const key of ['sbt-tool-index', 'sbt-catalog:assets-index', 'lolly:catalog-refused:same-origin']) {
    assert.deepEqual(await runAssetWarm(dom => dom.window.localStorage.setItem(key, '1')), [], key);
  }
  assert.deepEqual(await runAssetWarm(dom => {
    (dom.window as unknown as { __TAURI_INTERNALS__: object }).__TAURI_INTERNALS__ = {};
  }), [], 'native shells wait for their instance choice');
});
