// SPDX-License-Identifier: MPL-2.0
/**
 * The Design tool's theme control through a real web shell (plan 291 W4).
 *
 * A packaged deck saved in the dark theme (`__tokenSelection`) is opened with no
 * `_themes` in its link. The saved choice must reach the address, the linked text
 * colour and the canvas `--brand-text` variable alike. The Document section then
 * switches to Light with a click and back to Dark from the keyboard, and Escape
 * leaves the choice alone.
 *
 * Runs against the lolly-start profile (its light and dark themes, synthetic text).
 *
 *   LOLLY_EXPORT_TEST_URL=http://127.0.0.1:5173 node --import ./tests/css-stub.mjs --test tests/design-theme.browser.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDesignLolly } from '../packages/node-shell/src/rebrand/pipeline.ts';
import { closeBrowser, getBrowser } from '../packages/node-shell/src/browsers.ts';

const origin = process.env.LOLLY_EXPORT_TEST_URL;
const skip = origin ? false : 'set LOLLY_EXPORT_TEST_URL';
const LABEL = 'Theme control synthetic deck';
/** lolly-start's `color.semantic.text`: neutral 1 in light, neutral 9 in dark. */
const LIGHT_TEXT = 'rgb(29, 29, 29)';
const DARK_TEXT = 'rgb(255, 255, 255)';

/** One artboard, one heading whose colour follows `color.semantic.text`, saved in dark. */
async function darkDeck(): Promise<Uint8Array> {
  const link = (ref: string, value: string): string => JSON.stringify({ fg: { ref, value } });
  const boxes = [
    { id: 'one', kind: 'frame', name: 'One', x: 0, y: 0, w: 1920, h: 1080, rot: 0, shape: 'rect', bg: '#777777', order: 0 },
    {
      id: 'one-title', kind: 'text', frame: 'one', x: 120, y: 120, w: 1200, h: 160, rot: 0, text: 'Theme probe', fontSize: 72, weight: '500',
      fg: '#1d1d1d', tokenLinks: link('{color.semantic.text}', '#1d1d1d'), align: 'left', valign: 'top', pad: 0,
    },
  ];
  const { bytes } = await buildDesignLolly({
    session: {
      values: {
        boxes, __toolId: 'design', __label: LABEL, __export_filename: LABEL, __tokenSelection: { '': 'dark' },
        __export_width: '1920', __export_height: '1080', __export_unit: 'px',
      },
      mediaRefs: [],
    },
    media: new Map(),
    name: LABEL,
    exportedAt: '2026-10-03T00:00:00.000Z',
  });
  return bytes;
}

