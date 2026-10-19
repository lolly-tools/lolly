// SPDX-License-Identifier: MPL-2.0
/**
 * The tool sidebar's Design system section through a real web shell (plans/319 A4).
 *
 * The page is given the public Lolly Start design system lifted to three
 * colourways (Main, Persimmon, Waterhole) through the automation global, the
 * way the CLI's browser tier gives a page a system. QR Code is opened with a
 * value in its link, so no template chooser stands in the way. What this pins:
 *   - the section shows itself, open, with the colourway row first: one named
 *     dot per lead, the canonical one chosen, one tab stop;
 *   - a click and an arrow key each move the canvas `--brand-primary` and the
 *     address `_themes`, while the app's own `--brand-primary` on `:root` stays
 *     on the canonical lead (plans/319 A1);
 *   - the mode switch redraws the dots in the dark leads;
 *   - a link that asks for a colourway opens with that dot chosen;
 *   - a tool that draws no design-system colour (Prompt Card) shows no section,
 *     because neither the colourway nor light and dark would change its output
 *     (plans/319 decision 9).
 *
 *   LOLLY_EXPORT_TEST_URL=http://127.0.0.1:5173 node --import ./tests/css-stub.mjs --test tests/tool-colourway.browser.test.ts
 */
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { readFileSync } from 'node:fs';
import type { Page } from 'playwright-core';

import { closeBrowser, getBrowser } from '../packages/node-shell/src/browsers.ts';
import { addColourway, liftToColourways } from '../engine/src/colourway.ts';

const origin = process.env.LOLLY_EXPORT_TEST_URL;
const skip = origin ? false : 'set LOLLY_EXPORT_TEST_URL';

const LEADS = {
  persimmon: { name: 'Persimmon', light: ['#c2410c', '#ffffff', '#7c2d12'], dark: ['#fb923c', '#111111', '#fed7aa'] },
  waterhole: { name: 'Waterhole', light: ['#2453ff', '#ffffff', '#0c1f6e'], dark: ['#7ea2ff', '#0b1020', '#c7d6ff'] },
} as const;

/** Lolly Start with a canonical colourway (`main`) and two more. */
function threeLeads(): Record<string, unknown> {
  const start = JSON.parse(readFileSync(new URL('../brands/lolly-start/catalog/assets/lolly/tokens/brand.json', import.meta.url), 'utf8'));
  const lifted = liftToColourways(start, { id: 'main', name: 'Main' });
  assert.ok(lifted.ok);
  let doc = lifted.doc;
  for (const [id, lead] of Object.entries(LEADS)) {
    const values = (slots: readonly string[]) => ({ primary: slots[0]!, 'on-primary': slots[1]!, secondary: slots[2]! });
    const added = addColourway(doc, { id, name: lead.name, values: { light: values(lead.light), dark: values(lead.dark) } });
    assert.ok(added.ok);
    doc = added.doc;
  }
  return doc;
}

const canvasPrimary = (page: Page): Promise<string> => page.evaluate(() =>
  getComputedStyle(document.querySelector('#tool-canvas')!).getPropertyValue('--brand-primary').trim().toLowerCase());
const chromePrimary = (page: Page): Promise<string> => page.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim().toLowerCase());
const themesInAddress = (page: Page): Promise<Record<string, string> | null> => page.evaluate(() => {
  const hash = location.hash;
  const query = hash.startsWith('#/') ? hash.slice(hash.indexOf('?') + 1) : location.search.slice(1);
  const raw = new URLSearchParams(query).get('_themes');
  return raw ? JSON.parse(raw) : null;
});
// One browser for the file, closed after the last case whichever cases ran.
after(() => closeBrowser());

const waitCanvas = (page: Page, hex: string): Promise<unknown> => page.waitForFunction((want) =>
  getComputedStyle(document.querySelector('#tool-canvas')!).getPropertyValue('--brand-primary').trim().toLowerCase() === want, hex);

