// SPDX-License-Identifier: MPL-2.0
/** LOLLY_IMPORT_TEST_URL=http://127.0.0.1:5193 LOLLY_BROWSER_CHANNEL=chrome node --test tests/brand-derive.browser.test.ts */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { journeyDiagnostics } from './helpers/journey-diagnostics.ts';

const origin = process.env.LOLLY_IMPORT_TEST_URL;
test('reference onboarding previews locally, applies exact colours, and restores the previous design system', {
  skip: origin ? false : 'set LOLLY_IMPORT_TEST_URL to a local Vite shell', timeout: 120_000,
}, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const browser = await chromium.launch({ headless: true, channel: process.env.LOLLY_BROWSER_CHANNEL });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, hasTouch: true, reducedMotion: 'reduce' });
  const diagnose = journeyDiagnostics(context, 'brand-derive');
  try {
    await context.addInitScript(() => {
      for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1');
    });
    const page = await context.newPage();
    const errors: string[] = [], external: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await context.route('https://example.invalid/**', route => { external.push(route.request().url()); return route.abort(); });
    await page.goto(`${origin}/#/start?source=page`, { waitUntil: 'networkidle' });
    const read = () => page.evaluate(async () => {
      const path = '/src/bridge/index.ts';
      return (await (await import(path)).createBridge()).tokens.raw();
    });
    const before = await read();
    const refused = await page.evaluate(async () => {
      const path = '/src/views/start/tokens.ts';
      const { install } = await import(path);
      const button = document.createElement('button');
      let message = '';
      const state = {
        installing: false, host: {}, importResult: document.createElement('div'), shell: document.body,
        studio: { load: async () => {}, doc: () => ({ existing: true }), checkpoint: async () => { throw new Error('checkpoint refused'); } },
      };
      await install(state, {}, 'Example', button, { requireCheckpoint: true, onError: (text: string) => { message = text; } });
      return { message, busy: state.installing, disabled: button.disabled };
    });
    assert.match(refused.message, /checkpoint refused/);
    assert.equal(refused.busy, false);
    assert.equal(refused.disabled, false);
    const dialog = page.getByRole('dialog', { name: 'Add from…', exact: true });
    await dialog.locator('[data-page-files]').setInputFiles([
      { name: 'index.html', mimeType: 'text/html', buffer: Buffer.from('<title>Terracotta</title><script>window.referenceExecuted=true</script><link rel="stylesheet" href="https://example.invalid/a.css"><img src="https://example.invalid/a.png">') },
      { name: 'site.css', mimeType: 'text/css', buffer: Buffer.from('body{background:#fafafa;color:#102030;font-family:Example Font}button{background:#ee5533}a{color:#2078cc}') },
    ]);
    await dialog.getByRole('button', { name: 'Find colours and fonts', exact: true }).click();
    const review = dialog.locator('[data-reference-review]');
    await review.waitFor();
    assert.equal(await review.evaluate(el => el === document.activeElement), true);
    assert.equal(await review.locator('input[type=radio]:checked').count(), 1);
    assert.deepEqual(await read(), before, 'scanning must not install anything');
    assert.deepEqual(external, []);
    assert.equal(await page.evaluate(() => Reflect.get(window, 'referenceExecuted')), undefined);
    await review.getByRole('radio', { name: '#2078cc', exact: true }).check();
    await review.getByText('Palette, source details and individual choices', { exact: true }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download'), review.getByRole('button', { name: 'Download design context', exact: true }).click(),
    ]);
    const report = JSON.parse(await readFile((await download.path())!, 'utf8'));
    assert.equal(report.format, 'lolly-reference');
    assert.match(report.source.sha256, /^[a-f0-9]{64}$/);
    assert.ok(!JSON.stringify(report).includes('referenceExecuted'));
    await page.screenshot({ path: '/tmp/lolly-brand-derive-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 768, height: 1024 });
    assert.equal(await review.evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { document.documentElement.dataset.a11yText = 'large'; });
    const geometry = await review.evaluate(el => ({
      overflow: el.scrollWidth > el.clientWidth + 1,
      targets: Array.from(el.querySelectorAll('button, summary, .ds-reference-choice')).map(n => n.getBoundingClientRect().height),
    }));
    assert.equal(geometry.overflow, false);
    assert.ok(geometry.targets.every(h => h >= 44));
    await page.screenshot({ path: '/tmp/lolly-brand-derive-mobile.png', fullPage: true });
    await review.getByRole('button', { name: 'Apply suggested settings', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
    const after = await read();
    assert.deepEqual(after.light.color, report.proposedTokens.light.color);
    assert.deepEqual(after.dark.color, report.proposedTokens.dark.color);
    assert.deepEqual(after.base.color, report.proposedTokens.base.color);
    assert.match(page.url(), /area=overview/);
    await page.getByRole('button', { name: 'Restore brand settings', exact: true }).click();
    const restore = page.getByRole('dialog', { name: 'Restore brand settings', exact: true });
    // Applying a reference is an import, so recovery leads with undoing it and
    // keeps the checkpoint list folded away.
    const undo = restore.getByRole('button', { name: 'Undo last import', exact: true });
    await undo.waitFor();
    assert.equal(await restore.getByRole('button', { name: 'Restore checkpoint', exact: true }).count(), 0);
    await undo.click();
    await restore.waitFor({ state: 'detached' });
    const restored = await read();
    assert.deepEqual(restored.light, before.light);
    assert.deepEqual(restored.dark, before.dark);
    await page.goto(`${origin}/#/start?source=page`);
    await dialog.getByText('Paste HTML or CSS instead', { exact: true }).click();
    await dialog.getByLabel('Source format', { exact: true }).selectOption('css');
    await dialog.getByLabel('Page source', { exact: true }).fill('h1{font-family:Only A Name}');
    await dialog.getByRole('button', { name: 'Find colours and fonts', exact: true }).click();
    await dialog.getByText('No usable colours found.', { exact: false }).waitFor();
    assert.equal(await dialog.locator('[data-reference-apply]').count(), 0);
    await dialog.getByRole('button', { name: 'Change reference', exact: true }).click();
    await dialog.getByLabel('Page source', { exact: true }).fill('body{color:#aabbcc}');
    assert.equal(await dialog.locator('[data-reference-review]').count(), 0, 'editing source clears stale review');
    await dialog.getByRole('button', { name: 'Find colours and fonts', exact: true }).click();
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    assert.deepEqual((await read()).light, before.light);
    await page.goto(`${origin}/#/start?source=image`);
    await dialog.getByLabel('Choose an image', { exact: true }).setInputFiles({
      name: 'logo.svg', mimeType: 'image/svg+xml',
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#ffffff"/><circle cx="60" cy="40" r="28" fill="#cc4411"/></svg>'),
    });
    await dialog.locator('[data-reference-review]').waitFor();
    await dialog.getByText('Palette, source details and individual choices', { exact: true }).click();
    await dialog.getByText('Colours were read from this SVG.', { exact: false }).waitFor();
    assert.deepEqual((await read()).light, before.light, 'an image also waits for explicit application');
    await dialog.getByRole('button', { name: 'Choose individual items in the tray', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
    assert.deepEqual((await read()).light, before.light, 'keeping candidates does not install the suggested look');
    await page.goto(`${origin}/#/start?area=color`);
    await page.locator('[data-ds-addc-file]').setInputFiles({
      name: 'colour-room.svg', mimeType: 'image/svg+xml',
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#2277cc"/></svg>'),
    });
    await dialog.locator('[data-reference-review]').waitFor();
    assert.deepEqual((await read()).light, before.light, 'the colour room also opens a read-only review');
    assert.deepEqual(errors, []);
  } catch (error) { await diagnose(error); throw error; } finally { await context.close(); await browser.close(); }
});