test('a saved theme reaches the address and canvas on reopen, and the Document control switches it', { skip, timeout: 300_000 }, async () => {
  const bytes = await darkDeck();
  const browser = await getBrowser();
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    // The file is served from this origin, as `#/open` requires, by the test itself.
    const root = new URL(origin!).origin;
    const path = '/__design-theme-test/theme.lolly';
    await page.route((url) => url.origin === root && url.pathname === path, (route) =>
      route.fulfill({ status: 200, body: Buffer.from(bytes), contentType: 'application/vnd.lolly+zip', headers: { 'Cache-Control': 'no-store' } }));
    await page.goto(`${root}/#/open?lolly=${encodeURIComponent(path)}`, { waitUntil: 'load' });
    await page.waitForFunction(() => !!(window as unknown as { lolly?: { document?: unknown } }).lolly?.document && !!document.querySelector('#tool-canvas'), undefined, { timeout: 120_000 });
    {
      const themesInAddress = (): Promise<string | null> => page.evaluate(() => {
        const hash = location.hash;
        const query = hash.startsWith('#/') ? hash.slice(hash.indexOf('?') + 1) : location.search.slice(1);
        return new URLSearchParams(query).get('_themes');
      });
      const textColour = (): Promise<string> => page.evaluate(() => {
        const canvas = document.querySelector('#tool-canvas')!;
        const leaf = [...canvas.querySelectorAll<HTMLElement>('*')].find((el) => el.children.length === 0 && el.textContent === 'Theme probe');
        return leaf ? getComputedStyle(leaf).color : 'missing';
      });
      const brandText = (): Promise<string> => page.evaluate(() =>
        getComputedStyle(document.querySelector('#tool-canvas')!).getPropertyValue('--brand-text').trim().toLowerCase());
      const settle = async (want: string, theme: string): Promise<void> => {
        await page.waitForFunction(([colour, choice]) => {
          const canvas = document.querySelector('#tool-canvas');
          const leaf = canvas && [...canvas.querySelectorAll<HTMLElement>('*')].find((el) => el.children.length === 0 && el.textContent === 'Theme probe');
          const hash = location.hash;
          const query = hash.startsWith('#/') ? hash.slice(hash.indexOf('?') + 1) : location.search.slice(1);
          const brandText = canvas ? getComputedStyle(canvas).getPropertyValue('--brand-text').trim() : '';
          return !!leaf && getComputedStyle(leaf).color === colour && new URLSearchParams(query).get('_themes') === choice
            && brandText === (choice === '{"":"dark"}' ? '#ffffff' : '#1d1d1d');
        }, [want, theme] as const);
      };

      // Reopen: the saved dark choice is in the runtime, the address and the canvas.
      await settle(DARK_TEXT, '{"":"dark"}');
      assert.equal(await themesInAddress(), '{"":"dark"}');
      assert.equal(await textColour(), DARK_TEXT);
      assert.equal(await brandText(), '#ffffff', 'the canvas variables follow the saved theme');

      // The Document section's control: one segment per declared theme.
      if (!await page.locator('.fc-insp').isVisible()) await page.getByRole('button', { name: 'Inspector', exact: true }).click();
      await page.locator('.fc-insp-tabs').getByRole('button', { name: 'Document', exact: true }).click();
      const group = page.locator('.fc-insp .fc-seg[data-seg="lolly-doc-theme-0"]');
      assert.equal(await group.getAttribute('aria-label'), 'Colour theme');
      assert.deepEqual(await group.locator('.fc-seg-btn').allTextContents(), ['Light', 'Dark']);
      assert.equal(await group.locator('.fc-seg-btn', { hasText: 'Dark' }).getAttribute('aria-pressed'), 'true');

      await group.locator('.fc-seg-btn', { hasText: 'Light' }).click();
      await settle(LIGHT_TEXT, '{"":"light"}');
      assert.equal(await brandText(), '#1d1d1d');
      await page.waitForFunction(() => document.querySelector('.fc-insp .fc-seg[data-seg="lolly-doc-theme-0"] .fc-seg-btn[aria-pressed="true"]')?.textContent === 'Light');

      // Keyboard: the Dark segment is a Tab stop, and Enter presses the segment.
      await page.locator('.fc-insp .fc-seg[data-seg="lolly-doc-theme-0"] .fc-seg-btn', { hasText: 'Dark' }).focus();
      await page.keyboard.press('Enter');
      await settle(DARK_TEXT, '{"":"dark"}');
      assert.equal(await brandText(), '#ffffff');

      // Escape is the column's way out, never a theme change.
      await page.keyboard.press('Escape');
      assert.equal(await themesInAddress(), '{"":"dark"}');
      assert.equal(await textColour(), DARK_TEXT);
    }
  } catch (error) {
    for (const page of context.pages()) {
      console.error('Design theme failure state', await page.evaluate(() => ({
        url: location.href,
        text: document.body.innerText.slice(0, 8000),
        inspector: document.querySelector('.fc-insp')?.outerHTML.slice(0, 8000),
        dialogs: [...document.querySelectorAll('dialog[open]')].map(dialog => dialog.outerHTML.slice(0, 2000)),
      })).catch(() => null));
    }
    throw error;
  } finally {
    await context.close();
    await closeBrowser();
  }
});
