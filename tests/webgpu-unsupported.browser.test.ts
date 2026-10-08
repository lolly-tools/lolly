// SPDX-License-Identifier: MPL-2.0
/**
 * The WebGPU requirement on the real shell (plan 295, section 2). The startup check runs
 * alongside boot, so the gallery may paint first, but a failed check must replace the
 * view with the unsupported-environment card (with its Reload button) and no route may
 * mount a tool afterwards. Each case breaks the API with an init script, so it runs
 * before any of the shell's own code.
 *
 *   LOLLY_IMPORT_TEST_URL=http://127.0.0.1:4187 node --test tests/webgpu-unsupported.browser.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Browser, Page } from 'playwright-core';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';

const origin = process.env.LOLLY_IMPORT_TEST_URL;
const skip = origin ? false : 'set LOLLY_IMPORT_TEST_URL to a local Vite shell';

const DISMISSED = ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack'];

async function openShell(browser: Browser, breakApi: (dismissed: string[]) => void): Promise<Page> {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
  await context.addInitScript(breakApi, DISMISSED);
  return context.newPage();
}

async function expectCard(page: Page, code: string): Promise<void> {
  const card = page.locator(`#view [data-webgpu-unsupported="${code}"]`);
  await card.waitFor({ timeout: 60_000 });
  assert.equal(await card.getByRole('button', { name: 'Reload', exact: true }).isVisible(), true);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.webgpu), 'unsupported');
}

/** Move to a tool route and prove navigate() answered it with the card, not a mount. */
async function expectToolRefused(page: Page, code: string): Promise<void> {
  await page.evaluate(() => {
    document.querySelector('[data-webgpu-unsupported]')?.remove();
    location.hash = '#/tool/qr-code';
  });
  await expectCard(page, code);
  await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('#tool-canvas').count(), 0, 'no tool canvas mounts');
  assert.equal(await page.locator('#view.tool-view').count(), 0, 'the view never becomes a tool view');
  assert.equal(await page.locator('dialog.view-loading[open]').count(), 0, 'no loading card is left open');
}

test('without navigator.gpu a deep link to a tool shows the card, and Reload reloads', { skip, timeout: 120_000 }, async () => {
  const browser = await getBrowser();
  try {
    const page = await openShell(browser, (dismissed) => {
      for (const key of dismissed) localStorage.setItem(key, '1');
      delete (Navigator.prototype as { gpu?: unknown }).gpu;
    });
    await page.goto(`${origin}/#/tool/qr-code`, { waitUntil: 'domcontentloaded' });
    await expectCard(page, 'WEBGPU_REQUIRED');
    await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('#tool-canvas').count(), 0, 'the deep-linked tool never mounts');
    await page.evaluate(() => { location.hash = '#/'; });
    await expectCard(page, 'WEBGPU_REQUIRED');
    assert.equal(await page.locator('#view .gtile').count(), 0, 'the gallery does not mount after a failure either');
    const reloaded = page.waitForEvent('load');
    await page.getByRole('button', { name: 'Reload', exact: true }).click();
    await reloaded;
    await expectCard(page, 'WEBGPU_REQUIRED');
    await expectToolRefused(page, 'WEBGPU_REQUIRED');
  } finally { await closeBrowser(); }
});

test('an adapter request that answers null replaces the painted gallery and refuses tools', { skip, timeout: 120_000 }, async () => {
  const browser = await getBrowser();
  try {
    // The adapter answer is held until the test releases it, so the gallery has painted
    // first: the path where a failure must tear down a view that is already showing.
    const page = await openShell(browser, (dismissed) => {
      for (const key of dismissed) localStorage.setItem(key, '1');
      const held = window as unknown as { __releaseAdapter?: () => void };
      const gpu = (globalThis as unknown as { GPU: { prototype: { requestAdapter: () => Promise<null> } } }).GPU;
      gpu.prototype.requestAdapter = () => new Promise(resolve => { held.__releaseAdapter = () => resolve(null); });
    });
    await page.goto(`${origin}/#/`, { waitUntil: 'domcontentloaded' });
    await page.locator('#view .gtile').first().waitFor({ timeout: 25_000 });
    assert.equal(await page.evaluate(() => document.documentElement.dataset.webgpu ?? 'pending'), 'pending', 'the gallery painted before the check settled');
    await page.waitForFunction(() => typeof (window as unknown as { __releaseAdapter?: unknown }).__releaseAdapter === 'function');
    await page.evaluate(() => (window as unknown as { __releaseAdapter: () => void }).__releaseAdapter());
    await expectCard(page, 'WEBGPU_UNAVAILABLE');
    assert.equal(await page.locator('#view .gtile').count(), 0, 'the gallery is gone');
    assert.equal(await page.locator('#view.gallery-view').count(), 0, 'and so is its scoping class');
    await expectToolRefused(page, 'WEBGPU_UNAVAILABLE');
  } finally { await closeBrowser(); }
});

test('a page that is not a secure context names plain HTTP instead of the browser', { skip, timeout: 120_000 }, async () => {
  const browser = await getBrowser();
  try {
    // What a self-hosted copy served over http:// to another machine looks like: no
    // secure context, so the browser withholds navigator.gpu entirely.
    const page = await openShell(browser, (dismissed) => {
      for (const key of dismissed) localStorage.setItem(key, '1');
      Object.defineProperty(window, 'isSecureContext', { get: () => false });
      delete (Navigator.prototype as { gpu?: unknown }).gpu;
    });
    await page.goto(`${origin}/#/`, { waitUntil: 'domcontentloaded' });
    await expectCard(page, 'WEBGPU_INSECURE_CONTEXT');
    assert.match(await page.locator('#view [data-webgpu-unsupported]').innerText(), /plain HTTP/);
    await expectToolRefused(page, 'WEBGPU_INSECURE_CONTEXT');
  } finally { await closeBrowser(); }
});
