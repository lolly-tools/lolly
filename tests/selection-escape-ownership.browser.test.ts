// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { build } from 'esbuild';
import { chromium } from 'playwright';

declare global {
  interface Window { selectionEscapeFixture(kind: 'disclosure' | 'popover', late: boolean): void }
}

test('Escape closes View options before clearing selection regardless of lazy bulk-bar listener order', {
  skip: existsSync(chromium.executablePath()) ? false : 'Install Playwright Chromium.', timeout: 60_000,
}, async t => {
  const bundle = await build({
    stdin: { resolveDir: new URL('..', import.meta.url).pathname, loader: 'ts', contents: `
      import { wireDisclosure, mountBodyPopover } from './shells/web/src/components/body-popover.ts';
      import { wireEscapeClearsSelection } from './shells/web/src/lib/bulk-bar.ts';
      window.selectionEscapeFixture = (kind, late) => {
        const trigger = document.querySelector('#options'), panel = document.querySelector('.filter-popover');
        const check = document.querySelector('.tile-check');
        const wireSelection = () => wireEscapeClearsSelection({
          active: () => check.getAttribute('aria-pressed') === 'true',
          clear: () => check.setAttribute('aria-pressed', 'false'),
        });
        if (!late) wireSelection();
        if (kind === 'disclosure') wireDisclosure(trigger, panel).open();
        else mountBodyPopover(trigger, el => {
          const button = document.createElement('button'); button.textContent = 'Grid'; el.append(button); return button;
        }, { className: 'profile-menu', ariaLabel: 'View options' }).open();
        if (late) wireSelection();
      };
    ` }, bundle: true, write: false, platform: 'browser', format: 'iife', loader: { '.css': 'empty' },
    define: { 'import.meta.env': '{}' }, logLevel: 'silent',
  });
  const browser = await chromium.launch(); t.after(() => browser.close());
  const context = await browser.newContext();
  for (const kind of ['disclosure', 'popover'] as const) {
    for (const late of [true, false]) {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.setContent('<button id="options">View options</button><button class="tile-check" aria-pressed="true">Selected tile</button><div class="filter-popover" hidden><button>Grid</button></div>');
      await page.addScriptTag({ content: bundle.outputFiles[0]!.text });
      await page.evaluate(({ kind, late }) => window.selectionEscapeFixture(kind, late), { kind, late });
      const menu = page.locator(kind === 'disclosure' ? '.filter-popover' : '.profile-menu');
      assert.ok(await menu.isVisible());
      await page.keyboard.press('Escape');
      await menu.waitFor({ state: 'hidden' });
      assert.equal(await page.locator('.tile-check').getAttribute('aria-pressed'), 'true',
        `${kind} owns the first Escape with selection listener ${late ? 'after' : 'before'} the menu`);
      assert.equal(await page.evaluate(() => document.activeElement?.id), 'options', 'menu dismissal restores focus');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.tile-check').getAttribute('aria-pressed'), 'false', 'the next Escape clears selection');
      assert.deepEqual(errors, []);
      await page.close();
    }
  }
});
