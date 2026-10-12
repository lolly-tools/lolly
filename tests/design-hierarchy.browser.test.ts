// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium, type Page } from 'playwright';
import type { CanvasCommitEl } from '../shells/web/src/lib/canvas-commit.ts';
import { webGpuLaunchArgs } from '../packages/node-shell/src/webgpu-launch.ts';

const origin = process.env.LOLLY_HIERARCHY_TEST_URL ?? process.env.LOLLY_IMPORT_TEST_URL ?? process.env.LOLLY_EXPORT_TEST_URL;
const skip = origin ? false : 'Serve the web shell and set LOLLY_HIERARCHY_TEST_URL.';
async function source(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => Object.fromEntries((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().map(input => [input.id, input.value])));
}
async function modelField(page: Page, id: string, field: string, value: unknown): Promise<void> {
  await page.waitForFunction(({ id, field, value }) => {
    const boxes = (document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(input => input.id === 'boxes')!.value as Record<string, unknown>[];
    return boxes.find(box => box.id === id)?.[field] === value;
  }, { id, field, value });
}

test('Design pages scope the canvas locally while nested groups and document edits survive reload', { skip, timeout: 120_000 }, async () => {
  const browser = await chromium.launch({ headless: true, args: webGpuLaunchArgs('software') });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(15_000);
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    const pages = [{ id: 'one', name: 'First page' }, { id: 'two', name: 'Second page' }];
    const boxes = [
      { id: 'f1', kind: 'frame', name: 'First board', pageId: 'one', x: 0, y: 0, w: 800, h: 600 },
      { id: 'g1', kind: 'group', name: 'Card', frame: 'f1', x: 100, y: 100, w: 240, h: 180 },
      { id: 'g2', kind: 'group', name: 'Heading', group: 'g1', x: 120, y: 120, w: 200, h: 80 },
      { id: 'leaf', kind: 'box', name: 'Artwork', group: 'g2', x: 120, y: 120, w: 200, h: 80, bg: '#88c4a0' },
      { id: 'f2', kind: 'frame', name: 'Second board', pageId: 'two', x: 0, y: 0, w: 800, h: 600 },
      { id: 'other', kind: 'box', frame: 'f2', x: 60, y: 60, w: 120, h: 120, bg: '#ccaaff' },
    ];
    await page.goto(`${origin}/t/design?${new URLSearchParams({ w: '800', h: '600', pages: JSON.stringify(pages), boxes: JSON.stringify(boxes), _nav: '1', c2pa: '0', imprint: '0' })}`);
    await page.locator('[data-design-pages]').waitFor();
    await page.locator('#tool-canvas [data-frame-id="f1"]').waitFor();
    assert.equal(await page.locator('#tool-canvas [data-frame-id="f2"]').count(), 0);
    const before = await source(page), dirtyBefore = await page.locator('.is-unsaved').count();
    await page.locator('[data-page-id="two"] [data-nav-row]').click();
    await page.locator('#tool-canvas [data-frame-id="f2"]').waitFor();
    assert.equal(await page.locator('#tool-canvas [data-frame-id="f1"]').count(), 0);
    assert.equal(await page.locator('.fc-nav-layers [data-id="g1"]').count(), 0);
    assert.deepEqual(await source(page), before, 'choosing a page never writes a declared input');
    assert.equal(await page.locator('.is-unsaved').count(), dirtyBefore, 'choosing a page does not mark document dirty');
    assert.equal(new URL(page.url()).searchParams.has('page'), false);
    await page.locator('[data-page-id="one"] [data-nav-row]').click();
    await page.locator('.fc-nav-layers [data-id="g1"]').waitFor();
    const group = page.locator('.fc-nav-layers [data-id="g1"]');
    await group.click();
    assert.equal(await page.locator('[data-object-group="g1"]').evaluate(node => (node as HTMLDetailsElement).open), true, 'selecting a group row does not activate its native disclosure');
    await group.press('F2');
    const rename = page.locator('[data-nav-name-input]'); await rename.fill('Named card'); await rename.press('Enter');
    await modelField(page, 'g1', 'name', 'Named card');
    await page.locator('[data-object-group="g1"] > summary').click({ position: { x: 5, y: 12 } });
    await page.waitForFunction(() => !(document.querySelector('[data-object-group="g1"]') as HTMLDetailsElement).open);
    await page.locator('.fc-nav-layers [data-id="g1"]').press('Enter');
    await page.waitForFunction(() => document.querySelector('.fc-nav-layers [data-id="g2"]')?.getAttribute('aria-selected') === 'true').catch(async error => {
      const selected = await page.locator('.fc-nav-layers [aria-selected="true"]').evaluateAll(rows => rows.map(row => row.getAttribute('data-id')));
      assert.fail(`${error.message}; selected layers: ${JSON.stringify(selected)}; errors: ${JSON.stringify(errors)}`);
    });
    await page.locator('.fc-nav-layers [data-id="leaf"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Move outside group', exact: true }).click();
    await modelField(page, 'leaf', 'group', 'g1');
    await page.locator('#tool-canvas').focus(); await page.keyboard.press('ControlOrMeta+z');
    await modelField(page, 'leaf', 'group', 'g2');
    await page.locator('[data-add-design-page]').click();
    await page.waitForFunction(() => Array.isArray((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(input => input.id === 'pages')!.value)
      && ((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(input => input.id === 'pages')!.value as unknown[]).length === 3);
    const created = ((await source(page)).pages as Record<string, unknown>[])[2]!;
    await page.locator('[data-add-page-artboard]').click();
    await page.waitForFunction(id => {
      const rows = (document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(input => input.id === 'boxes')!.value as Record<string, unknown>[];
      return rows.some(row => row.kind === 'frame' && row.pageId === id);
    }, created.id);
    const after = await source(page);
    assert.equal((after.boxes as unknown[]).length, boxes.length + 1);
    assert.equal(await page.locator('#tool-canvas [data-frame-id="f1"]').count(), 0);
    assert.equal(await page.locator('#tool-canvas [data-frame-id="f2"]').count(), 0);
    const output = process.env.LOLLY_HIERARCHY_OUTPUT;
    if (output) {
      await mkdir(output, { recursive: true });
      await page.locator('[data-page-id="one"] [data-nav-row]').click();
      await page.locator('.fc-nav-layers [data-id="g1"]').waitFor();
      for (const theme of ['light', 'dark']) {
        await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
        await page.waitForFunction(() => getComputedStyle(document.querySelector('.fc-nav-modes [aria-pressed="true"]')!).color === getComputedStyle(document.querySelector('.fc-nav')!).color);
        await page.screenshot({ path: `${output}/hierarchy-${theme}.png` });
      }
    }
    const url = `${origin}/t/design?${new URLSearchParams({ w: '800', h: '600', pages: JSON.stringify(after.pages), boxes: JSON.stringify(after.boxes), _nav: '1', c2pa: '0', imprint: '0' })}`;
    await page.goto(url); await page.locator('.fc-nav-layers [data-id="g1"]').waitFor();
    const reloaded = await source(page);
    const identity = (value: unknown) => (value as Record<string, unknown>[]).map(row => ({ id: row.id, name: row.name, order: row.order ?? 0 }));
    assert.deepEqual(identity(reloaded.pages), identity(after.pages));
    assert.equal((reloaded.boxes as Record<string, unknown>[]).find(row => row.id === 'g1')?.name, 'Named card');
    assert.equal((reloaded.boxes as Record<string, unknown>[]).find(row => row.id === 'leaf')?.group, 'g2');
    assert.equal((reloaded.boxes as Record<string, unknown>[]).find(row => row.id === 'f2')?.pageId, 'two');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
