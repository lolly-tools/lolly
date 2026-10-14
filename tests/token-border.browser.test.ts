// SPDX-License-Identifier: MPL-2.0
/** Border links exercise real stroke paint, theme refresh, history and saved URLs. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';
import { settleEditor } from '../packages/node-shell/src/open-session.ts';
import { encodeAuthoredPath } from '../engine/src/geom/authored-url.ts';
import type { CanvasCommitEl } from '../shells/web/src/lib/canvas-commit.ts';
import type { InputValue } from '../engine/src/inputs.ts';
const origin = process.env.LOLLY_EXPORT_TEST_URL;
test('whole borders render, restore dash overrides, refresh themes and reopen in one undo step', { skip: origin ? false : 'set LOLLY_EXPORT_TEST_URL', timeout: 180000 }, async () => {
  const browser = await getBrowser({ graphics: 'auto' });
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } });
  try {
    const page = await context.newPage(); page.setDefaultTimeout(30000);
    await page.route('**/catalog/assets/*/tokens/brand.json', async route => {
      const response = await route.fetch(), doc = await response.json();
      (doc.base ?? doc).verification = { edge: { $type: 'border', $value: { color: '{color.semantic.text}', width: { value: 3, unit: 'pt' }, style: 'dashed' } } };
      await route.fulfill({ response, json: doc });
    });
    const boxes = [{ id: 'a', kind: 'path', shape: 'rect', x: 100, y: 100, w: 240, h: 100, rot: 0, bg: '', stroke: '#ff0000', strokeW: 2, strokeDash: 'dotted', strokeDashArray: '7 3', strokeDashLen: 7, strokeGapLen: 3, path: encodeAuthoredPath({ kind: 'cubic', closed: false, nodes: [{ x: 0, y: 0, continuity: 'corner' }, { x: 1, y: 1, continuity: 'corner' }] }) }, { id: 'b', kind: 'box', shape: 'rect', x: 420, y: 100, w: 100, h: 100, rot: 0, bg: '#777777', stroke: '#00ff00', strokeW: 1, strokeDash: '' }];
    await page.goto(`${origin}/t/design?${new URLSearchParams({ boxes: JSON.stringify(boxes), _sel: 'a', c2pa: '0', imprint: '0' })}`);
    await page.waitForFunction(() => !!(window as unknown as { lolly?: { ui?: unknown } }).lolly?.ui);
    await page.locator('dialog.view-loading[open]').waitFor({ state: 'hidden' });
    if (await page.locator('[data-topbar="inspector"]').getAttribute('aria-pressed') !== 'true') await page.keyboard.press('Alt+3');
    await page.evaluate(() => (window as unknown as { lolly: { ui: { apply(value: unknown): void } } }).lolly.ui.apply({ v: 1, sel: ['a', 'b'] }));
    const head = page.locator('[data-head="fill"]');
    if (await head.getAttribute('aria-expanded') !== 'true') await head.click();
    const slot = page.locator('[data-token-section="fill"]');
    await slot.locator('summary').click(); await slot.locator('[data-design-token-property]').selectOption('__border');
    await slot.locator('[data-token-choose]').click(); await slot.locator('[data-token-options] select').selectOption('verification.edge');
    const read = () => page.evaluate(() => (document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(input => input.id === 'boxes')!.value as Array<Record<string, unknown>>);
    const wait = async (field: string, value: unknown) => page.waitForFunction(({ field, value }) => ((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(input => input.id === 'boxes')!.value as Array<Record<string, unknown>>).every(row => row[field] === value), { field, value });
    await wait('strokeW', 4); await wait('strokeDashArray', '');
    assert.equal(await page.locator('#tool-canvas [data-box-id="b"]').evaluate(el => getComputedStyle(el).borderTopStyle), 'dashed');
    assert.ok(await page.locator('#tool-canvas [data-box-id="a"] path[stroke-dasharray]').count());
    const active = await read(); assert.ok(active.every(row => JSON.parse(String(row.tokenLinks)).strokeDash.adapter === 'border.style'));
    await page.locator('[data-topbar="undo"]').click();
    await page.waitForFunction(() => ((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(input => input.id === 'boxes')!.value as Array<Record<string, unknown>>).find(row => row.id === 'a')?.strokeDashArray === '7 3');
    const undone = await read(); assert.equal(undone[0]!.strokeDashLen, 7); assert.equal(undone[0]!.strokeGapLen, 3); assert.ok(undone.every(row => !String(row.tokenLinks).includes('verification.edge')));
    await page.locator('[data-topbar="redo"]').click(); await wait('strokeW', 4);
    await page.evaluate(() => {
      const canvas = document.getElementById('tool-canvas') as CanvasCommitEl;
      const rows = canvas.__lollyModel!().find(input => input.id === 'boxes')!.value as Array<Record<string, InputValue>>;
      canvas.__lollyCommit!('boxes', rows.map(row => row.id === 'a' ? { ...row, strokeDashArray: '9 4', strokeDashLen: 9 } : row));
    });
    await page.waitForFunction(() => JSON.parse(String(((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(input => input.id === 'boxes')!.value as Array<Record<string, unknown>>)[0]!.tokenLinks)).strokeDash.custom);
    await settleEditor(page, 30000); await slot.locator('[data-design-token-property]').selectOption('__border');
    await slot.locator('[data-token-restore]').click(); await wait('strokeDashArray', '');
    await page.locator('[data-topbar="undo"]').click();
    await page.waitForFunction(() => ((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(input => input.id === 'boxes')!.value as Array<Record<string, unknown>>)[0]?.strokeDashArray === '9 4');
    await page.locator('[data-topbar="redo"]').click(); await wait('strokeDashArray', '');
    await page.locator('select[data-fld="strokeDash"]').selectOption('dotted'); await wait('strokeDash', 'dotted');
    assert.ok((await read()).every(row => JSON.parse(String(row.tokenLinks)).strokeDash.custom));
    await settleEditor(page, 30000); await slot.locator('[data-design-token-property]').selectOption('strokeDash');
    await slot.locator('[data-token-restore]').click(); await wait('strokeDash', 'dashed');
    await page.locator('.fc-insp-tabs').getByRole('button', { name: 'Canvas', exact: true }).click();
    await page.locator('.fc-seg[data-seg="lolly-doc-theme-0"] .fc-seg-btn', { hasText: 'Dark' }).click();
    await wait('stroke', '#ffffff');
    const saved = page.url(); await page.goto(saved);
    await page.waitForFunction(() => !!(document.getElementById('tool-canvas') as CanvasCommitEl)?.__lollyModel); await page.locator('dialog.view-loading[open]').waitFor({ state: 'hidden' });
    await wait('stroke', '#ffffff'); await wait('strokeW', 4); await wait('strokeDashArray', '');
    assert.ok((await read()).every(row => JSON.parse(String(row.tokenLinks)).strokeDash.ref === '{verification.edge}'));
  } finally { await context.close(); await closeBrowser(); }
});
