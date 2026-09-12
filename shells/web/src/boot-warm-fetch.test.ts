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
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLIM_WARM_SCRIPT } from '../vite.config.js';

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(webDir, 'index.html'), 'utf8');
const syncSrc = readFileSync(path.join(webDir, 'src/catalog/sync.ts'), 'utf8');

/** The one path both sides have to spell identically. */
const SLIM_PATH = '/catalog/tools/index.slim.json';

test('index.html starts the slim-index fetch and parks it for adoption', () => {
  const script = html.match(SLIM_WARM_SCRIPT)?.[0];
  assert.ok(script, 'no warm script in index.html - slimIndexWarm() would throw on a release build');
  assert.match(script, /fetch\(/, 'the warm must be a real fetch, not a preload hint a fetch cannot adopt');
  assert.match(script, /__lollyBootFetch/, 'the promise has to be parked where adoptBootFetch looks');
  assert.ok(script.includes(`'${SLIM_PATH}'`), `the warm must name ${SLIM_PATH}`);
  assert.match(script, /'sbt-tool-index' in localStorage/, 'only visitors with no cached index ask for this file');
});

test('loadSlimToolIndex adopts the boot fetch by the same path', () => {
  assert.match(syncSrc, /adoptBootFetch\(slimPath\)/, 'loadSlimToolIndex must try the adoption first');
  // sync.ts builds the path from CATALOG_BASE; check the two compose to the same string.
  const base = syncSrc.match(/const CATALOG_BASE = '([^']+)'/)?.[1];
  assert.ok(base, 'CATALOG_BASE not found in catalog/sync.ts');
  assert.equal(`${base}/tools/index.slim.json`, SLIM_PATH);
});

test('the warm script is the only thing in index.html that names the slim index', () => {
  const hits = html.split(SLIM_PATH).length - 1;
  assert.equal(hits, 1, 'a second reference would be a second request the strip does not remove');
});
