// SPDX-License-Identifier: MPL-2.0
/** LOLLY_IMPORT_TEST_URL=http://127.0.0.1:5188 LOLLY_BROWSER_CHANNEL=chrome node --test tests/brand-recovery.browser.test.ts */
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { journeyDiagnostics } from './helpers/journey-diagnostics.ts';
import { shellSettled } from './helpers/shell-settled.ts';

const origin = process.env.LOLLY_IMPORT_TEST_URL;

// A node:test timeout fails the test but does not stop its body, so a wait that never
// settles keeps the persistent browser open and the file never exits: on CI that held
// the whole browser shard for six hours. This closes whatever is still open.
let open: BrowserContext | undefined;
after(async () => { await open?.close().catch(() => {}); });

/** Resolves on the next popstate, or fails by name instead of waiting for the test timeout. */
function nextPopstate(page: Page, what: string): Promise<void> {
  const seen = page.evaluate(() => new Promise<void>(resolve => window.addEventListener('popstate', () => resolve(), { once: true })));
  const late = new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`no popstate within 20s after ${what}`)), 20_000).unref());
  return Promise.race([seen, late]);
}
test('brand recovery survives a browser restart and preserves the settings it replaced', {
  skip: origin ? false : 'set LOLLY_IMPORT_TEST_URL to a local Vite shell', timeout: 120_000,
}, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const profile = await mkdtemp(join(tmpdir(), 'lolly-recovery-browser-'));
  const launch = () => chromium.launchPersistentContext(profile, {
    headless: true, channel: process.env.LOLLY_BROWSER_CHANNEL,
    viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce',
  });
  let context = await launch();
  open = context;
  let diagnose = journeyDiagnostics(context, 'brand-recovery');
  try {
    await context.addInitScript(() => {
      for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1');
    });
    let page = context.pages()[0]!;
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/#/start?area=color`, { waitUntil: 'networkidle' }); await shellSettled(page);
    const id = await page.evaluate(async () => {
      const bridgePath = '/src/bridge/index.ts', studioPath = '/src/lib/design-system/studio-state.ts';
      const { createBridge } = await import(bridgePath);
      const { createStudioState } = await import(studioPath);
      const studio = createStudioState(await createBridge());
      await studio.load();
      const doc = (color: string) => ({ color: { brand: { primary: { $type: 'color', $value: color } } } });
      await studio.install(doc('#0071ce'), 'test-blue');
      const id = await studio.checkpoint('Original company blue');
      await studio.install(doc('#ffc220'), 'test-yellow');
      return id;
    });
    await page.reload({ waitUntil: 'networkidle' }); await shellSettled(page);
    await page.getByRole('button', { name: 'Restore brand settings', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Restore brand settings' });
    await dialog.getByLabel('Checkpoint').selectOption(id);
    await dialog.getByRole('button', { name: 'Restore checkpoint', exact: true }).focus();
    await page.keyboard.press('Enter');
    await dialog.getByRole('status').filter({ hasText: 'Brand settings restored.' }).waitFor();
    // Closing a modal consumes its same-URL history entry asynchronously.
    const firstClose = nextPopstate(page, 'Escape closed the dialog');
    await page.keyboard.press('Escape');
    await firstClose;
    await dialog.waitFor({ state: 'detached' });
    assert.match(page.url(), /#\/start/);
    assert.deepEqual(errors, []);
    await context.close();
    context = await launch();
    open = context;
    diagnose = journeyDiagnostics(context, 'brand-recovery-restarted');
    page = context.pages()[0]!;
    await page.goto(`${origin}/#/start?area=color`, { waitUntil: 'networkidle' }); await shellSettled(page);
    const read = () => page.evaluate(async () => {
      const path = '/src/bridge/index.ts';
      return (await (await (await import(path)).createBridge()).tokens.raw()).color.brand.primary.$value;
    });
    assert.equal(await read(), '#0071ce');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { document.documentElement.dataset.a11yText = 'large'; });
    await page.getByRole('button', { name: 'Restore brand settings', exact: true }).click();
    const restored = page.getByRole('dialog', { name: 'Restore brand settings' });
    const undo = await restored.getByLabel('Checkpoint').locator('option').filter({ hasText: 'Before restore' }).getAttribute('value');
    assert.ok(undo);
    await restored.getByLabel('Checkpoint').selectOption(undo);
    const bounds = await restored.boundingBox();
    assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 391);
    await restored.getByRole('button', { name: 'Restore checkpoint', exact: true }).click();
    await restored.getByRole('status').filter({ hasText: 'Brand settings restored.' }).waitFor();
    const secondClose = nextPopstate(page, 'Close closed the dialog');
    await restored.getByRole('button', { name: 'Close', exact: true }).click();
    await secondClose;
    await page.reload({ waitUntil: 'networkidle' }); await shellSettled(page);
    assert.equal(await read(), '#ffc220');
  } catch (error) { await diagnose(error); throw error; } finally { await context.close(); open = undefined; await rm(profile, { recursive: true, force: true }); }
});
