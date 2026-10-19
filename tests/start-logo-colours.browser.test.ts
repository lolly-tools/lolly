// SPDX-License-Identifier: MPL-2.0
/**
 * A placed logo's colours become the roles (plan 320 S1).
 *
 * The study's bakery mark starts with a white rectangle. Placing it used to hand
 * that first colour, white, to the primary role, and every tool kept the starter
 * ink. Now the card asks which colour is the main one; on a first install the
 * likeliest answer is applied at once, so the red leads, the wordmark's brown
 * becomes the text colour, and the card says so in both rooms. Undo rewinds the
 * apply and the card asks again.
 *
 * The first edit is also what creates the person's own design system, so the
 * studio asks once what it is called (plan 320 S5), with the logo's own words
 * filled in, and the name sticks after a reload.
 *
 *   LOLLY_IMPORT_TEST_URL=http://127.0.0.1:5193 node --import ./tests/browser-gpu.ts --test tests/start-logo-colours.browser.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import { shellSettled } from './helpers/shell-settled.ts';

const origin = process.env.LOLLY_IMPORT_TEST_URL;
const CRUMB = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 160"><rect width="480" height="160" fill="#fff"/>'
  + '<circle cx="80" cy="80" r="56" fill="#C8553D"/><circle cx="62" cy="66" r="9" fill="#F6E7C8"/>'
  + '<text x="160" y="96" font-size="54" fill="#3B2A20">Crumb &amp; Co</text></svg>';

test('a placed logo leads with its ink and sets the main and text colours', {
  skip: origin ? false : 'set LOLLY_IMPORT_TEST_URL to a local Vite shell', timeout: 120_000,
}, async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.LOLLY_BROWSER_CHANNEL });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  try {
    await context.addInitScript(() => {
      for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1');
    });
    const page = await context.newPage();
    await page.goto(`${origin}/#/start`, { waitUntil: 'networkidle' }); await shellSettled(page);
    await page.locator('[data-ds-room="logos"]').first().click();
    await page.locator('[data-be-logo-multi]').setInputFiles({ name: 'crumb-logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(CRUMB) });
    await page.locator('[data-logo-place]').first().click();
    const keep = page.getByRole('button', { name: /^Keep/ });
    const card = page.locator('[data-be-logo-colours="logos"]');
    await Promise.race([card.waitFor({ state: 'visible' }), keep.first().waitFor().then(() => keep.first().click())]);
    await card.waitFor({ state: 'visible' });

    const choices = card.locator('[data-logo-colours-main]');
    assert.deepEqual(await choices.evaluateAll(els => els.map(el => (el as HTMLInputElement).value)), ['#C8553D', '#F6E7C8', '#3B2A20'], 'white is the canvas, not a choice');
    assert.equal(await card.locator('[data-logo-colours-main]:checked').inputValue(), '#C8553D');
    assert.match(await card.innerText(), /Tools now use Red\. Text uses Warm Slate Grey\./);

    await page.locator('[data-ds-room="color"]').first().click();
    const colours = page.locator('[data-be-logo-colours="color"]');
    await colours.waitFor({ state: 'visible' });
    const role = (name: string) => page.locator(`[data-be-pal] .be-swatch[aria-label^="${name} - "] .be-swatch-role`).first().innerText();
    assert.equal(await role('Red'), 'P', 'the red carries the primary role');
    assert.equal(await role('Warm Slate Grey'), 'T', 'the brown carries the text role');

    await colours.locator('[data-logo-colours-act="undo"]').click();
    await colours.locator('[data-logo-colours-act="use"]').waitFor();
    assert.match(await colours.innerText(), /Which is the main colour\?/);
    assert.equal(await page.locator('[data-be-logo-colours="logos"] [data-logo-colours-act="use"]').count(), 1, 'both rooms show the same card');
  } finally {
    await browser.close();
  }
});

test('the first edit asks once what the design system is called, from the logo', {
  skip: origin ? false : 'set LOLLY_IMPORT_TEST_URL to a local Vite shell', timeout: 120_000,
}, async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.LOLLY_BROWSER_CHANNEL });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  try {
    await context.addInitScript(() => {
      for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1');
    });
    const page = await context.newPage();
    await page.goto(`${origin}/#/start`, { waitUntil: 'networkidle' }); await shellSettled(page);
    assert.equal(await page.locator('[data-start-ds-ask]').count(), 0, 'nothing to name before the first edit');
    await page.locator('[data-ds-room="logos"]').first().click();
    await page.locator('[data-be-logo-multi]').setInputFiles({ name: 'crumb-logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(CRUMB) });
    await page.locator('[data-logo-place]').first().click();
    const keep = page.getByRole('button', { name: /^Keep/ });
    const ask = page.locator('[data-start-ds-ask]');
    await Promise.race([ask.waitFor({ state: 'visible' }), keep.first().waitFor().then(() => keep.first().click())]);
    await page.waitForFunction(() => (document.querySelector<HTMLInputElement>('[data-start-ds-ask-name]')?.value ?? '') === 'Crumb & Co');
    await ask.getByRole('button', { name: 'Save name' }).click();
    await ask.waitFor({ state: 'detached' });
    assert.equal(await page.locator('[data-start-ds-name]').inputValue(), 'Crumb & Co');

    await page.reload({ waitUntil: 'networkidle' }); await shellSettled(page);
    await page.locator('[data-start-ds-name]').waitFor();
    assert.equal(await page.locator('[data-start-ds-name]').inputValue(), 'Crumb & Co');
    assert.equal(await page.locator('[data-start-ds-ask]').count(), 0, 'asked once');
  } finally {
    await browser.close();
  }
});
