// SPDX-License-Identifier: MPL-2.0
/**
 * The design-system context strip in Design's Canvas tab, through a real web shell
 * (plan 286 section 5.1).
 *
 * A packaged deck saved with its own dark choice (`__tokenSelection`) opens with the
 * strip saying the choice is the document's. Inspect tokens opens the read-only
 * inspector on that choice, with no action that applies choices to the design
 * system. Follow the design system then drops the document's choice: `_themes`
 * leaves the address and the strip says the document follows the design system.
 *
 * Runs against the lolly-start profile (its light and dark themes, synthetic text).
 *
 *   LOLLY_EXPORT_TEST_URL=http://127.0.0.1:5173 node --import ./tests/css-stub.mjs --test tests/design-context-strip.browser.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDesignLolly } from '../packages/node-shell/src/rebrand/pipeline.ts';
import { settleEditor } from '../packages/node-shell/src/open-session.ts';
import { closeBrowser, getBrowser } from '../packages/node-shell/src/browsers.ts';

const origin = process.env.LOLLY_EXPORT_TEST_URL;
const skip = origin ? false : 'set LOLLY_EXPORT_TEST_URL';
const LABEL = 'Context strip synthetic deck';

/** One artboard and one heading whose colour follows `color.semantic.text`, saved in dark. */
async function darkDeck(): Promise<Uint8Array> {
  const boxes = [
    { id: 'one', kind: 'frame', name: 'One', x: 0, y: 0, w: 1920, h: 1080, rot: 0, shape: 'rect', bg: '#777777', order: 0 },
    {
      id: 'one-title', kind: 'text', frame: 'one', x: 120, y: 120, w: 1200, h: 160, rot: 0, text: 'Context probe', fontSize: 72, weight: '500',
      fg: '#ffffff', tokenLinks: JSON.stringify({ fg: { ref: '{color.semantic.text}', value: '#ffffff' } }), align: 'left', valign: 'top', pad: 0,
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
    exportedAt: '2026-10-17T00:00:00.000Z',
  });
  return bytes;
}

test('the Canvas tab says what the document draws with, inspects it read-only and can follow the design system', { skip, timeout: 300_000 }, async () => {
  const bytes = await darkDeck();
  const browser = await getBrowser();
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    const root = new URL(origin!).origin;
    const path = '/__design-context-strip-test/context.lolly';
    await page.route((url) => url.origin === root && url.pathname === path, (route) =>
      route.fulfill({ status: 200, body: Buffer.from(bytes), contentType: 'application/vnd.lolly+zip', headers: { 'Cache-Control': 'no-store' } }));
    await page.goto(`${root}/#/open?lolly=${encodeURIComponent(path)}`, { waitUntil: 'load' });
    await page.waitForFunction(() => !!(window as unknown as { lolly?: { document?: unknown } }).lolly?.document && !!document.querySelector('#tool-canvas'), undefined, { timeout: 120_000 });
    await settleEditor(page, 120_000);
    const themesInAddress = (): Promise<string | null> => page.evaluate(() => {
      const hash = location.hash;
      const query = hash.startsWith('#/') ? hash.slice(hash.indexOf('?') + 1) : location.search.slice(1);
      return new URLSearchParams(query).get('_themes');
    });
    await page.waitForFunction(() => {
      const hash = location.hash;
      const query = hash.startsWith('#/') ? hash.slice(hash.indexOf('?') + 1) : location.search.slice(1);
      return new URLSearchParams(query).get('_themes') === '{"":"dark"}';
    });

    if (!await page.locator('.fc-insp').isVisible()) await page.getByRole('button', { name: 'Inspector', exact: true }).click();
    await page.locator('.fc-insp-tabs').getByRole('button', { name: 'Canvas', exact: true }).click();
    const strip = page.locator('.fc-insp [data-sec="look"] [data-token-context]');
    await strip.waitFor();
    assert.equal(await strip.getAttribute('aria-label'), 'Design system context');
    assert.match(await strip.locator('[data-token-context-kind]').innerText(), /^Render version: /i);
    assert.equal(await strip.locator('[data-token-context-scope]').textContent(), 'Chosen for this document');
    assert.equal(await strip.locator('p').innerText(), 'Theme: Dark');

    // Inspect opens on the document's choice, read-only.
    await strip.getByRole('button', { name: 'Inspect tokens', exact: true }).click();
    const dialog = page.locator('dialog.token-inspector-dialog[open]');
    await dialog.waitFor();
    assert.equal(await dialog.locator('[data-tw-context]').textContent(), 'Render version');
    assert.equal(await dialog.locator('[data-tw-group]').first().inputValue(), 'dark');
    assert.equal(await dialog.locator('[data-tw-apply-choices]').isVisible(), false, 'no action applies choices to the design system');
    await dialog.locator('[data-token-close]').click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await themesInAddress(), '{"":"dark"}', 'inspecting changes nothing');

    // Follow the design system drops the document's own choice.
    await strip.getByRole('button', { name: 'Follow the design system', exact: true }).click();
    await page.waitForFunction(() => {
      const hash = location.hash;
      const query = hash.startsWith('#/') ? hash.slice(hash.indexOf('?') + 1) : location.search.slice(1);
      const scope = document.querySelector('.fc-insp [data-token-context] [data-token-context-scope]');
      return !new URLSearchParams(query).has('_themes') && scope?.textContent === 'Follows the design system';
    });
    assert.equal(await page.locator('.fc-insp [data-token-context-follow]').count(), 0);
  } catch (error) {
    for (const page of context.pages()) {
      console.error('Design context strip failure state', await page.evaluate(() => ({
        url: location.href,
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
