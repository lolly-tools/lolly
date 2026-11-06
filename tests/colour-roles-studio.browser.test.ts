// SPDX-License-Identifier: MPL-2.0
/**
 * The Colour roles table in the real room, in Chromium (plans/352 R2), against Wefthouse,
 * an invented four-role brand with three colourways: add a role, rename it, bind it, set
 * dark to "Same as light", switch colourway, watch In context repaint, reload and find it
 * kept. A locked system shows the table with no controls. A visit to the default state
 * writes nothing, so the document stays byte-identical. Light and dark stay side by side
 * at phone width.
 *
 *   LOLLY_IMPORT_TEST_URL=http://127.0.0.1:5173 node --import ./tests/browser-gpu.ts --test tests/colour-roles-studio.browser.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { chromium } from 'playwright';
import type { BrowserContext, Page } from 'playwright';
import { shellSettled } from './helpers/shell-settled.ts';

const origin = process.env.LOLLY_IMPORT_TEST_URL;
const options = { skip: origin ? false : 'set LOLLY_IMPORT_TEST_URL to a local Vite shell', timeout: 240_000 };
const fixture = JSON.parse(readFileSync(new URL('./fixtures/colour-roles/wefthouse.tokens.json', import.meta.url), 'utf8'));

type Rec = Record<string, any>;

const prepare = async (context: BrowserContext): Promise<void> => {
  await context.addInitScript(() => {
    for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack', 'lolly:ds-name-asked:default']) localStorage.setItem(key, '1');
  });
};

const open = async (page: Page, hash = '#/start?area=color'): Promise<void> => {
  await page.goto(`${origin}/${hash}`, { waitUntil: 'networkidle' });
  await shellSettled(page);
};

/** The stored document, read through the same bridge the room writes through. */
const stored = (page: Page): Promise<{ raw: Rec; record: Rec | null }> => page.evaluate(async () => {
  const path = '/src/bridge/index.ts';
  const host = await (await import(path)).createBridge();
  return { raw: await host.tokens.raw(), record: await host.designSystems?.active?.() ?? null };
});

const install = (page: Page, doc: unknown): Promise<void> => page.evaluate(async (d) => {
  const bridge = '/src/bridge/index.ts', tokens = '/src/bridge/tokens.ts';
  const host = await (await import(bridge)).createBridge();
  await (await import(tokens)).installUserTokens(host, d, { labelIfNew: 'Wefthouse' });
}, doc);

const saved = (page: Page): Promise<unknown> => page.locator('.be-palette [data-be-save-state]').filter({ hasText: /^Saved$/ }).waitFor();
const names = (page: Page): Promise<string[]> => page.locator('[data-crt-name]').evaluateAll(els => els.map(el => (el as HTMLInputElement).value));
const poster = (page: Page): Promise<string> => page.locator('[data-be-previews] .be-pv:not([hidden])').evaluate(el => el.innerHTML.toLowerCase());
const roleOf = (raw: Rec, id: string): Rec | undefined => raw.$extensions['com.suse.lolly'].brandSystem.roles.find((r: Rec) => r.id === id);

