// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { webGpuLaunchArgs } from '../packages/node-shell/src/webgpu-launch.ts';

const origin = process.env.LOLLY_IMPORT_TEST_URL ?? process.env.LOLLY_EXPORT_TEST_URL;
const skip = origin ? false : 'Serve the web shell and set LOLLY_EXPORT_TEST_URL.';

test('guide preview work stays bounded on a canvas with 1,000 guides', { skip, timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ headless: true, args: webGpuLaunchArgs('software') });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(origin!);
    const result = await page.evaluate(async () => {
      const path = '/src/views/design-guides.ts';
      const { mountDesignGuides, serializeGuideRecords } = await import(path);
      const stage = document.createElement('div');
      stage.style.cssText = 'position:fixed;left:0;top:0;width:1200px;height:900px;z-index:9999';
      const canvas = document.createElement('div');
      canvas.style.cssText = 'position:absolute;left:100px;top:100px;width:1000px;height:800px';
      stage.append(canvas); document.body.append(stage);
      let value = serializeGuideRecords(Array.from({ length: 1000 }, (_, i) => ({
        id: `g${i}`, x: 0, y: 250 + i / 2, rotation: 0, color: '', snap: true,
      })));
      let commits = 0;
      const handle = mountDesignGuides({
        stageEl: stage, canvasEl: canvas, read: () => value,
        commit: (next: string) => { value = next; commits++; },
      });
      const target = stage.querySelector<HTMLElement>('[data-guide-id="g0"]')!;
      const tick = stage.querySelector('.fc-ruler-x svg')!.firstChild;
      const pointer = (type: string, y: number) => target.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId: 7, button: 0, clientX: 400, clientY: y,
      }));
      pointer('pointerdown', 350);
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      let canvasReads = 0, stageReads = 0;
      const canvasRect = canvas.getBoundingClientRect.bind(canvas);
      const stageRect = stage.getBoundingClientRect.bind(stage);
      canvas.getBoundingClientRect = () => { canvasReads++; return canvasRect(); };
      stage.getBoundingClientRect = () => { stageReads++; return stageRect(); };
      const changes: MutationRecord[] = [];
      const observer = new MutationObserver(rows => changes.push(...rows));
      observer.observe(handle.el, { subtree: true, attributes: true, childList: true, characterData: true });
      for (let i = 0; i < 20; i++) pointer('pointermove', 360 + i);
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      changes.push(...observer.takeRecords()); observer.disconnect();
      const inactiveMutations = changes.filter(row => {
        const element = row.target instanceof Element ? row.target : row.target.parentElement;
        const line = element?.closest('.fc-author-guide');
        return line && line.getAttribute('data-guide-id') !== 'g0';
      }).length;
      const result = {
        canvasReads, stageReads, mutations: changes.length, inactiveMutations,
        commitsDuringPreview: commits,
        sameTick: tick === stage.querySelector('.fc-ruler-x svg')!.firstChild,
        sameGuide: target === stage.querySelector('[data-guide-id="g0"]'),
        commitsAfterRelease: 0,
        finalPosition: 0,
        guideCountAfterCreationAttempts: 0,
        commitsAfterCreationAttempts: 0,
      };
      pointer('pointerup', 379);
      result.commitsAfterRelease = commits;
      result.finalPosition = JSON.parse(value.slice(2))[0][2];
      const ruler = stage.querySelector<HTMLElement>('.fc-ruler-x')!;
      for (const [type, y] of [['pointerdown', 10], ['pointermove', 300], ['pointerup', 300]] as const) {
        ruler.dispatchEvent(new PointerEvent(type, {
          bubbles: true, cancelable: true, pointerId: 8, button: 0, clientX: 400, clientY: y,
        }));
      }
      ruler.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      result.guideCountAfterCreationAttempts = stage.querySelectorAll('.fc-author-guide').length;
      result.commitsAfterCreationAttempts = commits;
      handle.destroy(); stage.remove();
      return result;
    });
    assert.ok(result.canvasReads <= 1, JSON.stringify(result));
    assert.ok(result.stageReads <= 1, JSON.stringify(result));
    assert.ok(result.mutations < 100, JSON.stringify(result));
    assert.equal(result.inactiveMutations, 0);
    assert.equal(result.commitsDuringPreview, 0);
    assert.equal(result.commitsAfterRelease, 1);
    assert.equal(result.finalPosition, 279);
    assert.equal(result.sameTick, true);
    assert.equal(result.sameGuide, true);
    assert.equal(result.guideCountAfterCreationAttempts, 1000);
    assert.equal(result.commitsAfterCreationAttempts, 1);
  } finally { await browser.close(); }
});

