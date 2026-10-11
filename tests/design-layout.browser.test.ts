// SPDX-License-Identifier: MPL-2.0
/** Use a local Vite shell to exercise layout intent through the real Design UI. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import type { Page } from 'playwright';
import type { CanvasCommitEl } from '../shells/web/src/lib/canvas-commit.ts';
import { webGpuLaunchArgs } from '../packages/node-shell/src/webgpu-launch.ts';

const origin =
  process.env.LOLLY_LAYOUT_TEST_URL ??
  process.env.LOLLY_IMPORT_TEST_URL ??
  process.env.LOLLY_EXPORT_TEST_URL;
async function source(
  page: Page
): Promise<{ boxes: Array<Record<string, unknown>>; tracks: Array<Record<string, unknown>> }> {
  return page.evaluate(() => {
    const model = (document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!();
    return {
      boxes: model.find((input) => input.id === 'boxes')!.value as Array<Record<string, unknown>>,
      tracks: model.find((input) => input.id === 'layoutTracks')!.value as Array<
        Record<string, unknown>
      >,
    };
  });
}
async function settled(page: Page, id: string, field: string, value: unknown): Promise<void> {
  await page.waitForFunction(
    ({ id, field, value }) => {
      const model = (document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!();
      return (
        (model.find((input) => input.id === 'boxes')!.value as Array<Record<string, unknown>>).find(
          (row) => row.id === id
        )?.[field] === value
      );
    },
    { id, field, value }
  );
}
async function undo(page: Page): Promise<void> {
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  await page.locator('#tool-canvas').focus();
  await page.keyboard.press('ControlOrMeta+z');
}
async function editTracks(
  page: Page,
  axis: 'column' | 'row',
  definitions: Array<{ value: number; unit: 'px' | 'fr' }>
): Promise<void> {
  const editor = page.locator('[data-layout-grid-editor]');
  if (!(await editor.isVisible())) await page.locator('[data-layout-edit-grid]').click();
  const section = page.locator(`details[data-layout-track-section="${axis}"]`);
  if (!(await section.evaluate((element) => (element as HTMLDetailsElement).open)))
    await section.locator('summary').click();
  for (let count = (await source(page)).tracks.filter((track) => track.axis === axis).length;
    count < definitions.length; count++) {
    await page.locator(`[data-layout-track-action="add"][data-layout-axis="${axis}"]`).click();
    await page.waitForFunction(({ axis, count }) => {
      const tracks = (document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!()
        .find((input) => input.id === 'layoutTracks')!.value as Array<Record<string, unknown>>;
      return tracks.filter((track) => track.axis === axis).length === count + 1;
    }, { axis, count });
  }
  const ids = (await source(page)).tracks.filter((track) => track.axis === axis).map((track) => track.id);
  for (const [index, definition] of definitions.entries()) {
    const selector = `[data-layout-axis="${axis}"][data-layout-track-id="${ids[index]}"]`;
    await page.locator(`select[data-layout-track-unit]${selector}`).selectOption(definition.unit);
    const input = page.locator(`input[data-layout-track-value]${selector}`);
    await input.fill(String(definition.value));
    await input.press('Tab');
    await page.waitForFunction(({ id, expected }) => {
      const tracks = (document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!()
        .find((input) => input.id === 'layoutTracks')!.value as Array<Record<string, unknown>>;
      return tracks.find((track) => track.id === id)?.track === expected;
    }, { id: ids[index], expected: `${definition.value}${definition.unit}` });
  }
  assert.deepEqual((await source(page)).tracks.filter((track) => track.axis === axis).map((track) => track.id), ids);
}

test('Design inspector, layout gestures and undo commit authored intent while the canvas reflows', {
  skip: origin ? false : 'Set LOLLY_IMPORT_TEST_URL or LOLLY_EXPORT_TEST_URL to a local Vite shell.',
  timeout: 150_000,
}, async () => {
  const browser = await chromium.launch({
    headless: true,
    args: webGpuLaunchArgs('software'),
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'reduce',
    });
    page.setDefaultTimeout(20_000);
    const rows = [
      {
        id: 'root',
        kind: 'frame',
        x: 0,
        y: 0,
        w: 400,
        h: 220,
        layout: 'flex',
        layoutDirection: 'row',
        layoutGapX: 12,
        layoutPadLeft: 10,
      },
      {
        id: 'a',
        kind: 'box',
        x: 0,
        y: 0,
        w: 80,
        h: 70,
        layoutOwner: 'root',
        frame: '',
        layoutOrder: 0,
        bg: '#c0d6fd',
      },
      {
        id: 'b',
        kind: 'box',
        x: 0,
        y: 0,
        w: 80,
        h: 70,
        layoutOwner: 'root',
        frame: '',
        layoutOrder: 1,
        layoutW: 'fill',
        bg: '#aceac3',
      },
    ];
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(
      `${origin}/t/design?${new URLSearchParams({ boxes: JSON.stringify(rows), _sel: 'root', c2pa: '0', imprint: '0' })}`
    );
    const item = (id: string) => page.locator(`#tool-canvas [data-box-id="${id}"]`);
    const left = (id: string) =>
      item(id).evaluate((element) => parseFloat((element as HTMLElement).style.left));
    await item('a').waitFor();
    const original = await source(page);
    assert.equal(await left('a'), 10);
    assert.equal(await left('b'), 102);
    assert.equal(await page.locator('[data-layout-advanced]').evaluate((element) => (element as HTMLDetailsElement).open), false);
    const padding = page.locator('input[data-layout-number="padding-vertical"]');
    if (!(await padding.isVisible())) await page.locator('button[data-layout-ui="padding"]').click();
    await padding.fill('16');
    await padding.press('Tab');
    await settled(page, 'root', 'layoutPadTop', 16);
    await settled(page, 'root', 'layoutPadBottom', 16);
    await undo(page);
    await page.waitForFunction(() => {
      const rows = (document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!()
        .find((input) => input.id === 'boxes')!.value as Array<Record<string, unknown>>;
      const root = rows.find((row) => row.id === 'root')!;
      return root.layoutPadTop === undefined && root.layoutPadBottom === undefined;
    });
    await page.locator('button[data-layout-field="layoutDirection"][data-layout-value="column"]').click();
    await settled(page, 'root', 'layoutDirection', 'column');
    await page.waitForFunction(
      () => parseFloat((document.querySelector('[data-box-id="b"]') as HTMLElement).style.top) > 0
    );
    const column = await source(page);
    assert.deepEqual(
      column.boxes.slice(1).map((row) => [row.x, row.y, row.frame, row.layoutOwner]),
      original.boxes.slice(1).map((row) => [row.x, row.y, row.frame, row.layoutOwner])
    );
    await undo(page);
    await settled(page, 'root', 'layoutDirection', 'row');
    await page.waitForFunction(
      () => (document.querySelector('[data-box-id="b"]') as HTMLElement).style.left === '102px'
    );
    await page.locator('.fc-nav-layer[data-id="a"]').click();
    const before = await item('a').boundingBox(),
      target = await item('b').boundingBox();
    assert.ok(before && target);
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      target.x + target.width * 0.8,
      target.y + Math.min(20, target.height / 2),
      { steps: 10 }
    );
    await page.mouse.up();
    await settled(page, 'a', 'layoutOrder', 1);
    const moved = await source(page);
    assert.equal(moved.boxes[1]!.x, original.boxes[1]!.x);
    assert.equal(moved.boxes[1]!.y, original.boxes[1]!.y);
    await undo(page);
    await settled(page, 'a', 'layoutOrder', 0);
    await page.waitForFunction(
      () =>
        (document.querySelector('[data-box-id="a"]') as HTMLElement).style.left === '10px' &&
        (document.querySelector('[data-box-id="b"]') as HTMLElement).style.left === '102px'
    );
    await page.waitForFunction(() => !document.querySelector('dialog[open]'));
    await page.locator('#tool-canvas').focus();
    await page.keyboard.press('ArrowRight');
    await settled(page, 'a', 'layoutOrder', 1);
    assert.equal((await source(page)).boxes[1]!.x, original.boxes[1]!.x);
    await undo(page);
    await settled(page, 'a', 'layoutOrder', 0);
    await page.locator('.fc-nav-layer[data-id="b"]').click();
    const handle = await page.locator('.fc-h-e').boundingBox();
    assert.ok(handle);
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2 - 60, handle.y + handle.height / 2, {
      steps: 8,
    });
    await page.mouse.up();
    await settled(page, 'b', 'layoutW', 'fixed');
    assert.equal((await source(page)).boxes[2]!.layoutOwner, 'root');
    await undo(page);
    await settled(page, 'b', 'layoutW', 'fill');
    await page.locator('[data-jump-artboard="root"]').first().click();
    await page.locator('button[data-layout-field="layout"][data-layout-value="grid"]').click();
    await settled(page, 'root', 'layout', 'grid');
    await editTracks(page, 'column', [{ value: 120, unit: 'px' }, { value: 1, unit: 'fr' }]);
    await page.waitForFunction(
      () =>
        (document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(
          (input) => input.id === 'layoutTracks'
        )!.value &&
        (document.querySelector('[data-box-id="b"]') as HTMLElement).style.left === '142px'
    );
    const tracks = (await source(page)).tracks;
    assert.deepEqual(
      tracks.map((track) => track.track),
      ['120px', '1fr']
    );
    assert.equal(new Set(tracks.map((track) => track.id)).size, 2);
    await editTracks(page, 'row', [{ value: 80, unit: 'px' }, { value: 1, unit: 'fr' }]);
    await page.waitForFunction(
      () => document.querySelectorAll('.fc-layout-overlay polygon').length === 4
    );
    await page.locator('.fc-nav-layer[data-id="b"]').click();
    const box = await item('b').boundingBox();
    assert.ok(box);
    await page.mouse.move(box.x + box.width / 2, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 230, { steps: 12 });
    await page.mouse.up();
    await settled(page, 'b', 'layoutRow', 2);
    await settled(page, 'b', 'layoutColumn', 2);
    assert.equal((await source(page)).boxes[2]!.y, original.boxes[2]!.y);
    const placed = await source(page);
    await page.locator('[data-jump-artboard="root"]').first().click();
    const firstColumn = placed.tracks.find((track) => track.axis === 'column' && track.order === 0)!;
    await page.locator(`button[data-layout-track-action="remove"][data-layout-track-id="${firstColumn.id}"]`).click();
    await settled(page, 'b', 'layoutColumn', 1);
    assert.equal((await source(page)).tracks.length, placed.tracks.length - 1);
    await undo(page);
    await settled(page, 'b', 'layoutColumn', 2);
    assert.deepEqual((await source(page)).tracks, placed.tracks);
    await undo(page);
    await page.waitForFunction(
      () =>
        !(
          (document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(
            (input) => input.id === 'boxes'
          )!.value as Array<Record<string, unknown>>
        ).find((row) => row.id === 'b')!.layoutRow
    );
    if (process.env.LOLLY_LAYOUT_TEST_SCREENSHOT)
      await page.screenshot({ path: process.env.LOLLY_LAYOUT_TEST_SCREENSHOT });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
