// SPDX-License-Identifier: MPL-2.0
/**
 * Boot order on a cold gallery visit (plan 371, M2b): the gallery's code starts at the top
 * of boot, every route other than the gallery and the dashboard still waits for the whole
 * catalog, and a slim first paint still mounts again when the full catalog arrives.
 *
 * Run directly:  node --test shells/web/src/boot-order.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ── main.ts wiring ───────────────────────────────────────────────────────────

const main = readFileSync(new URL('./main.ts', import.meta.url), 'utf8');
const boot = main.slice(main.indexOf('async function boot('));

test('the gallery code starts at the top of boot, for the routes that show the gallery, unawaited', () => {
  const start = boot.indexOf("void import('./views/gallery.ts')");
  assert.ok(start > 0, 'boot starts the gallery import');
  assert.ok(start < boot.indexOf('createBridge()'), 'before the bridge opens');
  assert.ok(start < boot.indexOf('const host = await hostReady;'), 'before boot waits for the bridge');
  const line = boot.slice(boot.lastIndexOf('\n', start), boot.indexOf('\n', start));
  assert.match(line, /bootRoute\.name === 'gallery' \|\| bootRoute\.name === 'utilities'/);
  assert.match(line, /\.catch\(\(\) => \{\}\)/, 'a failed early fetch is left to navigate() to report');
});

test('only the gallery and the dashboard paint before the catalog, and a slim paint still mounts again when the catalog arrives', () => {
  const fast = boot.slice(boot.indexOf('const fastPath ='), boot.indexOf(';', boot.indexOf('const fastPath =')));
  assert.match(fast, /\(\(routeName === 'gallery'\) && \(haveFullIndex \|\| slimPainted\)\) \|\|\s*routeName === 'dashboard'/);
  assert.match(boot, /if \(!slimPainted && !toolIndexChanged\(\)\) return;/);
  assert.match(boot, /if \(now === 'gallery'\) \{[\s\S]*?refreshMountedView\(\);/);
});