test('the room: add, rename, bind, Same as light, switch colourway, In context repaints, and a reload keeps every word', options, async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.LOLLY_BROWSER_CHANNEL });
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  try {
    await prepare(context);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await open(page);
    await install(page, fixture);
    await page.reload({ waitUntil: 'networkidle' }); await shellSettled(page);

    const fold = page.locator('[data-be-roles-fold]');
    await fold.locator('[data-crt-name]').first().waitFor();
    assert.equal(await fold.evaluate(el => (el as HTMLDetailsElement).open), true, 'a system with its own words opens with them');
    assert.deepEqual(await names(page), ['Main', 'Accent', 'Supporting', 'Tertiary']);
    assert.equal(await page.locator('[data-be-rolechips]').isVisible(), false, 'the chips step aside for the table');
    // Both looks on screen with no switch in the way, and In context beside them.
    assert.ok(await page.locator('[data-crt-value="main"][data-crt-mode="light"]').isVisible());
    assert.ok(await page.locator('[data-crt-value="main"][data-crt-mode="dark"]').isVisible());
    const table = (await page.locator('.crt-table').boundingBox())!;
    const context2 = (await page.locator('.be-context').boundingBox())!;
    assert.ok(context2.x >= table.x + table.width, 'the preview sits beside the table');
    assert.equal(await page.locator('[data-be-roles-preview]').isVisible(), false, 'so no way to it is needed');
    assert.ok((await page.locator('[data-be-previews]').boundingBox())!.y < 800, 'and is on screen with it');
    const heads = await page.locator('.crt-head [role="columnheader"]').evaluateAll(els => els.map(el => el.textContent));
    assert.deepEqual(heads, ['Role', 'Light', 'Dark', 'Lolly reads this as']);
    assert.ok((await page.locator('.crt-head').boundingBox())!.height < 40, 'the heads sit on one line');

    // Add a role: the value is marked as copied, and no tool picks this role by itself.
    await page.getByRole('button', { name: '+ Add a role' }).click();
    const word = page.locator('[data-crt-add-word]');
    assert.equal(await word.evaluate(el => el === document.activeElement), true, 'focus goes to the new field');
    await word.fill('Selvedge');
    await word.press('Enter');
    await page.locator('[data-crt-row="selvedge"]').waitFor();
    assert.match(await page.locator('[data-crt-row="selvedge"]').innerText(), /Copied/);
    assert.equal(await word.evaluate(el => el === document.activeElement), true, 'and stays there for the next one');
    await page.keyboard.press('Escape');
    await saved(page);

    // Rename in place: only the word changes.
    const name = page.locator('[data-crt-name="selvedge"]');
    await name.fill('Edge band');
    await name.press('Tab');
    await page.waitForFunction(() => (document.querySelector('[data-crt-name="selvedge"]') as HTMLInputElement)?.title === 'Edge band');
    assert.equal(await page.locator('[data-crt-remove="selvedge"]').evaluate(el => el === document.activeElement), true, 'Tab reaches the next control in the row, not the top of the page');
    await saved(page);

    // Describe.
    await page.locator('[data-crt-desc="selvedge"]').fill('The woven border');
    await page.locator('[data-crt-desc="selvedge"]').press('Enter');
    await saved(page);

    // Dark as "Same as light".
    await page.locator('[data-crt-value="selvedge"][data-crt-mode="dark"]').click();
    const picker = page.locator('.crt-pick');
    await picker.waitFor();
    assert.match(await picker.innerText(), /Edge band in Indigo, Dark/);
    await picker.locator('[data-crt-same]').click();
    await picker.waitFor({ state: 'detached' });
    await page.locator('[data-crt-row="selvedge"]').getByText('Same as light').waitFor();
    await saved(page);

    // Bind: the lead colour moves, and In context shows what that means.
    const lead = await page.locator('[data-crt-row="main"] .crt-value').first().getAttribute('title');
    assert.ok((await poster(page)).includes(lead!), 'Main leads the poster');
    const accentHex = (await page.locator('[data-crt-row="accent"] .crt-value').first().getAttribute('title'))!;
    await page.locator('[data-crt-reads="accent"]').focus();
    await page.locator('[data-crt-reads="accent"]').selectOption('primary');
    await page.waitForFunction(() => (document.querySelector('[data-crt-reads="main"]') as HTMLSelectElement)?.value === '');
    await page.waitForFunction((hex) => document.querySelector('[data-be-previews] .be-pv:not([hidden])')?.innerHTML.toLowerCase().includes(hex), accentHex);
    assert.equal(await page.locator('[data-crt-reads="accent"]').evaluate(el => el === document.activeElement), true, 'focus stays on the control that was used');
    assert.match(await page.locator('[data-crt-row="main"]').innerText(), /No tool picks this by itself/);
    await saved(page);

    // Switch colourway: the values and the preview are that colourway's.
    await page.locator('[data-be-lead="madder"]').click();
    await page.waitForFunction(() => document.querySelector('[data-crt-row="main"] .crt-value')?.getAttribute('title') === '#8e1f2f');
    await page.waitForFunction(() => document.querySelector('[data-be-previews] .be-pv:not([hidden])')?.innerHTML.toLowerCase().includes('#23395b'));
    assert.equal(await page.locator('[data-be-lead="madder"]').getAttribute('aria-pressed'), 'true');

    // The picker closes on Escape and hands focus back.
    await page.locator('[data-crt-value="tertiary"][data-crt-mode="light"]').click();
    await picker.waitFor();
    await page.keyboard.press('Escape');
    await picker.waitFor({ state: 'detached' });
    assert.equal(await page.locator('[data-crt-value="tertiary"][data-crt-mode="light"]').evaluate(el => el === document.activeElement), true);

    // A colour typed into the picker shows in the table with the panel still open.
    await page.locator('[data-crt-value="tertiary"][data-crt-mode="light"]').click();
    await picker.waitFor();
    const typed = picker.locator('[data-crt-field] input[type="text"]').first();
    await typed.fill('#00aa88');
    await typed.press('Enter');
    await page.waitForFunction(() => document.querySelector('[data-crt-value="tertiary"][data-crt-mode="light"]')?.getAttribute('title') === '#00aa88');
    assert.ok(await picker.isVisible(), 'the panel stays open while a colour is tuned');
    await page.keyboard.press('Escape');
    await picker.waitFor({ state: 'detached' });
    await saved(page);

    // Reorder from the keyboard, with focus following the row.
    const grip = page.locator('[data-crt-focus="grip:accent"]');
    await grip.focus();
    await page.keyboard.press('Space'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('Space');
    await page.waitForFunction(() => (document.querySelector('[data-crt-name]') as HTMLInputElement)?.value === 'Accent');
    assert.equal(await page.locator('[data-crt-focus="grip:accent"]').evaluate(el => el === document.activeElement), true);
    await saved(page);

    // Remove explains itself and offers only what is safe.
    await page.locator('[data-crt-remove="accent"]').click();
    const removal = page.locator('.crt-removal');
    assert.match(await removal.innerText(), /Lolly reads Accent as Lead colour/);
    assert.match(await removal.innerText(), /saved Design document can use Accent by name/);
    assert.ok(await removal.locator('[data-crt-remove-go="release"]').isVisible());
    await page.keyboard.press('Escape');
    await removal.waitFor({ state: 'detached' });
    assert.equal(await page.locator('[data-crt-remove="accent"]').evaluate(el => el === document.activeElement), true);

    // Reload: every word, reading and value is still there.
    const { raw: before } = await stored(page);
    await page.reload({ waitUntil: 'networkidle' }); await shellSettled(page);
    await page.locator('[data-crt-name]').first().waitFor();
    assert.deepEqual(await names(page), ['Accent', 'Main', 'Supporting', 'Tertiary', 'Edge band']);
    assert.equal(await page.locator('[data-crt-desc="selvedge"]').inputValue(), 'The woven border');
    assert.equal(await page.locator('[data-crt-reads="accent"]').inputValue(), 'primary');
    assert.equal(await page.locator('[data-crt-reads="main"]').inputValue(), '');
    assert.match(await page.locator('[data-crt-row="selvedge"]').innerText(), /Same as light/);
    const { raw } = await stored(page);
    assert.deepEqual(raw, before, 'a reload writes nothing');
    // Back on the default colourway for the checks below.
    await page.locator('[data-be-lead="indigo"]').click();
    assert.equal(roleOf(raw, 'selvedge')?.label, 'Edge band');
    assert.equal(roleOf(raw, 'selvedge')?.description, 'The woven border');
    assert.equal(raw['colourway/indigo'].color.colourway.dark.selvedge.$value, '{color.colourway.light.selvedge}');
    assert.equal(raw['colourway/indigo'].color.colourway.light.primary.$value, '{color.colourway.light.accent}');

    // A colour role's palette tile opens that role's value, and writes nothing to the token behind the tile.
    const tile = page.locator('[data-be-role-tile="tertiary"]');
    await tile.scrollIntoViewIfNeeded();
    await tile.click();
    await picker.waitFor();
    assert.match(await picker.innerText(), /Tertiary in Indigo, Light/);
    await page.keyboard.press('Escape');
    await picker.waitFor({ state: 'detached' });

    // Shut, the chips lead, in the system's own words.
    await fold.locator('> summary').click();
    const chips = page.locator('[data-be-rolechips] .be-rolechip');
    await chips.first().waitFor();
    assert.deepEqual(await page.locator('[data-be-rolechips] .be-rolechip-role').evaluateAll(els => els.map(el => el.firstChild?.textContent)), ['Accent', 'Main', 'Supporting', 'Tertiary', 'Edge band', 'Partner colour', 'Background', 'Text'], 'Accent took the lead, so the partner slot is one no role fills');
    await page.locator('[data-be-rolechip="role:tertiary"]').click();
    await page.locator('.be-rolepick [data-be-rolepick="color.brand.flax"]').click();
    await saved(page);
    const chosen = await stored(page);
    assert.equal(chosen.raw['colourway/indigo'].color.colourway.light.tertiary.$value, '{color.brand.flax}', 'a chip writes the role in the colourway and look being shown');
    assert.deepEqual(errors, []);
  } finally { await context.close(); await browser.close(); }
});

