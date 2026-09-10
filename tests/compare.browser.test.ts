// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin = process.env.LOLLY_HISTORY_TEST_URL;
const skip = origin ? false : 'LOLLY_HISTORY_TEST_URL not set (serve the web shell locally)';
if (origin) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));

test('Compare utility: real worker, keyboard, files, report privacy and mobile layout', { skip, timeout: 90_000 }, async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.goto(`${origin}/#/compare`, { waitUntil: 'networkidle' });
    await page.getByRole('textbox', { name: 'Before text', exact: true }).fill('unchanged\nCONFIDENTIAL_REMOVED\n');
    await page.getByRole('textbox', { name: 'After text', exact: true }).fill('unchanged\nreplacement\n');
    await page.getByRole('button', { name: 'Compare', exact: true }).click();
    await page.getByText('1 change found', { exact: true }).waitFor();
    assert.equal(await page.locator('.compare-change[open]').count(), 0);
    await page.getByRole('button', { name: 'Next change' }).click();
    assert.equal(await page.locator('.compare-change summary').evaluate(el => document.activeElement === el), true);
    await page.keyboard.press('Enter');
    await page.locator('.compare-pair pre', { hasText: 'CONFIDENTIAL_REMOVED' }).waitFor();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download comparison report' }).click();
    const stream = await (await download).createReadStream();
    let report = ''; for await (const chunk of stream!) report += chunk.toString();
    assert.doesNotMatch(report, /CONFIDENTIAL|replacement|text-0|Before text/);
    assert.equal(JSON.parse(report).summary.changed, 1);
    await page.getByRole('button', { name: 'Swap sides' }).click();
    await page.getByText('1 change found', { exact: true }).waitFor();
    await page.getByRole('checkbox', { name: 'Show changed values' }).check();
    assert.match(await page.locator('.compare-pair section').first().innerText(), /replacement/);
    await page.getByRole('textbox', { name: 'Before text', exact: true }).fill('edited again');
    assert.equal(await page.locator('.compare-change').count(), 0, 'input edits clear stale results');
    await page.getByLabel('Comparison mode', { exact: true }).selectOption('json');
    await page.getByLabel('Before file', { exact: true }).setInputFiles({ name: 'before.json', mimeType: 'application/json', buffer: Buffer.from('{"a":1,"b":2}') });
    await page.getByLabel('After file', { exact: true }).setInputFiles({ name: 'after.json', mimeType: 'application/json', buffer: Buffer.from('{ "b": 2, "a": 1 }') });
    await page.getByRole('button', { name: 'Compare', exact: true }).click();
    await page.getByText('The compared content is equivalent with these options.', { exact: true }).waitFor();
    const cancellation = await page.evaluate(async () => {
      const path = '/src/lib/host-ref.ts'; const host = (await import(path)).getHostRef();
      const controller = new AbortController();
      const side = { identity: { id: 'cancel', kind: 'text', label: 'Cancel' }, content: { kind: 'text', text: 'x\n'.repeat(10_000) } };
      const pending = host.compare.run({ version: 1, before: side, after: { ...side, content: { kind: 'text', text: 'y\n'.repeat(10_000) } } }, { signal: controller.signal });
      controller.abort();
      try { await pending; return 'resolved'; } catch (error) { return error instanceof Error ? error.name : 'unknown'; }
    });
    assert.equal(cancellation, 'AbortError');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { document.documentElement.dataset.a11yText = 'large'; document.documentElement.dataset.a11yContrast = 'high'; });
    await page.evaluate(() => window.scrollTo(0, 0));
    assert.ok(await page.locator('.compare-page').evaluate(el => el.scrollWidth <= el.clientWidth));
    await page.screenshot({ path: 'plans/229-compare-evidence/utility-mobile.png', fullPage: true });
    const lightColor = await page.locator('.compare-page h1').evaluate(el => getComputedStyle(el).color);
    await page.evaluate(async () => { const path = '/src/theme.ts'; (await import(path)).applyTheme('dark', false); });
    assert.notEqual(await page.locator('.compare-page h1').evaluate(el => getComputedStyle(el).color), lightColor, 'text follows the active theme');
    const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, url: location.href }));
    assert.doesNotMatch(storage, /CONFIDENTIAL_REMOVED|edited again/);
  } finally { await browser.close(); }
});

test('History compares retained or current snapshots without changing saved or live state', { skip, timeout: 90_000 }, async () => {
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.goto(`${origin}/#/compare`, { waitUntil: 'networkidle' });
    const before = await page.evaluate(async () => {
      const path = '/src/lib/host-ref.ts', panel = '/src/components/history-panel.ts';
      const host = (await import(path)).getHostRef(), history = host.state.history;
      const first = await history.checkpoint('design:compare-test', { __toolId: 'design', __label: 'Original', text: 'old confidential text' }, { reason: 'save', expectedHead: null });
      await history.checkpoint('design:compare-test', { __toolId: 'design', __label: 'Current', text: 'saved text' }, { reason: 'save', expectedHead: first.id });
      const live = { __toolId: 'design', text: 'unsaved text' };
      (await import(panel)).openHistoryPanel({ state: host.state, slot: () => 'design:compare-test', currentSnapshot: () => live });
      return { state: await host.state.load('design:compare-test'), head: await history.head('design:compare-test'), live };
    });
    const entries = page.locator('.revision-history-entry'); await entries.first().waitFor();
    await entries.nth(1).getByRole('checkbox', { name: 'Compare', exact: true }).check();
    await page.getByRole('button', { name: 'Compare with current' }).click();
    await page.getByText('1 change found', { exact: true }).waitFor();
    await page.getByRole('checkbox', { name: 'Show changed values' }).check();
    await page.locator('.compare-pair pre', { hasText: 'unsaved text' }).waitFor();
    await page.getByRole('button', { name: 'Clear comparison' }).click();
    await entries.nth(0).getByRole('checkbox', { name: 'Compare', exact: true }).check();
    await entries.nth(1).getByRole('checkbox', { name: 'Compare', exact: true }).check();
    await page.getByText('1 change found', { exact: true }).waitFor();
    const after = await page.evaluate(async () => {
      const path = '/src/lib/host-ref.ts'; const host = (await import(path)).getHostRef();
      return { state: await host.state.load('design:compare-test'), head: await host.state.history.head('design:compare-test') };
    });
    assert.deepEqual(after.state, before.state); assert.equal(after.head, before.head);
    await page.screenshot({ path: 'plans/229-compare-evidence/history-desktop.png' });
  } finally { await browser.close(); }
});
