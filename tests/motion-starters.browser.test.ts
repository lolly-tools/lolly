// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';
import { loadTool } from '../engine/src/loader.ts';
import { parseUrlState } from '../engine/src/url-mode.ts';
import { expandQuery } from '../engine/src/url-pack.ts';
import { shellSettled } from './helpers/shell-settled.ts';

const origin = process.env.LOLLY_MOTION_TEST_URL ?? process.env.LOLLY_EXPORT_TEST_URL;
const output = process.env.LOLLY_MOTION_TEST_OUTPUT ?? 'plans/artifacts/297/motion-starters';
test('Motion collection, photo composition and non-writing choreography preview reach finished output', { skip: origin ? false : 'set LOLLY_MOTION_TEST_URL', timeout: 240000 }, async () => {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader'] });
  try {
    const page = await browser.newPage({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    page.setDefaultNavigationTimeout(90000);
    await page.routeWebSocket(url => url.hostname === new URL(origin!).hostname, socket => {
      socket.connectToServer().onMessage(message => {
        if (typeof message === 'string') { try { if (['update', 'full-reload'].includes(JSON.parse(message).type)) return; } catch { /* Non-Vite message. */ } }
        socket.send(message);
      });
    });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/t/design`, { waitUntil: 'networkidle' }); await shellSettled(page);
    await page.locator('[data-template-id="motion-photo-loop"]').waitFor();
    await page.locator('[data-template-id="motion-photo-loop"] [data-motion-play]').click();
    await page.locator('[data-template-id="motion-photo-loop"] .template-motion-stage').waitFor({ timeout: 45000 });
    assert.equal(await page.locator('.template-motion-stage').count(), 1);
    await page.screenshot({ path: `${output}/collection.png` });
    await page.goto(`${origin}/t/design?template=motion-photo-loop`, { waitUntil: 'networkidle' }); await shellSettled(page);
    await page.locator('.lolly-box[data-box-id="photo"] img').waitFor();
    await page.waitForFunction(() => { const image = document.querySelector<HTMLImageElement>('.lolly-box[data-box-id="photo"] img'); return image?.complete && image.naturalWidth > 0; });
    await page.screenshot({ path: `${output}/photo-title.png` });
    const source = JSON.parse(await readFile(new URL('../community/design/templates/motion-feature-loop.json', import.meta.url), 'utf8'));
    const ids = source.values.boxes.filter((row: { locked?: boolean }) => !row.locked).map((row: { id: string }) => row.id);
    await page.goto(`${origin}/t/design?template=motion-feature-loop&preset=long&_sel=${encodeURIComponent(ids.join(','))}`, { waitUntil: 'networkidle' }); await shellSettled(page);
    const headline = page.locator('.lolly-box[data-box-id="headline"][role="button"]');
    await headline.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Choreograph…', exact: true }).click();
    await page.locator('[data-choreo="drift-loop"]').click();
    await page.locator('[data-choreo-sec]').fill('4');
    const tool = await loadTool('design', path => readFile(new URL(`../community/${path}`, import.meta.url), 'utf8'));
    const before = parseUrlState(await expandQuery(new URL(page.url()).searchParams.toString()), tool.manifest).values;
    await page.locator('[data-choreo-preview]').click();
    await page.locator('.choreo-preview-stage').waitFor({ timeout: 45000 });
    assert.deepEqual(parseUrlState(await expandQuery(new URL(page.url()).searchParams.toString()), tool.manifest).values, before, 'preview does not alter authored URL state');
    assert.equal(await headline.getAttribute('data-t-dur'), '8000', 'source duration stays intact during preview');
    await page.locator('[data-choreo-scrub]').focus(); await page.locator('[data-choreo-scrub]').press('End');
    assert.equal(await page.locator('[data-choreo-preview]').getAttribute('aria-pressed'), 'false');
    assert.match(await page.locator('[data-choreo-preview-status]').innerText(), /4\.0 \/ 4\.0/);
    await page.screenshot({ path: `${output}/preview-desktop.png` });
    await page.setViewportSize({ width: 430, height: 932 });
    await page.waitForFunction(() => { const bounds = document.querySelector('.fc-choreo-panel')!.getBoundingClientRect(); return bounds.left >= 0 && bounds.right <= innerWidth && bounds.bottom <= innerHeight - 60; });
    await page.screenshot({ path: `${output}/preview-mobile.png` });
    await page.locator('[data-choreo-sec]').fill('5');
    assert.equal(await page.locator('.choreo-preview-stage').count(), 0, 'settings dispose the old player');
    await page.locator('[data-choreo-sec]').fill('4');
    await page.locator('[data-choreo-yes]').click();
    await page.locator('.fc-choreo-panel').waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.querySelector('.lolly-box[data-box-id="headline"]')?.getAttribute('data-t-dur') === '4000');
    await page.locator('.tl-panel').waitFor();
    const state = parseUrlState(await expandQuery(new URL(page.url()).searchParams.toString()), tool.manifest);
    if (process.env.LOLLY_MOTION_UI_EXPORT) {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.locator('[data-topbar="export"]').click();
      await page.locator('[data-fmt-trigger]').click();
      if (!await page.locator('[data-fmt="webm"]').isVisible()) await page.locator('[data-fmt-show-all]').click();
      await page.locator('[data-fmt="webm"]').click();
      const saving = page.waitForEvent('download', { timeout: 120000 });
      await page.locator('[data-action="download"]').click();
      const download = await saving;
      await download.saveAs(`${output}/feature-loop.webm`);
      assert.equal(await download.failure(), null);
      assert.ok((await readFile(`${output}/feature-loop.webm`)).length > 1000);
    } else {
    const result = await page.evaluate(async serialized => {
      const values = JSON.parse(serialized);
      const hostPath = '/src/lib/host-ref.ts', renderPath = '/src/pro/render-export.ts';
      const host = (await import(hostPath)).getHostRef();
      const { blob } = await (await import(renderPath)).renderRowToBlob({ toolId: 'design', values }, host, { format: 'webm', watermark: false, embedMeta: false, c2pa: false });
      return [...new Uint8Array(await blob.arrayBuffer())];
    }, JSON.stringify(state.values));
    await writeFile(`${output}/feature-loop.webm`, new Uint8Array(result));
    }
    await page.goto(`${origin}/t/darkroom?template=motion-warm`, { waitUntil: 'networkidle' }); await shellSettled(page);
    await page.getByRole('button', { name: 'Import Adobe photo preset', exact: true }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('filmLook'), 'portrait');
    assert.deepEqual(errors, []);
  } catch (error) {
    for (const page of browser.contexts().flatMap(context => context.pages())) {
      await page.screenshot({ path: `${output}/failure.png` }).catch(() => {});
    }
    throw error;
  } finally { await browser.close(); }
});