/**
 * The table says a role read by name only is "offered in colour fields and Design", so
 * this holds that true: the role is in a tool's colour field and in Design's picker, and
 * a pick stays linked, so it follows the colourway. Plans/352 R3 gives these swatches the
 * system's own word in place of the "Semantic" group name this looks them up by.
 */
test('a role read by name only really is offered: in a tool colour field and in Design, linked to the colourway', options, async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.LOLLY_BROWSER_CHANNEL });
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  try {
    await prepare(context);
    const page = await context.newPage();
    await open(page);
    await install(page, fixture);
    const swatch = page.locator('[aria-label="Semantic · Supporting"], [title="Semantic · Supporting"]').first();
    const room = async (hash: string): Promise<void> => {
      await page.goto(`${origin}/${hash}`, { waitUntil: 'load' });
      await page.reload({ waitUntil: 'networkidle' }); await shellSettled(page);
      await page.locator('dialog.view-loading[open]').waitFor({ state: 'hidden', timeout: 60_000 }).catch(() => {});
    };

    // A tool: the pick is the token, by path, and the canvas variable follows the colourway.
    await room('#/tool/qr-code?url=https%3A%2F%2Flolly.tools');
    const field = page.locator('.color-trigger').nth(1);
    await field.scrollIntoViewIfNeeded();
    await field.click();
    await swatch.waitFor({ state: 'attached' });
    await swatch.click();
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => decodeURIComponent(location.href).includes('{color.semantic.supporting}'));
    const canvasRole = (): Promise<string> => page.evaluate(() => getComputedStyle(document.querySelector('#tool-canvas')!).getPropertyValue('--brand-supporting').trim().toLowerCase());
    assert.equal(await canvasRole(), '#6c7a89');
    await page.locator('#theme-section [aria-label*="Madder"], #theme-section [title*="Madder"]').first().click();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#tool-canvas')!).getPropertyValue('--brand-supporting').trim().toLowerCase() === '#7d6b5d');

    // Design: the artboard takes the role and follows the colourway too.
    await room('#/tool/design');
    await page.keyboard.press('Escape');
    await page.locator('.color-trigger').first().click();
    await swatch.waitFor({ state: 'attached' });
    await swatch.click();
    await page.keyboard.press('Escape');
    const fill = (): Promise<boolean> => page.evaluate((want) => [...document.querySelectorAll<HTMLElement>('#tool-canvas *')].some(el => getComputedStyle(el).backgroundColor === want), 'rgb(108, 122, 137)');
    await page.waitForFunction((want) => [...document.querySelectorAll<HTMLElement>('#tool-canvas *')].some(el => getComputedStyle(el).backgroundColor === want), 'rgb(108, 122, 137)');
    assert.equal(await fill(), true, 'the artboard draws Supporting in Indigo');
    await page.getByRole('button', { name: 'Madder', exact: true }).click();
    await page.waitForFunction((want) => [...document.querySelectorAll<HTMLElement>('#tool-canvas *')].some(el => getComputedStyle(el).backgroundColor === want), 'rgb(125, 107, 93)');
  } finally { await context.close(); await browser.close(); }
});

