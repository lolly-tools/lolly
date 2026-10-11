// SPDX-License-Identifier: MPL-2.0
/** Composite links exercise the real Design inspector, runtime, history and saved URL. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';
import { settleEditor } from '../packages/node-shell/src/open-session.ts';
import type { CanvasCommitEl } from '../shells/web/src/lib/canvas-commit.ts';
const origin = process.env.LOLLY_EXPORT_TEST_URL;
test('whole typography links undo together, preserve local edits and reopen', { skip: origin ? false : 'set LOLLY_EXPORT_TEST_URL', timeout: 180000 }, async () => {
  const browser = await getBrowser({ graphics: 'auto' });
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } });
  try {
    const page = await context.newPage(); page.setDefaultTimeout(30000);
    await page.route('**/catalog/assets/*/tokens/brand.json', async route => {
      const response = await route.fetch(), doc = await response.json();
      (doc.base ?? doc).verification = { heading: { $type: 'typography', $value: { fontFamily: 'sans', fontSize: { value: 48, unit: 'px' }, fontWeight: 700, letterSpacing: { value: 2, unit: 'px' }, lineHeight: 1.4 } } };
      await route.fulfill({ response, json: doc });
    });
    await page.goto(`${origin}/t/design?template=video`);
    await page.waitForFunction(() => !!(window as unknown as { lolly?: { ui?: unknown } }).lolly?.ui);
    await page.locator('dialog.view-loading[open]').waitFor({ state: 'hidden' });
    if (await page.locator('[data-topbar="inspector"]').getAttribute('aria-pressed') !== 'true') await page.keyboard.press('Alt+3');
    await page.waitForSelector('.fc-insp:not([hidden])');
    await page.evaluate(() => (window as unknown as { lolly: { ui: { apply(value: unknown): void } } }).lolly.ui.apply({ v: 1, sel: ['hook'] }));
    const textSection = page.locator('[data-head="text"]');
    if (await textSection.getAttribute('aria-expanded') !== 'true') await textSection.click();
    const slot = page.locator('[data-token-section="text"]');
    await slot.locator('summary').click();
    await slot.locator('[data-design-token-property]').selectOption('__typography');
    await slot.locator('[data-token-choose]').click();
    await slot.locator('[data-token-options] select').selectOption('verification.heading');
    const read = () => page.evaluate(() => ((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(input => input.id === 'boxes')!.value as Array<Record<string, unknown>>).find(row => row.id === 'hook')!);
    await page.waitForFunction(() => {
      const canvas = document.getElementById('tool-canvas') as CanvasCommitEl;
      const row = (canvas.__lollyModel!().find(input => input.id === 'boxes')!.value as Array<Record<string, unknown>>).find(row => row.id === 'hook');
      return row?.fontSize === 48 && row?.tracking === 2 && row?.lineHeight === 1.4;
    });
    const linked = await read(); assert.equal(linked.weight, '700');
    const links = JSON.parse(String(linked.tokenLinks)); assert.equal(links.fontSize.adapter, 'typography.fontSize'); assert.equal(links.font.ref, '{verification.heading}');
    await page.locator('[data-topbar="undo"]').click();
    await page.waitForFunction(() => !String(((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(input => input.id === 'boxes')!.value as Array<Record<string, unknown>>).find(row => row.id === 'hook')?.tokenLinks).includes('verification.heading'));
    await page.locator('[data-topbar="redo"]').click();
    await page.waitForFunction(() => String(((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(input => input.id === 'boxes')!.value as Array<Record<string, unknown>>).find(row => row.id === 'hook')?.tokenLinks).includes('verification.heading'));
    const size = page.locator('input[data-nf="f:fontSize"]'); await size.fill('55'); await size.press('Enter');
    await page.waitForFunction(() => {
      const row = ((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(input => input.id === 'boxes')!.value as Array<Record<string, unknown>>).find(row => row.id === 'hook')!;
      return row.fontSize === 55 && JSON.parse(String(row.tokenLinks)).fontSize.custom;
    });
    await settleEditor(page, 30000);
    await slot.locator('[data-design-token-property]').selectOption('fontSize');
    await slot.locator('[data-token-restore]').click();
    await page.waitForFunction(() => ((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(input => input.id === 'boxes')!.value as Array<Record<string, unknown>>).find(row => row.id === 'hook')?.fontSize === 48);
    await page.locator('[data-topbar="undo"]').click();
    await page.waitForFunction(() => ((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(input => input.id === 'boxes')!.value as Array<Record<string, unknown>>).find(row => row.id === 'hook')?.fontSize === 55);
    const saved = page.url(); await page.goto(saved); await page.waitForFunction(() => !!(document.getElementById('tool-canvas') as CanvasCommitEl)?.__lollyModel); await page.locator('dialog.view-loading[open]').waitFor({ state: 'hidden' });
    const reopened = await read(); assert.equal(Number(reopened.fontSize), 55); assert.equal(JSON.parse(String(reopened.tokenLinks)).fontSize.custom, true); assert.equal(Number(reopened.lineHeight), 1.4);
  } finally { await context.close(); await closeBrowser(); }
});
