// SPDX-License-Identifier: MPL-2.0
/**
 * Boot order on a cold gallery visit (plan 371, M2b): the gallery's code starts at the
 * top of boot, and the full tool index waits for the first mount without ever being able
 * to hold boot up.
 *
 * The helper tests drive lib/tool-index-hold.ts. The source checks hold main.ts to the
 * wiring: where the gallery import starts, where the hold is released, that every route
 * other than the gallery and the dashboard still waits for the whole catalog, and that a
 * slim first paint still mounts again when the full catalog arrives.
 *
 * Run directly:  node --test shells/web/src/lib/tool-index-hold.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { holdToolIndex } from './tool-index-hold.ts';

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

function pending<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function released(after: Promise<void>): Promise<boolean> {
  let done = false;
  void after.then(() => { done = true; });
  await tick();
  return done;
}

test('a slim index that paints keeps the full index held until release()', async () => {
  const slim = pending(), assets = pending();
  const hold = holdToolIndex(slim.promise, assets.promise);
  slim.resolve({ tools: [{ id: 'qr-code' }] });
  assets.resolve({ response: null });
  assert.equal(await released(hold.after), false, 'held through the first mount');
  hold.release();
  assert.equal(await released(hold.after), true);
});

test('a slim index that brings nothing lets the full index go at once', async () => {
  for (const settle of [(p: ReturnType<typeof pending>) => p.resolve(null), (p: ReturnType<typeof pending>) => p.reject(new Error('offline'))]) {
    const slim = pending();
    const hold = holdToolIndex(slim.promise, pending().promise);
    settle(slim);
    assert.equal(await released(hold.after), true);
  }
});

test('a slim request that has not answered when the asset index does lets the full index go', async () => {
  const slim = pending(), assets = pending();
  const hold = holdToolIndex(slim.promise, assets.promise);
  assert.equal(await released(hold.after), false);
  assets.resolve({ response: null });
  assert.equal(await released(hold.after), true, 'a slim request that never answers holds nothing up');
});

test('release() is safe to repeat', async () => {
  const hold = holdToolIndex(pending().promise);
  hold.release();
  hold.release();
  assert.equal(await released(hold.after), true);
});

// ── main.ts wiring ───────────────────────────────────────────────────────────

const main = readFileSync(new URL('../main.ts', import.meta.url), 'utf8');
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

test('the hold is passed to the catalog sync and released after the first mount and before any wait on the catalog', () => {
  assert.match(boot, /if \(slimIndexReady && firstRoute === 'gallery'\) toolIndexHold = holdToolIndex\(slimIndexReady, earlyAssets\);/);
  assert.match(boot, /startBootCatalog\(host, coldGallery, signInRequired, earlyAssets, toolIndexHold\?\.after\)/);
  assert.match(main, /return syncCatalog\(catalogHost, welcomeFirst, welcomeSettled, signInRequired, preparedAssets, toolsAfter\)/);
  assert.match(boot, /try \{ await navigate\(host, \{ force: true \}\); \} finally \{ settleWelcomeDecision\(\); releaseToolIndex\(\); \}/);
  assert.match(boot, /\} else \{\s*releaseToolIndex\(\);\s*await catalogReady;\s*await firstNavigate\(\);/, 'routes that wait for the catalog release the hold first');
});

test('only the gallery and the dashboard paint before the catalog, and a slim paint still mounts again when the catalog arrives', () => {
  const fast = boot.slice(boot.indexOf('const fastPath ='), boot.indexOf(';', boot.indexOf('const fastPath =')));
  assert.match(fast, /\(\(routeName === 'gallery'\) && \(haveFullIndex \|\| slimPainted\)\) \|\|\s*routeName === 'dashboard'/);
  assert.match(boot, /if \(!slimPainted && !toolIndexChanged\(\)\) return;/);
  assert.match(boot, /if \(now === 'gallery'\) \{[\s\S]*?refreshMountedView\(\);/);
});