test('phone: both looks side by side, no sideways scroll, long and non-Latin labels hold, and a full target on every control', options, async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.LOLLY_BROWSER_CHANNEL });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block' });
  try {
    await prepare(context);
    const page = await context.newPage();
    await open(page);
    const doc = structuredClone(fixture) as Rec;
    const roles = doc.$extensions['com.suse.lolly'].brandSystem.roles as Rec[];
    roles.find(r => r.id === 'main')!.label = 'القماش الأساسي';
    roles.find(r => r.id === 'accent')!.label = '主色调';
    roles.find(r => r.id === 'supporting')!.label = 'Selvedge and small print 🧵🪡';
    roles.find(r => r.id === 'tertiary')!.label = 'A very long role name that a brand guideline might really use somewhere';
    await install(page, doc);
    await page.reload({ waitUntil: 'networkidle' }); await shellSettled(page);
    await page.locator('[data-crt-name]').first().waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), false, 'no sideways page scroll');
    for (const key of ['main', 'accent', 'supporting', 'tertiary']) {
      const light = (await page.locator(`[data-crt-value="${key}"][data-crt-mode="light"]`).boundingBox())!;
      const dark = (await page.locator(`[data-crt-value="${key}"][data-crt-mode="dark"]`).boundingBox())!;
      assert.ok(Math.abs(light.y - dark.y) < 2, `${key}: light and dark on one line`);
      assert.ok(dark.x + dark.width <= 390, `${key}: inside the screen`);
      assert.ok(light.x >= 0);
      assert.ok(light.height >= 44 && dark.height >= 44, `${key}: a full touch target`);
      assert.equal(await page.locator(`[data-crt-row="${key}"]`).evaluate(el => el.scrollWidth > el.clientWidth + 1), false, `${key}: nothing overflows its card`);
    }
    assert.ok(await page.locator('[data-crt-row="main"] .crt-look').first().isVisible(), 'each cell says its look at this width');
    // The preview is far below at this width, so a press goes there.
    await page.locator('[data-be-roles-preview]').click();
    await page.waitForFunction(() => { const y = document.querySelector('.be-context')?.getBoundingClientRect().top ?? 9999; return y >= 0 && y < 300; });
    assert.equal(await page.locator('[data-crt-name="main"]').getAttribute('dir'), 'auto');
  } finally { await context.close(); await browser.close(); }
});

