// SPDX-License-Identifier: MPL-2.0
/** LOLLY_MOTION_TEST_URL=http://localhost:5173 node --test tests/launch-motion.browser.test.ts */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { test } from 'node:test';
import { chromium } from 'playwright';

const origin = process.env.LOLLY_MOTION_TEST_URL;
const output = process.env.LOLLY_MOTION_TEST_OUTPUT ?? '/tmp/lolly-motion-223';
const ids = ['launch-editorial', 'launch-snap', 'launch-cascade', 'launch-loop'];

test('Launch: branded frame sampling, real previews, mobile controls and video export', { skip: !origin, timeout: 240_000 }, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  // Another local task may rebuild a profile while this export is running.
  // Freeze Vite HMR for this isolated context, so it cannot erase the test state.
  await page.routeWebSocket(url => url.hostname === new URL(origin!).hostname, socket => {
    socket.connectToServer().onMessage(message => {
      if (typeof message === 'string') {
        try { if (['update', 'full-reload'].includes(JSON.parse(message).type)) return; } catch { /* non-Vite message */ }
      }
      socket.send(message);
    });
  });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1');
  });
  try {
    await page.goto(`${origin}/#/tool/design?template=launch-editorial`, { waitUntil: 'networkidle' });
    await page.locator('.artboard').first().waitFor({ timeout: 45000 });
    await page.waitForFunction(() => Math.abs((window as any).lolly?.ui?.getState()?.t - 3.3) < .01);
    await page.screenshot({ path: `${output}/initial.png` });
    const tokenDoc = JSON.parse(await readFile(new URL('../brands/lolly-start/catalog/assets/lolly/tokens/brand.json', import.meta.url), 'utf8'));
    const installBrand = async (label: string, primary: string, secondary: string, surface: string, text: string, display: string) => {
      const doc = structuredClone(tokenDoc);
      for (const theme of ['light', 'dark']) for (const [key, value] of Object.entries({ primary, secondary, surface, text, 'on-primary': '#ffffff' })) doc[theme].color.semantic[key] = { $type: 'color', $value: value };
      doc.base.font.display = { $type: 'fontFamily', $value: display };
      await page.evaluate(async ({ doc, label }) => (window as any).__lollyInstallBrand(doc, label), { doc, label });
    };
    await installBrand('Launch Forest', '#194c3c', '#b8dc7a', '#f3f2e9', '#163c30', 'SUSE');
    await page.evaluate(async () => {
      const path = '/src/lib/host-ref.ts';
      const host = (await import(path)).getHostRef();
      const templatePath = '/src/views/template-chooser.ts';
      const templates = await Promise.all(['launch-editorial', 'launch-snap', 'launch-cascade', 'launch-loop'].map(async id => (await fetch(`/tools/design/templates/${id}.json`)).json()));
      const w = window as any;
      w.launchHost = host; w.launchTemplates = templates;
      w.launchChosen = null;
      void (await import(templatePath)).openTemplateChooser({ host, toolId: 'design', toolName: 'Design', formats: ['svg', 'png'], templates }).then((values: unknown) => { w.launchChosen = values; });
    });
    for (const id of ids) await page.locator(`[data-template-id="${id}"] .tmpl-chooser-tile-thumb`).waitFor({ timeout: 45000 });
    assert.equal(await page.locator('.template-motion-stage').count(), 0, 'reduced motion keeps posters');
    await page.screenshot({ path: `${output}/launch-collection-desktop.png` });
    const first = page.locator('[data-template-id="launch-editorial"]');
    await first.locator('[data-motion-play]').click();
    await first.locator('.template-motion-stage').waitFor({ timeout: 30000 });
    assert.equal(await page.locator('.template-motion-stage').count(), 1);
    assert.equal(await page.evaluate(() => (window as any).launchChosen), null, 'preview does not choose a template');
    await page.locator('[data-template-id="launch-snap"] [data-motion-play]').click();
    await page.locator('[data-template-id="launch-snap"] .template-motion-stage').waitFor({ timeout: 30000 });
    assert.equal(await page.locator('.template-motion-stage').count(), 1, 'only one player may survive');
    await page.setViewportSize({ width: 430, height: 932 });
    await page.screenshot({ path: `${output}/launch-collection-mobile.png` });
    const selectionStarted = performance.now();
    await page.locator('[data-template-id="launch-loop"] .tmpl-chooser-tile-name').click();
    await page.waitForFunction(() => (window as any).launchChosen !== null);
    assert.equal(await page.locator('.template-motion-stage').count(), 0, 'choosing reaps the player');
    assert.equal(await page.evaluate(() => (window as any).launchChosen.boxes.some((b: any) => b.id === 'petal-5')), true);
    const metrics: unknown[] = [];
    if (process.env.LOLLY_MOTION_EXPORT === '1') {
      const bytes = await page.evaluate(async () => {
        const path = '/src/pro/render-export.ts', w = window as any;
        const { blob } = await (await import(path)).renderRowToBlob({ toolId: 'design', values: w.launchChosen }, w.launchHost, { format: 'webm', watermark: false, embedMeta: false, c2pa: false });
        return [...new Uint8Array(await blob.arrayBuffer())];
      });
      assert.ok(bytes.length > 10000);
      metrics.push({ id: 'launch-loop', brand: 'Launch Forest', selectionToBlobMs: Math.round(performance.now() - selectionStarted), bytes: bytes.length });
      await writeFile(`${output}/launch-loop-selected.webm`, new Uint8Array(bytes));
    }
    await page.setViewportSize({ width: 960, height: 540 });
    const posesByBrand: Record<string, unknown> = {}; 
    for (const id of ids) {
      await page.evaluate(async id => {
        const path = '/src/pro/render-export.ts';
        const w = window as any;
        w.launchPreview?.destroy();
        const template = w.launchTemplates.find((t: any) => t.id === id);
        w.launchPreview = await (await import(path)).mountTemplateMotion(w.launchHost, 'design', template.values);
        w.launchPreview.stage.style.cssText = 'position:fixed;inset:0;width:960px;height:540px;background:white;z-index:999999;overflow:hidden';
        w.launchPreview.canvas.style.cssText += ';transform:scale(.5);transform-origin:0 0';
      }, id);
      await page.evaluate(() => document.fonts.ready);
      for (const ms of [0, 600, 1400, 3300, 5700]) {
        await page.evaluate(ms => (window as any).launchPreview.seek(ms), ms);
        await page.screenshot({ path: `${output}/${id}-${ms}.png` });
      }
      const brand = await page.evaluate(() => {
        const canvas = (window as any).launchPreview.canvas as HTMLElement;
        return { primary: getComputedStyle(canvas).getPropertyValue('--brand-primary'), font: getComputedStyle(canvas.querySelector('[data-box-id="headline-a"] .lolly-box-text') ?? canvas.querySelector('[data-box-id="headline"] .lolly-box-text')!).fontFamily };
      });
      assert.equal(brand.primary.trim(), '#194c3c');
      posesByBrand[id] = brand;
      const poses = await page.evaluate(() => {
        const w = window as any;
        const sample = (t: number) => {
          w.launchPreview.seek(t);
          return [...w.launchPreview.canvas.querySelectorAll('[data-t-kf]')].map((el: any) => ({ id: el.dataset.boxId, transform: el.style.transform, opacity: el.style.opacity }));
        };
        return { start: sample(0), mid: sample(3300), end: sample(5999) };
      });
      assert.notDeepEqual(poses.start, poses.mid, `${id} visibly moves`);
      if (id === 'launch-loop') assert.deepEqual(poses.start, poses.end, 'the visible loop closes');
      if (process.env.LOLLY_MOTION_EXPORT === '1') {
        const result = await page.evaluate(async id => {
          const path = '/src/pro/render-export.ts', w = window as any;
          const template = w.launchTemplates.find((t: any) => t.id === id);
          w.launchPreview.destroy(); w.launchPreview = null;
          const started = performance.now();
          const { blob } = await (await import(path)).renderRowToBlob({ toolId: 'design', values: template.values }, w.launchHost, { format: 'webm', watermark: false, embedMeta: false, c2pa: false });
          return { ms: performance.now() - started, bytes: [...new Uint8Array(await blob.arrayBuffer())], type: blob.type };
        }, id);
        assert.ok(result.bytes.length > 10000); assert.match(result.type, /webm/);
        await writeFile(`${output}/${id}.webm`, new Uint8Array(result.bytes));
        metrics.push({ id, brand: 'Launch Forest', renderMs: Math.round(result.ms), bytes: result.bytes.length });
      }
    }
    await installBrand('Launch Violet', '#493b9d', '#e7b5e8', '#f5eefa', '#322858', 'SUSE Mono');
    await page.evaluate(async () => {
      const w = window as any, path = '/src/pro/render-export.ts';
      w.launchPreview?.destroy();
      w.launchPreview = await (await import(path)).mountTemplateMotion(w.launchHost, 'design', w.launchTemplates[0].values);
      w.launchPreview.stage.style.cssText = 'position:fixed;inset:0;width:960px;height:540px;z-index:999999;overflow:hidden';
      w.launchPreview.canvas.style.cssText += ';transform:scale(.5);transform-origin:0 0';
      w.launchPreview.seek(3300);
      await document.fonts.ready;
    });
    const secondBrand = await page.evaluate(() => {
      const canvas = (window as any).launchPreview.canvas as HTMLElement;
      return { primary: getComputedStyle(canvas).getPropertyValue('--brand-primary'), font: getComputedStyle(canvas.querySelector('[data-box-id="headline-a"] .lolly-box-text')!).fontFamily };
    });
    assert.equal(secondBrand.primary.trim(), '#493b9d');
    assert.match(secondBrand.font, /SUSE Mono/);
    await page.screenshot({ path: `${output}/launch-editorial-violet.png` });
    if (process.env.LOLLY_MOTION_EXPORT === '1') {
      const result = await page.evaluate(async () => {
        const path = '/src/pro/render-export.ts', w = window as any, template = w.launchTemplates[0];
        const started = performance.now();
        const { blob } = await (await import(path)).renderRowToBlob({ toolId: 'design', values: { ...template.values, ...template.presets.find((p: any) => p.id === 'calm').values } }, w.launchHost, { format: 'mp4', watermark: false, embedMeta: false, c2pa: false });
        return { ms: performance.now() - started, bytes: [...new Uint8Array(await blob.arrayBuffer())], type: blob.type };
      });
      assert.match(result.type, /mp4/);
      await writeFile(`${output}/launch-editorial-calm.mp4`, new Uint8Array(result.bytes));
      metrics.push({ id: 'launch-editorial', preset: 'calm', brand: 'Launch Violet', format: 'mp4', renderMs: Math.round(result.ms), bytes: result.bytes.length });
    }
    await writeFile(`${output}/measurements.json`, JSON.stringify({ metrics, posesByBrand, secondBrand, errors }, null, 2));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Launch gallery preview opens the composition it demonstrates', { skip: !origin, timeout: 90_000 }, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1');
  });
  try {
    await page.route('**/catalog/tools/index*.json', async route => {
      const response = await route.fetch(), data = await response.json();
      if (Array.isArray(data.tools)) data.tools = data.tools.filter((tool: { id: string }) => tool.id === 'design').map((tool: { templates?: Array<{ motion?: unknown }> }) => ({
        ...tool, templates: tool.templates?.filter(template => template.motion),
      }));
      await route.fulfill({ response, json: data });
    });
    await page.goto(`${origin}/#/`, { waitUntil: 'networkidle' });
    const card = page.locator('.gtile[data-tool-id="design"] [data-motion-template="launch-cascade"]');
    await card.locator('.gcar-img[src]').waitFor({ timeout: 60_000 });
    await card.scrollIntoViewIfNeeded();
    assert.equal(await card.locator('.gcar-open').getAttribute('href'), '#/tool/design?template=launch-cascade');
    await card.locator('[data-motion-play]').click();
    await card.locator('.template-motion-stage').waitFor();
    assert.equal(await page.locator('.template-motion-stage').count(), 1);
    await card.locator('.gcar-open').click();
    await page.locator('.artboard [data-box-id="card-0"]').waitFor();
    await page.waitForFunction(() => Math.abs((window as any).lolly?.ui?.getState()?.t - 3.3) < .01);
    assert.equal(await page.locator('.template-motion-stage').count(), 0);
  } finally { await browser.close(); }
});