test('Design ruler feedback and exact guide edits survive cancel, undo and zoom', { skip, timeout: 90_000 }, async () => {
  const browser = await chromium.launch({ headless: true, args: webGpuLaunchArgs('software') });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(15_000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const boxes = [{ id: 'a', kind: 'box', x: 120, y: 160, w: 120, h: 80, bg: '#88c4a0' }];
    const guides = '2|[["horizontal",0,300,0,"",true]]';
    await page.goto(`${origin}/t/design?${new URLSearchParams({
      w: '800', h: '600', boxes: JSON.stringify(boxes), guides, _sel: 'a', c2pa: '0', imprint: '0',
    })}`);
    await page.locator('#tool-canvas [data-box-id="a"]').waitFor();
    const guideValue = () => page.evaluate(() => {
      const canvas = document.getElementById('tool-canvas') as import('../shells/web/src/lib/canvas-commit.ts').CanvasCommitEl;
      return String(canvas.__lollyModel!().find(input => input.id === 'guides')!.value);
    });
    const coordinate = async () => JSON.parse((await guideValue()).slice(2))[0]?.[2] as number | undefined;
    const undo = async () => {
      await page.waitForFunction(() => !document.querySelector('dialog[open]'));
      await page.locator('#tool-canvas').focus();
      await page.keyboard.press('ControlOrMeta+z');
      await page.waitForFunction(() => {
        const canvas = document.getElementById('tool-canvas') as import('../shells/web/src/lib/canvas-commit.ts').CanvasCommitEl;
        const wire = String(canvas.__lollyModel!().find(input => input.id === 'guides')!.value);
        return wire.startsWith('2|') && JSON.parse(wire.slice(2))[0]?.[2] === 300;
      });
      await page.locator('.fc-author-guide[data-guide-id="horizontal"]').waitFor();
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
    };
    const band = page.locator('.fc-ruler-selection-x');
    await band.waitFor({ state: 'visible' });
    assert.equal(Number(await band.locator('[data-selection-edge="min"]').textContent()), 120);
    assert.equal(Number(await band.locator('[data-selection-edge="max"]').textContent()), 240);

    const point = async () => page.locator('#tool-canvas').evaluate(canvas => {
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + 300 * rect.height / 600 };
    });
    const start = await point();
    const output = process.env.LOLLY_DESIGN_GUIDE_OUTPUT;
    if (output) {
      await mkdir(output, { recursive: true });
      await page.mouse.move(start.x, start.y);
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
        await page.screenshot({ path: `${output}/ux-guides-${theme}.png` });
      }
    }
    await page.mouse.click(start.x, start.y);
    const pill = page.locator('.fc-guide-pill[data-guide-id="horizontal"]');
    await pill.dblclick();
    const editor = page.locator('input[data-guide-position]');
    const editorBounds = await editor.boundingBox();
    assert.ok(editorBounds && editorBounds.width > editorBounds.height, 'exact guide entry stays upright beside either ruler');
    if (output) await page.screenshot({ path: `${output}/ux-guide-editor.png` });
    await editor.fill('365.5');
    await editor.press('Enter');
    await page.waitForFunction(() => {
      const canvas = document.getElementById('tool-canvas') as import('../shells/web/src/lib/canvas-commit.ts').CanvasCommitEl;
      return String(canvas.__lollyModel!().find(input => input.id === 'guides')!.value).includes('365.5');
    });
    assert.equal(await coordinate(), 365.5);
    await undo();

    const drag = await point();
    await page.mouse.move(drag.x, drag.y); await page.mouse.down();
    await page.mouse.move(drag.x, drag.y + 40, { steps: 12 });
    assert.equal(await coordinate(), 300, 'drag feedback leaves the document unchanged until release');
    await page.keyboard.press('Escape'); await page.mouse.up();
    assert.equal(await coordinate(), 300);
    await page.mouse.move(drag.x, drag.y); await page.mouse.down();
    await page.mouse.move(drag.x, drag.y + 40, { steps: 12 }); await page.mouse.up();
    assert.notEqual(await coordinate(), 300);
    await undo();

    const ruler = await page.locator('.fc-ruler-x').boundingBox();
    assert.ok(ruler);
    const remove = await point();
    await page.mouse.move(remove.x, remove.y); await page.mouse.down();
    await page.mouse.move(remove.x, ruler.y + ruler.height / 2, { steps: 12 });
    await page.locator('.fc-authoring-guides.is-guide-removing').waitFor();
    await page.mouse.up();
    assert.equal(await page.locator('.fc-author-guide').count(), 0);
    await undo();

    await page.locator('#tool-canvas [data-box-id="a"]').click();
    const tick = await page.locator('.fc-ruler-x svg').evaluate(svg => svg.childElementCount);
    assert.ok(tick > 0);
    await page.waitForFunction(() => !document.querySelector('dialog[open]'));
    const beforeZoom = await page.locator('#tool-canvas').evaluate(canvas => canvas.getBoundingClientRect().width);
    await page.locator('#tool-canvas').focus(); await page.keyboard.press('=');
    await page.waitForFunction(before => document.querySelector('#tool-canvas')!.getBoundingClientRect().width > before, beforeZoom);
    await band.waitFor({ state: 'visible' });
    assert.equal(Number(await band.locator('[data-selection-edge="min"]').textContent()), 120);
    assert.equal(await page.locator('#tool-canvas .fc-authoring-guides').count(), 0);
    assert.equal(await page.locator('.fc-authoring-guides').getAttribute('data-export-hide'), '');
    const svg = await page.evaluate(async () => {
      const path = '/src/bridge/export-svg-walker.ts';
      const { renderSvgFromHtml } = await import(path);
      return (await renderSvgFromHtml(document.querySelector('#tool-canvas')!, {
        format: 'svg', convertPaths: false, embedMeta: false,
      })).text();
    });
    assert.doesNotMatch(svg, /fc-guide-pill|fc-ruler-selection|fc-author-guide/);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
