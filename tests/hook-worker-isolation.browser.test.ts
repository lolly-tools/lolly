// SPDX-License-Identifier: MPL-2.0
/** The actual browser worker must restrict ambient APIs and preserve tool RPC. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { STRICT_AMBIENT_GLOBALS, STRICT_NAVIGATOR_PROPERTIES } from '../engine/src/hook-worker-core.ts';

test('imported hooks keep asset RPC and input updates while browser prototype capabilities are disabled', {
  skip: existsSync(chromium.executablePath()) ? false : 'No Chromium installed; run pnpm exec playwright install chromium.',
  timeout: 30000,
}, async () => {
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL('../shells/web/src/bridge/hook-worker.worker.ts', import.meta.url))],
    bundle: true, write: false, format: 'esm', platform: 'browser', target: 'esnext',
  });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== 'https://lolly-isolation.test') return route.abort();
      if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Worker contract</title>' });
      if (url.pathname === '/worker.js') return route.fulfill({ contentType: 'text/javascript', body: bundle.outputFiles[0]!.text });
      return route.abort();
    });
    const page = await context.newPage();
    await page.goto('https://lolly-isolation.test/');
    for (const strict of [true, false]) {
      const result = await page.evaluate(async ({ strict, globals, navigatorProperties }) => {
        const hooksSource = `
          function liveProperties(receiver, names) {
            const live = [];
            for (const name of names) {
              for (let owner = receiver; owner; owner = Object.getPrototypeOf(owner)) {
                const descriptor = Object.getOwnPropertyDescriptor(owner, name);
                if (descriptor && (descriptor.get || descriptor.set || descriptor.value !== undefined)) {
                  live.push(name); break;
                }
              }
            }
            return live;
          }
          async function onInit({ host }) {
            const asset = await host.assets.get('fixture/logo');
            return {
              label: asset.meta.name,
              globals: liveProperties(globalThis, ${JSON.stringify(globals)}),
              navigator: liveProperties(navigator, ${JSON.stringify(navigatorProperties)})
            };
          }
          function onInput({ values }) { return { label: values.label.toUpperCase() }; }
        `;
        return new Promise<{ initial: { label: string; globals: string[]; navigator: string[] }; updated: { label: string }; assetCalls: number }>((resolve, reject) => {
          const worker = new Worker('/worker.js', { type: 'module' });
          let initial: { label: string; globals: string[]; navigator: string[] };
          let assetCalls = 0;
          const timer = setTimeout(() => fail('worker timeout'), 10000);
          function fail(message: string): void { clearTimeout(timer); worker.terminate(); reject(new Error(message)); }
          worker.onerror = event => fail(event.message);
          worker.onmessage = event => {
            const message = event.data;
            if (message.t === 'init-done') {
              if (message.compileError) return fail(message.compileError);
              worker.postMessage({ t: 'invoke', runId: 1, callId: 1, name: 'onInit', ctx: {} });
            } else if (message.t === 'host-call') {
              if (message.method !== 'assets.get' || message.args[0] !== 'fixture/logo') return fail('unexpected host call');
              assetCalls++;
              worker.postMessage({ t: 'host-reply', runId: 1, hostCallId: message.hostCallId, ok: true, value: { meta: { name: 'Imported logo' } } });
            } else if (message.t === 'invoke-done') {
              if (!message.ok) return fail(message.error);
              if (message.callId === 1) {
                initial = message.patch;
                worker.postMessage({ t: 'invoke', runId: 1, callId: 2, name: 'onInput', ctx: { values: { label: 'Updated import' } } });
              } else {
                clearTimeout(timer); worker.terminate(); resolve({ initial, updated: message.patch, assetCalls });
              }
            }
          };
          worker.postMessage({ t: 'init', runId: 1, strict, hooksSource, tokenDoc: null, tokenExcluded: [], hostShape: { assets: ['get'] }, seeds: {}, shell: 'web', capabilities: [] });
        });
      }, { strict, globals: [...STRICT_AMBIENT_GLOBALS], navigatorProperties: [...STRICT_NAVIGATOR_PROPERTIES] });
      assert.equal(result.initial.label, 'Imported logo');
      assert.equal(result.updated.label, 'UPDATED IMPORT');
      assert.equal(result.assetCalls, 1);
      if (strict) {
        assert.deepEqual(result.initial.globals, []);
        assert.deepEqual(result.initial.navigator, []);
      } else {
        assert.ok(result.initial.globals.includes('fetch'));
        assert.ok(result.initial.globals.includes('indexedDB'));
        assert.ok(result.initial.navigator.includes('storage'));
      }
    }
    assert.equal(await page.evaluate(() => typeof fetch), 'function');
  } finally { await browser.close(); }
});
