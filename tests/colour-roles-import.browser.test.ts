// SPDX-License-Identifier: MPL-2.0
/**
 * The review of a file's colour words, in Chromium, through the real import (plans/352 R4).
 * A token file whose words suggest roles shows them before anything applies; a person
 * renames one, reads another differently and turns a third off, and the stored document holds
 * those choices. "Install without roles" installs the file as it came. A file with no words keeps
 * the card it had, a file that states its roles shows them as written, and hostile words
 * draw as text.
 *
 *   LOLLY_IMPORT_TEST_URL=http://127.0.0.1:5173 LOLLY_WEBGPU_TEST_ADAPTER=swiftshader node --import ./tests/browser-gpu.ts --test tests/colour-roles-import.browser.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page } from 'playwright';
import { shellSettled } from './helpers/shell-settled.ts';

const origin = process.env.LOLLY_IMPORT_TEST_URL;
const options = { skip: origin ? false : 'set LOLLY_IMPORT_TEST_URL to a local Vite shell', timeout: 240_000 };
type Rec = Record<string, any>;

const WORDS = { color: { $type: 'color', main: { $value: '#1b2a6b' }, accent: { $value: '#b23a48' }, supporting: { $value: '#6c7a89', $description: 'The selvedge' }, tertiary: { $value: '#d9c7a0' }, beacon: { $value: '#c9a227' }, paper: { $value: '#faf7f2' }, ink: { $value: '#1c1a17' } } };
const NO_WORDS = { color: { $type: 'color', flax: { $value: '#faf7f2' }, loom: { $value: '#1c1a17' }, weld: { $value: '#c9a227' } } };
const wefthouse = readFileSync(new URL('./fixtures/colour-roles/wefthouse.tokens.json', import.meta.url));

const launch = (): Promise<Browser> => chromium.launch({ headless: true, channel: process.env.LOLLY_BROWSER_CHANNEL });
const prepare = async (context: BrowserContext): Promise<void> => {
  await context.addInitScript(() => {
    for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack', 'lolly:ds-name-asked:default']) localStorage.setItem(key, '1');
  });
};
const stored = (page: Page): Promise<Rec> => page.evaluate(async () => {
  const path = '/src/bridge/index.ts';
  const host = await (await import(path)).createBridge();
  return host.tokens.raw();
});
const open = async (browser: Browser): Promise<{ context: BrowserContext; page: Page; errors: string[] }> => {
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await prepare(context);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${origin}/#/start?import&source=file`, { waitUntil: 'networkidle' });
  await shellSettled(page);
  await page.locator('.start-import-file').first().waitFor({ state: 'attached' });
  return { context, page, errors };
};
const give = (page: Page, name: string, body: string | Buffer, mimeType = 'application/json'): Promise<void> =>
  page.locator('.start-import-file').first().setInputFiles({ name, mimeType, buffer: Buffer.from(body) });
const installed = (page: Page): Promise<unknown> => page.waitForFunction(() => document.querySelector('.start-import-result')?.hasAttribute('hidden') || !document.querySelector('.start-import-result')?.isConnected, undefined, { timeout: 60_000 });

test('a file\'s words: shown first, editable, and stored as the person left them', options, async () => {
  const browser = await launch();
  try {
    const { page, errors, context } = await open(browser);
    const before = await stored(page);
    await give(page, 'wefthouse.json', JSON.stringify(WORDS));
    const review = page.locator('[data-colour-role-review]');
    await review.waitFor();
    assert.deepEqual(await page.locator('[data-role-label]').evaluateAll(els => els.map(el => (el as HTMLInputElement).value)), ['Main', 'Accent', 'Supporting', 'Tertiary', 'Beacon', 'Paper', 'Ink']);
    assert.equal(await page.locator('[data-role-reads="main"]').inputValue(), 'primary');
    assert.equal(await page.locator('[data-role-reads="accent"]').inputValue(), 'secondary');
    assert.equal(await page.locator('[data-role-reads="beacon"]').inputValue(), '', 'a word off the list reads by name only');
    assert.deepEqual(await stored(page), before, 'nothing applies before the button');

    await page.locator('[data-role-label="main"]').fill('Ground');
    await page.locator('[data-role-about="main"]').fill('The cloth');
    await page.locator('[data-role-reads="tertiary"]').selectOption('secondary');
    assert.equal(await page.locator('[data-role-reads="accent"]').inputValue(), '', 'each slot takes one role');
    await page.locator('[data-role-keep="beacon"]').uncheck();
    assert.equal(await page.locator('[data-role-label="beacon"]').isDisabled(), true);
    // No lead colour read, and this file has none of its own: the button waits and says why.
    await page.locator('[data-role-reads="main"]').selectOption('');
    assert.equal(await page.locator('[data-install-import]').isDisabled(), true);
    assert.equal(await page.locator('[data-role-needs-lead]').isVisible(), true);
    await page.locator('[data-role-reads="main"]').selectOption('primary');
    assert.equal(await page.locator('[data-install-import]').isDisabled(), false);

    await page.locator('[data-install-import]').click();
    await installed(page);
    const raw = await stored(page);
    const record = raw.$extensions['com.suse.lolly'].brandSystem;
    assert.deepEqual(record.roles.map((r: Rec) => [r.id, r.label]), [['main', 'Ground'], ['accent', 'Accent'], ['supporting', 'Supporting'], ['tertiary', 'Tertiary'], ['paper', 'Paper'], ['ink', 'Ink']]);
    assert.equal(record.roles[0].description, 'The cloth');
    assert.equal(record.roles[2].description, 'The selvedge');
    assert.deepEqual(record.bindings.map((b: Rec) => [b.roleId, b.consumer.slot]).sort(), [['main', 'primary'], ['paper', 'surface'], ['tertiary', 'secondary']]);
    // The Colours room reads the same record.
    await page.locator('[data-be-roles-fold] [data-crt-name]').first().waitFor();
    assert.deepEqual(await page.locator('[data-crt-name]').evaluateAll(els => els.map(el => (el as HTMLInputElement).value)), ['Ground', 'Accent', 'Supporting', 'Tertiary', 'Paper', 'Ink']);
    assert.deepEqual(errors, []);
    await context.close();
  } finally { await browser.close(); }
});

test('"Install without roles" installs the file as it came, and a file with no words keeps the card it had', options, async () => {
  const browser = await launch();
  try {
    const first = await open(browser);
    await give(first.page, 'wefthouse.json', JSON.stringify(WORDS));
    await first.page.locator('[data-colour-role-review]').waitFor();
    await first.page.locator('[data-install-plain]').click();
    await installed(first.page);
    const raw = await stored(first.page);
    assert.deepEqual(raw.color, WORDS.color, 'every colour as the file gave it');
    assert.equal(raw.$extensions?.['com.suse.lolly']?.brandSystem, undefined, 'no record');
    assert.equal(raw.$themes, undefined, 'no themes added');
    await first.context.close();

    const second = await open(browser);
    await give(second.page, 'plain.json', JSON.stringify(NO_WORDS));
    await second.page.locator('.ds-roles-card').waitFor();
    assert.equal(await second.page.locator('[data-colour-role-review]').count(), 0, 'no new step');
    assert.equal(await second.page.locator('[data-role-pick]').count() > 0, true, 'the chooser it always had');
    await second.context.close();
  } finally { await browser.close(); }
});

test('a file that states its roles shows them as written and installs them unchanged', options, async () => {
  const browser = await launch();
  try {
    const { page, context } = await open(browser);
    await give(page, 'wefthouse.tokens.json', wefthouse);
    const roster = page.locator('[data-colour-roles-declared]');
    await roster.waitFor();
    const text = await roster.innerText();
    assert.match(text, /Main/);
    assert.match(text, /The cloth's ground colour/);
    assert.match(text, /Lead colour/);
    assert.match(text, /By name only/);
    assert.equal(await roster.locator('input,select').count(), 0);
    await page.locator('[data-install-import]').click();
    await installed(page);
    const raw = await stored(page);
    const want = JSON.parse(wefthouse.toString());
    assert.deepEqual(raw.$extensions['com.suse.lolly'].brandSystem.roles, want.$extensions['com.suse.lolly'].brandSystem.roles);
    assert.deepEqual(raw['colourway/madder'], want['colourway/madder']);
    await context.close();
  } finally { await browser.close(); }
});

test('a stranger\'s DESIGN.md: its names reach the Try these colours review, and the review\'s choices are what installs', options, async () => {
  const browser = await launch();
  try {
    const { page, context, errors } = await open(browser);
    const text = '---\nversion: "alpha"\nname: Riverbank\ncolors:\n  main: "#123f6d"\n  accent: "#d9531e"\n  tertiary: "#e8dcc4"\n  surface: "#fbfaf7"\n  on-surface: "#16202a"\n---\n\n## Overview\n\nA rowing club.\n';
    await give(page, 'DESIGN.md', text, 'text/markdown');
    const review = page.locator('[data-reference-review] [data-colour-role-review]');
    await review.waitFor();
    assert.deepEqual(await review.locator('[data-role-label]').evaluateAll(els => els.map(el => (el as HTMLInputElement).value)), ['Main', 'Accent', 'Tertiary']);
    await review.locator('[data-role-label="tertiary"]').fill('Oar');
    await page.locator('[data-reference-apply]').click();
    await page.waitForFunction(() => !document.querySelector('[data-reference-review]')?.isConnected, undefined, { timeout: 60_000 });
    const raw = await stored(page);
    assert.deepEqual(raw.$extensions['com.suse.lolly'].brandSystem.roles.map((r: Rec) => r.label), ['Main', 'Accent', 'Oar']);
    assert.deepEqual(errors, []);
    await context.close();
  } finally { await browser.close(); }
});

test('hostile words draw as text, in the review, the roster and the page around them', options, async () => {
  const browser = await launch();
  try {
    const { page, context } = await open(browser);
    const hostile = '"><img src=x onerror="window.__owned=1"><script>window.__owned=1</script>';
    await give(page, 'hostile.json', JSON.stringify({ color: { $type: 'color', accent: { $value: '#b23a48', $description: hostile }, supporting: { $value: '#6c7a89' } } }));
    await page.locator('[data-colour-role-review]').waitFor();
    assert.equal(await page.locator('[data-role-about="accent"]').inputValue(), hostile, 'kept as text for the person to read');
    assert.equal(await page.locator('.start-import-result img, .start-import-result script').count(), 0);
    const doc = JSON.parse(wefthouse.toString());
    doc.$extensions['com.suse.lolly'].brandSystem.roles.find((r: Rec) => r.id === 'main').label = hostile.slice(0, 70);
    await give(page, 'hostile-record.json', JSON.stringify(doc));
    await page.locator('[data-colour-roles-declared]').waitFor();
    assert.equal(await page.locator('.start-import-result img, .start-import-result script').count(), 0);
    assert.equal(await page.evaluate(() => Reflect.get(window, '__owned')), undefined);
    await context.close();
  } finally { await browser.close(); }
});