test('the Design system section offers the colourways as named dots and moves only the canvas', { skip, timeout: 300_000 }, async () => {
  const doc = threeLeads();
  const browser = await getBrowser();
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } });
  await context.addInitScript((d) => { (window as unknown as Record<string, unknown>).__lollyAutomationDesignSystem = d; }, doc);
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    await page.goto(`${new URL(origin!).origin}/#/tool/qr-code?url=${encodeURIComponent('https://lolly.tools')}`, { waitUntil: 'load' });
    const section = page.locator('#theme-section');
    await section.waitFor({ state: 'visible', timeout: 120_000 });
    await page.locator('dialog.view-loading[open]').waitFor({ state: 'hidden', timeout: 60_000 }).catch(() => {});

    assert.equal(await section.evaluate((el) => (el as HTMLDetailsElement).open), true, 'a colourway to pick opens the section');
    const rows = section.locator('.theme-choice');
    assert.equal(await rows.first().getAttribute('data-theme-kind'), 'swatches', 'the colourway row leads');
    const dots = section.locator('.theme-swatch');
    assert.deepEqual(await dots.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label'))), ['Main', 'Persimmon', 'Waterhole']);
    assert.deepEqual(await dots.evaluateAll((els) => els.map((el) => el.getAttribute('aria-checked'))), ['true', 'false', 'false']);
    assert.deepEqual(await dots.evaluateAll((els) => els.map((el) => (el as HTMLElement).tabIndex)), [0, -1, -1]);
    const canonical = await chromePrimary(page);
    assert.equal(await canvasPrimary(page), canonical, 'the canvas opens on the canonical lead');

    // A click.
    await dots.nth(1).click();
    await waitCanvas(page, LEADS.persimmon.light[0]);
    await page.waitForFunction(() => document.querySelectorAll('.theme-swatch')[1]?.getAttribute('aria-checked') === 'true');
    assert.equal((await themesInAddress(page))?.colourway, 'persimmon');
    assert.equal(await chromePrimary(page), canonical, 'the app keeps the canonical lead');

    // The keyboard: the chosen dot is the tab stop, and an arrow key chooses the next.
    await dots.nth(1).focus();
    await page.keyboard.press('ArrowRight');
    await waitCanvas(page, LEADS.waterhole.light[0]);
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Waterhole', 'focus follows the choice');
    assert.equal((await themesInAddress(page))?.colourway, 'waterhole');

    // The mode: the dots show the leads of the look in force.
    await section.locator('.badge-select-opt', { hasText: 'Dark' }).click();
    await waitCanvas(page, LEADS.waterhole.dark[0]);
    await page.waitForFunction((want) => (document.querySelectorAll('.theme-swatch')[1] as HTMLElement | undefined)?.style.getPropertyValue('--theme-swatch-lead') === want, LEADS.persimmon.dark[0]);
    assert.deepEqual(await themesInAddress(page), { colourway: 'waterhole', '': 'dark' });
    assert.equal(await chromePrimary(page), canonical);

    // A link that asks for a colourway opens in that colourway.
    const link = `${new URL(origin!).origin}/#/tool/qr-code?url=${encodeURIComponent('https://lolly.tools')}&_themes=${encodeURIComponent('{"colourway":"persimmon"}')}`;
    await page.goto('about:blank');
    await page.goto(link, { waitUntil: 'load' });
    await section.waitFor({ state: 'visible', timeout: 120_000 });
    await waitCanvas(page, LEADS.persimmon.light[0]);
    await page.waitForFunction(() => document.querySelectorAll('.theme-swatch')[1]?.getAttribute('aria-checked') === 'true');
  } catch (error) {
    for (const page of context.pages()) {
      console.error('Colourway section failure state', await page.evaluate(() => ({
        url: location.href,
        section: document.querySelector('#theme-section')?.outerHTML.slice(0, 6000),
        dialogs: [...document.querySelectorAll('dialog[open]')].map((dialog) => dialog.outerHTML.slice(0, 2000)),
      })).catch(() => null));
    }
    throw error;
  } finally {
    await context.close();
  }
});

test('a tool that draws no design-system colour shows no Design system section', { skip, timeout: 300_000 }, async () => {
  const browser = await getBrowser();
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } });
  await context.addInitScript((d) => { (window as unknown as Record<string, unknown>).__lollyAutomationDesignSystem = d; }, threeLeads());
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    await page.goto(`${new URL(origin!).origin}/#/tool/prompt-card?text=${encodeURIComponent('Write the release notes.')}`, { waitUntil: 'load' });
    await page.locator('#tool-inputs .input-row').first().waitFor({ state: 'visible', timeout: 120_000 });
    await page.locator('dialog.view-loading[open]').waitFor({ state: 'hidden', timeout: 60_000 }).catch(() => {});
    // The controller has read the design system once the canvas carries its variables.
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#tool-canvas')!).getPropertyValue('--brand-primary').trim() !== '');
    await page.waitForTimeout(500);
    assert.equal(await page.locator('#theme-section').isHidden(), true, 'neither a colourway nor light and dark changes this tool');
  } finally {
    await context.close();
  }
});
