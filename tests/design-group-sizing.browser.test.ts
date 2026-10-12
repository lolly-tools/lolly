// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, type Page } from 'playwright';
import type { CanvasCommitEl } from '../shells/web/src/lib/canvas-commit.ts';
import { webGpuLaunchArgs } from '../packages/node-shell/src/webgpu-launch.ts';

const origin = process.env.LOLLY_LAYOUT_TEST_URL ?? process.env.LOLLY_HIERARCHY_TEST_URL
  ?? process.env.LOLLY_IMPORT_TEST_URL ?? process.env.LOLLY_EXPORT_TEST_URL;
const skip = origin ? false : 'Set LOLLY_LAYOUT_TEST_URL to a local web shell.';
async function boxes(page: Page): Promise<Record<string, unknown>[]> {
  return page.evaluate(() => (document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!()
    .find(input => input.id === 'boxes')!.value as Record<string, unknown>[]);
}
async function number(page: Page, field: string, value: number): Promise<void> {
  await page.waitForFunction(({ field, value }) => Number(document.querySelector<HTMLInputElement>(`input[data-nf="f:${field}"]`)?.value) === value, { field, value });
}

test('standalone group Hug measures visible content and numeric resize preserves its painted origin with Undo', { skip, timeout: 90000 }, async () => {
  const browser = await chromium.launch({ headless: true, args: webGpuLaunchArgs('software') });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const source = [
      { id: 'g', kind: 'group', name: 'Card', x: 0, y: 0, w: 100, h: 100 },
      { id: 'leaf', kind: 'box', group: 'g', x: 20, y: 30, w: 40, h: 50, bg: '#88c4a0' },
      { id: 'edge', kind: 'box', group: 'g', x: 80, y: 90, w: 20, h: 10, bg: '#ccaaff' },
      { id: 'hidden', kind: 'box', group: 'g', x: 500, y: 500, w: 100, h: 100, hidden: true },
    ];
    await page.goto(`${origin}/t/design?${new URLSearchParams({ boxes: JSON.stringify(source), _nav: '1', c2pa: '0', imprint: '0' })}`);
    await page.locator('.fc-nav-layers [data-id="g"]').click();
    const original = await boxes(page);
    for (const axis of ['W', 'H']) await page.locator(`button[data-layout-field="layout${axis}"][data-layout-value="hug"]`).click();
    await number(page, 'w', 80); await number(page, 'h', 70); await number(page, 'x', 20); await number(page, 'y', 30);
    const hugged = await boxes(page);
    assert.deepEqual(hugged.slice(1), original.slice(1));
    assert.equal(hugged[0]!.w, 100); assert.equal(hugged[0]!.h, 100);
    const width = page.locator('input[data-nf="f:w"]');
    if (!(await width.isVisible())) await page.locator('[data-head="object"]').click();
    await width.fill('160'); await width.press('Enter');
    await page.waitForFunction(() => ((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(input => input.id === 'boxes')!.value as Record<string, unknown>[])[0]!.layoutW === 'fixed');
    await number(page, 'w', 160); await number(page, 'x', 20);
    assert.equal((await boxes(page))[0]!.layoutH, 'hug');
    await page.getByRole('button', { name: 'Undo', exact: true }).first().click();
    await page.waitForFunction(() => ((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(input => input.id === 'boxes')!.value as Record<string, unknown>[])[0]!.layoutW === 'hug');
    await number(page, 'w', 80); await number(page, 'x', 20);
    assert.deepEqual(await boxes(page), hugged);
  } finally { await browser.close(); }
});

test('group Fill controls allocate descendants without persisting the solver geometry', { skip, timeout: 90000 }, async () => {
  const browser = await chromium.launch({ headless: true, args: webGpuLaunchArgs('software') });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const source = [
      { id: 'f', kind: 'frame', x: 0, y: 0, w: 400, h: 200, layout: 'flex' },
      { id: 'g', kind: 'group', name: 'Card', layoutOwner: 'f', x: 20, y: 30, w: 100, h: 100 },
      { id: 'leaf', kind: 'box', group: 'g', x: 20, y: 30, w: 50, h: 100, bg: '#88c4a0' },
    ];
    await page.goto(`${origin}/t/design?${new URLSearchParams({ boxes: JSON.stringify(source), _nav: '1', c2pa: '0', imprint: '0' })}`);
    await page.locator('.fc-nav-layers [data-id="g"]').click();
    const original = await boxes(page);
    await page.locator('button[data-layout-field="layoutW"][data-layout-value="fill"]').click();
    await number(page, 'w', 400);
    await page.waitForFunction(() => Math.abs(parseFloat((document.querySelector('[data-box-id="leaf"]') as HTMLElement).style.width) - 200) < .01);
    const filled = await boxes(page);
    assert.equal(filled[1]!.layoutW, 'fill');
    for (let n = 0; n < source.length; n++) {
      for (const field of ['x', 'y', 'w', 'h']) assert.equal(filled[n]![field], original[n]![field]);
    }
    await page.locator('#tool-canvas').focus(); await page.keyboard.press('ControlOrMeta+z');
    await number(page, 'w', 100);
    assert.deepEqual(await boxes(page), original);
  } finally { await browser.close(); }
});