test('a locked system shows the table with no controls', options, async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.LOLLY_BROWSER_CHANNEL });
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  try {
    await prepare(context);
    await context.route('**/catalog/assets/index.json?paged=1', async (route) => {
      const response = await route.fetch();
      if (response.status() === 304) { await route.fulfill({ response }); return; }
      const index = await response.json();
      for (const asset of index.assets) if (asset.type === 'tokens') asset.brandLock = true;
      await route.fulfill({ response, json: index });
    });
    const page = await context.newPage();
    await open(page);
    const section = page.locator('[data-colour-roles-readonly]');
    await section.locator('.crt-table').waitFor();
    assert.ok(await section.locator('.crt-name--read').first().isVisible(), 'the words show');
    for (const control of ['input', 'select', 'textarea', '[data-crt-value]', '[data-crt-remove]', '[data-reorder-handle]', '[data-crt-add]', '[data-crt-start-open]']) {
      assert.equal(await section.locator(control).count(), 0, `${control}: no control on a locked system`);
    }
    assert.ok(await section.getByText('Lead colour').first().isVisible());
    assert.equal(await page.locator('[data-brand-editor]').count(), 0, 'the rooms stay shut');
  } finally { await context.close(); await browser.close(); }
});

test('a no-change visit to the default state leaves the document byte-identical', options, async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.LOLLY_BROWSER_CHANNEL });
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  try {
    await prepare(context);
    const page = await context.newPage();
    await open(page);
    const before = await stored(page);
    assert.equal(before.record?.source?.kind, 'shipped', 'the system as it ships');
    const fold = page.locator('[data-be-roles-fold]');
    await fold.waitFor();
    assert.equal(await fold.evaluate(el => (el as HTMLDetailsElement).open), false, 'the default stays shut');
    assert.ok(await page.locator('[data-be-rolechips]').isVisible(), 'and the chips lead as they did');
    await fold.locator('> summary').click();
    assert.deepEqual(await names(page), ['Primary', 'Secondary', 'Surface', 'Text']);
    assert.equal(await page.locator('[data-crt-remove]').count(), 0);
    await page.locator('[data-crt-start-open]').click();
    await page.locator('[data-crt-seed="1"]').click();
    assert.equal(await page.locator('[data-crt-words]').inputValue(), 'Main, Accent, Supporting, Tertiary');
    await page.keyboard.press('Escape');
    await page.locator('[data-crt-value="primary"][data-crt-mode="dark"]').click();
    await page.locator('.crt-pick').waitFor();
    await page.keyboard.press('Escape');
    await page.locator('.crt-pick').waitFor({ state: 'detached' });
    await page.locator('.be-context-head [data-be-lead-mode="dark"]').click();
    await page.waitForTimeout(600);
    const after = await stored(page);
    assert.equal(JSON.stringify(after.raw), JSON.stringify(before.raw), 'byte-identical');
    assert.equal(after.record?.source?.kind, 'shipped', 'no editable copy was made');
    assert.equal(await page.locator('.be-palette [data-be-save-state]').isVisible(), false, 'and nothing claims to have saved');
  } finally { await context.close(); await browser.close(); }
});
