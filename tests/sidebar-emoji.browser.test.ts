// SPDX-License-Identifier: MPL-2.0
/** Exercises the shared input picker against real tools and the shipped emoji catalog. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { journeyDiagnostics } from './helpers/journey-diagnostics.ts';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';

const origin = process.env.LOLLY_IMPORT_TEST_URL;
test('tool sidebars choose an emoji set once, insert at the caret, and preserve document choices', {
  skip: origin ? false : 'set LOLLY_IMPORT_TEST_URL to a local Vite shell', timeout: 120_000,
}, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width: 1360, height: 950 }, reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1');
  });
  const page = await context.newPage();
  const emoji = '\u{1f600}';
  const chosenSet = 'community/emoji/twemoji/color@17.0.3';
  const choose = async () => {
    await page.locator('.emoji-pop').getByRole('button', { name: 'Change emoji set', exact: true }).click();
    const select = page.locator('.emoji-choice [data-emoji-set]');
    await select.waitFor();
    assert.equal(await page.locator('.emoji-pop unicode-emoji-picker').count(), 0);
    await select.selectOption(chosenSet);
    await page.getByLabel('Use this set for new work', { exact: true }).check();
    await page.locator('.emoji-choice').getByRole('button', { name: 'Continue', exact: true }).click();
    await page.locator('.emoji-pop unicode-emoji-picker').waitFor();
  };
  // Snippet and Diagram Builder ship built-in templates, so a fresh visit asks where to start.
  const startBlank = async () => {
    await page.locator('.tmpl-chooser-tile[data-template-id="__blank__"]').click();
    await page.locator('.tmpl-chooser-panel').waitFor({ state: 'detached' });
  };
  const pick = async () => {
    const cell = page.locator('.emoji-pop unicode-emoji-picker .emojis .emoji').filter({ hasText: emoji }).first();
    await cell.click();
    await page.locator('.emoji-pop').waitFor({ state: 'detached' });
  };
  const diagnose = journeyDiagnostics(context, 'sidebar-emoji');
  try {
    await page.goto(`${origin}/#/tool/jump`, { waitUntil: 'networkidle' });
    const heading = page.locator('input[data-input-id="heading"]');
    await heading.fill('Hello friend');
    await heading.evaluate((field: HTMLInputElement) => { field.focus(); field.setSelectionRange(6, 12); });
    const insert = heading.locator('..').getByRole('button', { name: 'Insert emoji', exact: true });
    await page.waitForURL(url => url.searchParams.has('emojistyle'));
    const initialStyle = new URL(page.url()).searchParams.get('emojistyle');
    assert.equal(JSON.parse(initialStyle!).primary.id, 'community/emoji/fluent/high-contrast');
    await insert.click();
    await page.locator('.emoji-pop unicode-emoji-picker').waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await heading.inputValue(), 'Hello friend');
    assert.equal(new URL(page.url()).searchParams.get('emojistyle'), initialStyle);
    await insert.click();
    await choose();
    await pick();
    assert.equal(await heading.inputValue(), `Hello ${emoji}`);
    await page.waitForURL(url => url.searchParams.get('emoji') === chosenSet);
    assert.equal(await heading.evaluate((field: HTMLInputElement) => field.selectionStart), 8);
    const headingArt = heading.locator('..').locator('.input-emoji-display .lolly-emoji');
    await headingArt.locator('svg').waitFor();
    assert.equal(await headingArt.getAttribute('data-emoji'), emoji);
    assert.match(await headingArt.getAttribute('data-emoji-sum') ?? '', /^[a-f0-9]{16}$/, 'the field must draw verified artwork, not a placeholder');
    assert.equal(await heading.evaluate(field => getComputedStyle(field).webkitTextFillColor), 'rgba(0, 0, 0, 0)');
    // The visible artwork leaves native selection and keyboard editing intact.
    await heading.press('End'); await page.keyboard.type('!');
    assert.equal(await heading.inputValue(), `Hello ${emoji}!`);
    await heading.press('Backspace');
    assert.equal(await heading.inputValue(), `Hello ${emoji}`);
    // An existing emoji table cell uses the same chooser and replaces just that cell.
    const tableCell = page.locator('[data-emoji-cell]').first();
    await tableCell.click();
    await page.locator('.emoji-pop unicode-emoji-picker').waitFor();
    assert.equal(await page.locator('.emoji-choice').count(), 0);
    await pick();
    assert.equal(await page.locator('[data-emoji-cell]').first().evaluate((cell: HTMLButtonElement) => cell.value), emoji);
    await page.locator('#tool-canvas .lolly-emoji svg').first().waitFor();

    // The profile choice seeds a fresh tool; textarea insertion also uses native edits.
    await page.goto(`${origin}/#/tool/snippet`, { waitUntil: 'networkidle' });
    await page.waitForURL(url => url.searchParams.get('emoji') === chosenSet);
    await startBlank();
    const code = page.locator('textarea[data-input-id="code"]');
    await code.fill('const hello = "";');
    await code.evaluate((field: HTMLTextAreaElement) => { field.focus(); field.setSelectionRange(15, 15); });
    await code.locator('..').getByRole('button', { name: 'Insert emoji', exact: true }).click();
    await page.locator('.emoji-pop unicode-emoji-picker').waitFor();
    await pick();
    assert.equal(await code.inputValue(), `const hello = "${emoji}";`);
    await code.locator('..').locator('.input-emoji-display .lolly-emoji svg').waitFor();
    // Wrapped lines must keep the same geometry as native character advances.
    await code.fill(`A ${emoji} B 👨‍👩‍👧‍👦 C ❤️ D\n${'Words to wrap around the field. '.repeat(12)}${emoji} FINISH`);
    await page.waitForFunction(() => {
      const field = document.querySelector<HTMLTextAreaElement>('textarea[data-input-id="code"]')!;
      return field.parentElement!.querySelector('.input-emoji-display')?.textContent === field.value;
    });
    const geometry = await code.evaluate((field: HTMLTextAreaElement) => {
      const mirror = field.parentElement!.querySelector<HTMLElement>('.input-emoji-display-text')!;
      const reference = mirror.cloneNode(true) as HTMLElement;
      reference.style.visibility = 'hidden';
      for (const glyph of reference.querySelectorAll<HTMLElement>('.lolly-emoji')) glyph.replaceWith(glyph.dataset.emoji!);
      mirror.parentElement!.append(reference);
      const bounds = (node: HTMLElement) => {
        const range = document.createRange(); range.selectNodeContents(node.lastChild!);
        return range.getBoundingClientRect().toJSON();
      };
      const actual = bounds(mirror), expected = bounds(reference);
      reference.remove();
      field.style.height = '80px'; field.style.maxHeight = '80px';
      field.scrollTop = field.scrollHeight;
      return { actual, expected };
    });
    assert.ok(Math.abs(geometry.actual.y - geometry.expected.y) < 1, 'artwork must not change line wrapping');
    assert.ok(Math.abs(geometry.actual.x - geometry.expected.x) < 1, 'text after emoji must align with native advances');
    await page.waitForFunction(() => {
      const field = document.querySelector<HTMLTextAreaElement>('textarea[data-input-id="code"]')!;
      const mirror = field.parentElement!.querySelector<HTMLElement>('.input-emoji-display-text')!;
      return field.scrollTop > 0 && mirror.style.transform.includes(`${-field.scrollTop}px`);
    });
    // The sidebar orders sections by the plan 273 band ladder, so Callouts (content) comes before Look (style).
    assert.deepEqual(await page.locator('#tool-inputs .input-section-summary').allTextContents(), ['Text', 'Title bar', 'Callouts', 'Look']);
    assert.equal(await page.locator('#tool-inputs .input-section-icon svg').count(), 4);

    // Block fields use qualified row identities and retain the other cards.
    await page.goto(`${origin}/#/tool/diagram-builder`, { waitUntil: 'networkidle' });
    await startBlank();
    await page.locator('.block-item').first().locator('.block-collapse').click();
    const card = page.locator('input[data-field-id="nodes:0:label"]');
    const sibling = page.locator('input[data-field-id="nodes:1:label"]');
    const other = await sibling.inputValue();
    await card.fill('Chief');
    await card.evaluate((field: HTMLInputElement) => { field.focus(); field.setSelectionRange(5, 5); });
    await card.locator('..').getByRole('button', { name: 'Insert emoji', exact: true }).click();
    await page.locator('.emoji-pop unicode-emoji-picker').waitFor();
    await pick();
    assert.equal(await card.inputValue(), `Chief${emoji}`);
    await card.locator('..').locator('.input-emoji-display .lolly-emoji svg').waitFor();
    assert.equal(await sibling.inputValue(), other);

    // A link's set beats the remembered set, including a narrow, large-text display.
    await page.setViewportSize({ width: 390, height: 844 });
    const linkedSet = 'community/emoji/openmoji/black@17.0.0';
    await page.goto(`${origin}/#/tool/jump?emoji=${encodeURIComponent(linkedSet)}&heading=Hi`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.documentElement.dataset.a11yText = 'large');
    const toolInputs = page.locator('#tool-inputs');
    await toolInputs.waitFor({ state: 'attached' });
    if (!await toolInputs.isVisible()) await page.getByRole('button', { name: 'Drag to resize controls, tap to expand' }).click();
    await page.locator('[data-emoji-cell]').first().click();
    await page.locator('.emoji-pop unicode-emoji-picker').waitFor();
    await page.locator('.emoji-pop').getByRole('button', { name: 'Change emoji set', exact: true }).click();
    await page.locator('.emoji-choice [data-emoji-set]').waitFor();
    assert.equal(await page.locator('.emoji-choice [data-emoji-set]').inputValue(), linkedSet);
    const box = await page.locator('.emoji-pop').boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= 391 && box.y >= 0 && box.y + box.height <= 845);
    await page.locator('.emoji-choice').getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(new URL(page.url()).searchParams.get('emoji'), linkedSet);
    await page.keyboard.press('Escape');
    const mobileHeading = page.locator('input[data-input-id="heading"]');
    await mobileHeading.fill(`Hi ${emoji}`);
    const mobileArt = mobileHeading.locator('..').locator('.input-emoji-display .lolly-emoji');
    await mobileArt.locator('svg').waitFor();
    const blackSum = await mobileArt.getAttribute('data-emoji-sum');
    assert.match(blackSum ?? '', /^[a-f0-9]{16}$/);
    await mobileHeading.locator('..').getByRole('button', { name: 'Insert emoji', exact: true }).click();
    await choose();
    await page.keyboard.press('Escape');
    await page.waitForFunction(sum => {
      const next = document.querySelector('input[data-input-id="heading"]')?.parentElement?.querySelector('.input-emoji-display .lolly-emoji')?.getAttribute('data-emoji-sum');
      return next && next !== sum;
    }, blackSum);
    assert.equal(await mobileHeading.inputValue(), `Hi ${emoji}`);
    await mobileHeading.fill(`${'Long text '.repeat(5)}${emoji}`);
    await mobileHeading.evaluate((field: HTMLInputElement) => {
      field.style.maxWidth = '160px';
      field.scrollLeft = field.scrollWidth;
    });
    await page.waitForFunction(() => {
      const field = document.querySelector<HTMLInputElement>('input[data-input-id="heading"]')!;
      const mirror = field.parentElement!.querySelector<HTMLElement>('.input-emoji-display-text');
      return field.scrollLeft > 0 && mirror?.style.transform.includes(`${-field.scrollLeft}px`);
    });
  } catch (error) { await diagnose(error); throw error; } finally { await context.close(); await closeBrowser(); }
});
