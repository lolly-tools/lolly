// SPDX-License-Identifier: MPL-2.0
/**
 * The automatic Performance UI switch in a real Chromium on a software adapter
 * (SwiftShader, as CI's browser lane and LOLLY_WEBGPU_TEST_ADAPTER=swiftshader give):
 * it switches at start-up and says so, Keep and Undo do what they say across a reload,
 * Settings shows when and why, and a hand choice stops the detector.
 *
 * An automated browser never runs the detector on its own, so every page here opts in
 * with the probe key (lib/perf-ui-auto.ts PERF_UI_AUTO_PROBE_KEY). The decision maths
 * is covered with synthetic frames in shells/web/src/lib/perf-ui-auto-detect.test.ts.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { shellSettled } from './helpers/shell-settled.ts';

const origin = process.env.LOLLY_EXPORT_TEST_URL;
const skip = origin ? false : 'Set LOLLY_EXPORT_TEST_URL (serve the web shell locally)';
if (origin) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));

const PROBE = 'lolly:perfUiAuto:probe';
const RECORD = 'lolly:perfUiAuto';

/** A context that skips the first-run welcome and, when `probe`, opts into the detector. */
async function context(browser: Browser, probe = true): Promise<BrowserContext> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, reducedMotion: 'reduce' });
  await ctx.addInitScript(({ probeKey, on }) => {
    if (!location.protocol.startsWith('http')) return;
    for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1');
    if (on) localStorage.setItem(probeKey, '1');
  }, { probeKey: PROBE, on: probe });
  return ctx;
}

async function open(page: Page, hash = '#/'): Promise<void> {
  await page.goto(`${origin}/${hash}`, { waitUntil: 'networkidle' });
  await shellSettled(page);
}

/** What the page's own WebGPU adapter says: the test only expects a switch on software. */
async function softwareAdapter(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const adapter = await (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ info?: { architecture?: string; vendor?: string; isFallbackAdapter?: boolean } } | null> } }).gpu?.requestAdapter();
    const info = adapter?.info;
    return info?.isFallbackAdapter === true || /swiftshader|llvmpipe|lavapipe/i.test(`${info?.vendor} ${info?.architecture}`);
  });
}

const perfUi = (page: Page): Promise<boolean> => page.evaluate(() => document.documentElement.hasAttribute('data-perf-ui'));
const record = (page: Page): Promise<Record<string, unknown> | null> =>
  page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), RECORD);

test('a software renderer switches the Performance UI on at start-up, with Undo and Keep', { skip, timeout: 180_000 }, async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await context(browser);
    const page = await ctx.newPage();
    await open(page);
    if (!(await softwareAdapter(page))) {
      // A browser with real graphics acceleration must not switch at start-up.
      await page.waitForTimeout(3000);
      assert.equal(await perfUi(page), false, 'hardware: no switch');
      assert.equal(await record(page), null);
      return;
    }
    await page.waitForFunction(() => document.documentElement.hasAttribute('data-perf-ui'), undefined, { timeout: 60_000 });
    const toast = page.locator('.undo-toast--wrap');
    await toast.waitFor();
    assert.match(await toast.locator('.undo-toast-msg').innerText(), /simpler, faster look because this device draws without graphics acceleration/);
    assert.deepEqual(await toast.locator('.undo-toast-btn').allInnerTexts(), ['Undo', 'Keep']);
    assert.deepEqual(await record(page).then(r => r && { state: r.state, reason: r.reason }), { state: 'on', reason: 'software' });

    // Keep: stays on, the notice is not shown again, and the look is there before first paint.
    await toast.getByRole('button', { name: 'Keep' }).click();
    assert.equal(await toast.count(), 0);
    assert.equal((await record(page))?.seen, true);
    await page.goto(`${origin}/#/`, { waitUntil: 'commit' });
    await page.waitForFunction(() => document.readyState !== 'loading');
    assert.equal(await perfUi(page), true, 'the pre-paint script applies the stored decision');
    await shellSettled(page);
    await page.waitForTimeout(1500);
    assert.equal(await page.locator('.undo-toast--wrap').count(), 0, 'no second notice');

    // Settings: the switch is on, with the date and the reason under the switch.
    await open(page, '#/settings?focus=feature-flags-section');
    const control = page.locator('#feature-flags [data-flag="perf-ui"]');
    await control.waitFor({ state: 'attached' });
    assert.equal(await control.isChecked(), true);
    const note = page.locator('#ff-perf-ui-auto');
    assert.match(await note.innerText(), /^Turned on automatically on .+ because this device draws without graphics acceleration\.$/);
    assert.equal(await control.getAttribute('aria-describedby'), 'ff-perf-ui-auto');
    await ctx.close();

    // Undo: off, and never automatic again on this device.
    const ctx2 = await context(browser);
    const page2 = await ctx2.newPage();
    await open(page2);
    await page2.locator('.undo-toast--wrap').waitFor({ timeout: 60_000 });
    await page2.getByRole('button', { name: 'Undo' }).click();
    assert.equal(await perfUi(page2), false);
    assert.equal((await record(page2))?.state, 'undone');
    await open(page2);
    await page2.waitForTimeout(3000);
    assert.equal(await perfUi(page2), false, 'no second switch after Undo');
    assert.equal(await page2.locator('.undo-toast--wrap').count(), 0);
    await ctx2.close();
  } finally { await browser.close(); }
});

test('a hand choice in Settings outranks the automatic switch', { skip, timeout: 180_000 }, async () => {
  const browser = await chromium.launch();
  try {
    // First visit without the probe: nothing automatic runs, so the person chooses first.
    const ctx = await context(browser, false);
    const page = await ctx.newPage();
    await open(page, '#/settings?focus=feature-flags-section');
    const label = page.locator('label[for="ff-perf-ui"]');
    await label.waitFor();
    await label.click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('lolly:featureFlags') || '{}')['perf-ui'] === true);
    await label.click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('lolly:featureFlags') || '{}')['perf-ui'] === false);
    // Now opt in and start again on a software adapter: the hand choice (off) stands.
    await page.evaluate(key => localStorage.setItem(key, '1'), PROBE);
    await open(page);
    await page.waitForTimeout(4000);
    assert.equal(await perfUi(page), false);
    assert.equal(await record(page), null, 'the detector never even ran');
    assert.equal(await page.locator('.undo-toast--wrap').count(), 0);
    await ctx.close();
  } finally { await browser.close(); }
});
