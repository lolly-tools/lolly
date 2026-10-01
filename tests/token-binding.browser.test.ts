// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, type Locator, type Page } from 'playwright';

const origin = process.env.LOLLY_EXPORT_TEST_URL;
const output = process.env.LOLLY_TOKEN_TEST_OUTPUT;
const messagePath = 'verification.message.with.a.long.semantic.path.for.shared.content';

async function checkLayout(page: Page, menu: Locator): Promise<void> {
  await page.waitForFunction(() => {
    const el = document.querySelector('.input-rule-menu');
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight;
  });
  const layout = await menu.evaluate(el => ({
    overflow: el.scrollWidth - el.clientWidth,
    buttons: [...el.querySelectorAll('button')].map(button => button.getBoundingClientRect().height),
  }));
  assert.ok(layout.overflow <= 1, JSON.stringify(layout));
  assert.ok(layout.buttons.every(height => height >= 44), JSON.stringify(layout));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
}

test('token controls stay compact and usable across tool inputs, phone layouts and accessibility preferences', {
  skip: origin ? false : 'set LOLLY_EXPORT_TEST_URL',
  timeout: 300_000,
}, async (t) => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.LOLLY_BROWSER_CHANNEL,
  });
  if (output) await mkdir(output, { recursive: true });
  try {
    // The token controls are shell chrome, the same for every tool, so these are
    // static previews. A WebGL tool is not: headless Chromium composites in software
    // and reads every WebGL frame back on the main thread, so Flythrough's always
    // running preview held its mount (and the loading dialog) past 15s on CI.
    // Snippet's typing time is the same kind of control: a seconds slider, default 6,
    // in a sidebar section, shown for the typing scene.
    for (const [tool, input, path, query] of [
      ['snippet', 'typingSeconds', 'verification.duration', 'scene=typing&typingSeconds=6'],
      ['gradient', 'count', 'verification.count', 'count=5'],
      ['qr-code', 'text', messagePath, 'payload=text&text=hello'],
      ['qr-code', 'company', messagePath, 'payload=vcard&firstname=Example&company=The%20Linux%20Foundation'],
    ]) {
      for (const [width, preferences] of [
        [1440, false],
        [390, false],
        [390, true],
      ] as const) {
        await t.test(
          `${tool} ${input} at ${width}${preferences ? ' with accessibility preferences' : ''}`,
          async () => {
            const touch = width === 390;
            const context = await browser.newContext({
              serviceWorkers: 'block',
              viewport: { width, height: touch ? 844 : 1000 },
              hasTouch: touch,
              reducedMotion: 'reduce',
            });
            try {
              const page = await context.newPage(),
                errors: string[] = [];
              page.setDefaultTimeout(15_000);
              page.on('pageerror', (error) => errors.push(error.message));
              await page.route('**/catalog/assets/*/tokens/brand.json', async (route) => {
                const response = await route.fetch(),
                  doc = await response.json();
                (doc.base ?? doc).verification = {
                  duration: { $type: 'number', $value: 12 },
                  count: { $type: 'number', $value: 4 },
                  message: {
                    with: {
                      a: {
                        long: {
                          semantic: {
                            path: {
                              for: {
                                shared: {
                                  content: {
                                    $type: 'string',
                                    $value: 'https://example.test/tokens',
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                };
                await route.fulfill({ response, json: doc });
              });
              await page.goto(`${origin}/t/${tool}?${query}`);
              const trigger = page.locator(`[data-input-actions="${input}"]`);
              await trigger.waitFor({ state: 'attached' });
              await page.locator('dialog.view-loading[open]').waitFor({ state: 'hidden' });
              await page.keyboard.press('Escape');
              if (preferences)
                await page.evaluate(() => {
                  Object.assign(document.documentElement.dataset, {
                    theme: 'dark',
                    a11yText: 'large',
                    a11yContrast: 'high',
                    a11yMotion: 'reduce',
                  });
                  document.documentElement.dir = 'rtl';
                });
              const section = page.locator('.input-section').filter({ has: trigger });
              if (
                (await section.count()) &&
                !(await section.evaluate((el) => (el as HTMLDetailsElement).open))
              ) {
                await section.locator(':scope > summary').click();
              }
              await trigger.scrollIntoViewIfNeeded();
              assert.equal(await trigger.count(), 1, 'one input actions trigger');
              assert.equal(await page.locator('#tool-inputs .token-binding-field').count(), 0, 'no token details in the data-entry rows');
              assert.equal(await trigger.getAttribute('aria-haspopup'), 'dialog');
              const name = `${tool}-${input}-${width}${preferences ? '-preferences' : ''}`;
              if (output) await page.screenshot({ path: join(output, `${name}-closed.png`) });
              await trigger.press('Space');
              const menu = page.locator('.input-rule-menu');
              const binding = menu.locator(`[data-token-input="${input}"]`);
              await binding.waitFor();
              assert.equal(await menu.getAttribute('role'), 'dialog');
              assert.ok(await menu.getByRole('button', { name: 'Use as a tool input', exact: true }).isVisible());
              assert.equal(await binding.locator('[data-token-options]').isVisible(), false, 'the chooser stays hidden until requested');
              await checkLayout(page, menu);
              if (output) await page.screenshot({ path: join(output, `${name}-menu.png`) });
              await binding.getByRole('button', { name: 'Link a token', exact: true }).click();
              const chooser = binding.locator('select');
              await chooser.locator(`option[value="${path}"]`).waitFor({ state: 'attached' });
              if (tool === 'gradient')
                assert.equal(await chooser.locator('option[value="verification.duration"]').count(), 0, 'out-of-range values stay out of the picker');
              assert.equal(await chooser.evaluate(el => el === document.activeElement), true);
              await checkLayout(page, menu);
              await chooser.selectOption(path!);
              await menu.waitFor({ state: 'hidden' });
              await trigger.waitFor();
              assert.equal(await trigger.evaluate(el => el === document.activeElement), true, 'linking returns focus to the refreshed input trigger');
              await trigger.press('Space');
              await binding.getByRole('button', { name: 'Make custom', exact: true }).waitFor();
              assert.ok((await binding.textContent())?.includes(path!));
              await checkLayout(page, menu);
              if (output) await page.screenshot({ path: join(output, `${name}-linked.png`) });
              await binding.getByRole('button', { name: 'Make custom', exact: true }).click();
              await menu.waitFor({ state: 'hidden' });
              await trigger.click();
              await binding.getByRole('button', { name: 'Restore link', exact: true }).click();
              await menu.waitFor({ state: 'hidden' });
              await trigger.click();
              await binding.getByRole('button', { name: 'Inspect source', exact: true }).click();
              const dialog = page.locator('dialog.token-inspector-dialog[open]');
              await dialog.waitFor();
              assert.ok(await dialog.locator('[data-token-close]').isVisible());
              await page.keyboard.press('Escape');
              await dialog.waitFor({ state: 'hidden' });
              assert.ok(await menu.isVisible(), 'closing source inspection preserves the input menu');
              assert.equal(await binding.getByRole('button', { name: 'Inspect source', exact: true }).evaluate(el => el === document.activeElement), true);
              await page.keyboard.press('Escape');
              await menu.waitFor({ state: 'hidden' });
              assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
              assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
              await trigger.click();
              await trigger.click();
              await menu.waitFor({ state: 'hidden' });
              assert.equal(await page.locator('#tool-inputs .token-binding-field').count(), 0);
              assert.deepEqual(errors, []);
            } finally {
              await context.close();
            }
          }
        );
      }
    }
  } finally {
    await browser.close();
  }
});
