// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { packChromeExtension } from '../scripts/pack-chrome-extension.ts';

test('an installed extension shows protected approval and returns cancellation without visiting the target', {
  skip: existsSync(chromium.executablePath()) ? false : 'Install Playwright Chromium for extension approval coverage',
  timeout: 30_000,
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lolly-extension-browser-'));
  const extension = join(directory, 'extension');
  await packChromeExtension({ development: true, outputDir: extension });
  const context = await chromium.launchPersistentContext(join(directory, 'profile'), {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    let targetVisits = 0;
    await context.route('http://localhost:5173/consent-fixture', route => route.fulfill({ contentType: 'text/html', body: '<main>Lolly fixture</main>' }));
    await context.route('https://target.example.test/page', route => {
      targetVisits++;
      return route.fulfill({ contentType: 'text/html', body: '<main>Target fixture</main>' });
    });
    const page = await context.newPage();
    await page.goto('http://localhost:5173/consent-fixture');
    await page.waitForFunction(() => !!(window as unknown as Record<string, unknown>).__lollyCapture);
    const approvalOpened = context.waitForEvent('page');
    await page.evaluate(() => {
      window.addEventListener('message', event => {
        if (event.source === window && event.data?.source === 'lolly-capture/ext' && event.data.id === 'fixture-request') {
          (window as unknown as Record<string, unknown>).fixtureReply = event.data;
        }
      });
      window.postMessage({ source: 'lolly-capture/page', type: 'capture', id: 'fixture-request', spec: { url: 'https://target.example.test/page' } }, location.origin);
    });
    const approval = await approvalOpened;
    await approval.waitForURL(/chrome-extension:\/\/.+\/consent\.html\?request=/);
    await approval.getByRole('button', { name: 'Approve once' }).waitFor();
    await approval.waitForFunction(() => !(document.getElementById('approve') as HTMLButtonElement).disabled);
    assert.equal(await approval.locator('#caller').textContent(), 'http://localhost:5173');
    assert.equal(await approval.locator('#target').textContent(), 'https://target.example.test/page');
    assert.match(await approval.locator('body').innerText(), /Signed-in page contents may include private information/);
    assert.equal(targetVisits, 0);
    await approval.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.waitForFunction(() => !!(window as unknown as Record<string, unknown>).fixtureReply);
    const reply = await page.evaluate(() => (window as unknown as Record<string, unknown>).fixtureReply as { ok: boolean; error: string });
    assert.equal(reply.ok, false);
    assert.match(reply.error, /canceled/);
    assert.equal(targetVisits, 0);
  } finally {
    await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});
