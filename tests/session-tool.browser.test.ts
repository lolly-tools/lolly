// SPDX-License-Identifier: MPL-2.0
/** Set LOLLY_DESIGN_TOOL_TEST_URL to exercise saved-session and template handoffs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import { settledUrl } from './helpers/settled-address.ts';
const origin = process.env.LOLLY_DESIGN_TOOL_TEST_URL;
const skip = origin ? false : 'Serve the web shell and set LOLLY_DESIGN_TOOL_TEST_URL.';
const output = process.env.LOLLY_DESIGN_TOOL_TEST_OUTPUT || '/tmp/lolly-session-tool-261';
const browserType = process.env.LOLLY_DESIGN_TOOL_TEST_BROWSER === 'webkit' ? webkit : chromium;

test('saved QR session becomes a restricted portable tool; original stays intact and reader works offline', { skip, timeout: 180_000 }, async () => {
  await mkdir(output, { recursive: true });
  const browser = await browserType.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    page.setDefaultTimeout(25_000);
    await page.goto(`${origin}/t/qr-code?url=https%3A%2F%2Flolly.tools&color=%23123456`);
    await page.locator('#tool-canvas svg').waitFor();
    const before = await page.evaluate(async () => {
      const path = '/src/bridge/index.ts'; const { createBridge } = await import(path); const host = await createBridge();
      const values = { __label: 'Saved QR', __toolId: 'qr-code', __toolVersion: '2.6.1', url: 'https://lolly.tools', color: '#123456', background: '#ffffff', transparentBg: true };
      await host.state.save('qr-code:rules-fixture', values, ''); return host.state.load('qr-code:rules-fixture');
    });
    await page.goto(`${origin}/#/p/__uncat__`);
    const tile = page.locator('.folder-tile[data-kind="session"]').filter({ hasText: 'Saved QR' });
    await tile.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Share with rules', exact: true }).click();
    await page.locator('.sr-dialog').waitFor();
    await page.locator('[data-source-input="url"]').check();
    await page.locator('[data-source-input="padding"]').check();
    const row = page.locator('.dr-input').filter({ has: page.locator('[data-source-input="url"]') });
    const grab = row.locator('[data-reorder-handle]'); await grab.focus();
    await page.keyboard.press('Space'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Space');
    assert.equal(await grab.getAttribute('aria-pressed'), 'false');
    await page.getByLabel('Find an input', { exact: true }).fill('url');
    await page.locator('.sr-inputs .sr-disclosure').click();
    await page.getByLabel('Input label', { exact: true }).fill('Destination');
    await page.getByLabel('Maximum characters', { exact: true }).fill('100');
    await page.getByLabel('Maximum characters', { exact: true }).press('Tab');
    await page.getByLabel('Find an input', { exact: true }).fill('');
    for (const width of [1440, 640, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      const contained = await page.locator('.sr-dialog').evaluate(el => {
        const rect = el.getBoundingClientRect();
        return { fits: rect.left >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight, font: getComputedStyle(el).fontFamily, scroll: el.scrollWidth <= el.clientWidth };
      });
      assert.ok(contained.fits && contained.scroll); assert.ok(contained.font);
      await page.screenshot({ path: `${output}/session-rules-${width}.png` });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('.sr-dialog').getByRole('button', { name: 'Share .lolly', exact: true }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.dr-share [data-download]').click();
    const download = await downloadPromise.catch(async error => { console.error(await page.locator('.dr-share').innerText()); throw error; });
    await download.saveAs(`${output}/qr-rules.lolly`);
    await page.getByRole('button', { name: 'Try downloaded file', exact: true }).click();
    await page.locator('.dr-trial .lolly-locked-design svg').waitFor();
    await page.getByRole('button', { name: 'Back to authoring', exact: true }).click();
    assert.deepEqual(await page.evaluate(async () => { const p = '/src/bridge/index.ts'; return (await (await import(p)).createBridge()).state.load('qr-code:rules-fixture'); }), before);
    const reader = await browser.newPage({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    await reader.goto(`${origin}/`);
    await reader.evaluate(async bytes => {
      const drop = '/src/lib/drop-router.ts', bridge = '/src/bridge/index.ts';
      const [{ openLollyFile }, { createBridge }] = await Promise.all([import(drop), import(bridge)]);
      void openLollyFile(new File([new Uint8Array(bytes)], 'qr-rules.lolly'), await createBridge());
    }, [...await readFile(`${output}/qr-rules.lolly`)]);
    await reader.getByRole('button', { name: 'Trust & install', exact: true }).click();
    await reader.locator('.lolly-locked-design svg').waitFor();
    assert.equal(await reader.locator('[data-input-id="color"]').count(), 0);
    const controls = await reader.locator('#tool-panel [data-input-id]').count(); assert.ok(controls <= 2);
    const url = reader.getByLabel('Destination', { exact: true });
    const original = await reader.locator('.lolly-locked-design svg').innerHTML();
    await url.fill('https://lolly.tools/info/create/create-a-tool.html'); await url.press('Tab');
    await reader.waitForFunction(previous => document.querySelector('.lolly-locked-design svg')?.innerHTML !== previous, original);
    await reader.evaluate(async () => {
      const loader = '/src/bridge/tool-loader.ts', bridge = '/src/bridge/index.ts', mounts = '/src/lib/mount-runtime.ts', installer = '/src/lib/installed-tools.ts';
      const [{ getTool }, { createBridge }, { createToolRuntime }, installed] = await Promise.all([import(loader), import(bridge), import(mounts), import(installer)]);
      const meta = (await installed.installedToolMetas())[0], tool = await getTool(meta.id, meta.artifactDigest);
      const host = await createBridge(); const runtime = await createToolRuntime(tool, host);
      Reflect.set(window, 'exportSessionFixture', async () => {
        const input = tool.manifest.inputs.find((i: { label: string }) => i.label === 'Destination');
        await runtime.setInput(input.id, 'https://example.org/portable');
        const canvas = document.querySelector<HTMLElement>('#tool-canvas')!; canvas.innerHTML = runtime.getHydrated();
        const results = [];
        for (const format of ['png', 'svg', 'pdf']) { const blob = await runtime.export(canvas, format, { width: 600, height: 600, embedMeta: false, watermark: false, c2pa: false, imprint: false }); results.push({ format, size: blob.size }); }
        return results;
      });
    });
    const online = await reader.evaluate(() => Reflect.get(window, 'exportSessionFixture')());
    await reader.route(/^https?:/, route => route.abort());
    const offline = await reader.evaluate(() => Reflect.get(window, 'exportSessionFixture')());
    assert.deepEqual(offline.map((r: {format:string}) => r.format), ['png', 'svg', 'pdf']);
    for (const result of [...online, ...offline]) assert.ok(result.size > 500);
    await reader.screenshot({ path: `${output}/session-reader.png` });
  } finally { await browser.close(); }
});

test('an existing Design template opens Rules in a separate authoring copy', { skip, timeout: 90_000 }, async () => {
  const browser = await browserType.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(`${origin}/t/qr-code`);
    await page.locator('#tool-canvas svg').waitFor();
    const template = await page.evaluate(async () => {
      const b = '/src/bridge/index.ts', s = '/src/lib/user-templates.ts';
      const [{ createBridge }, { createUserTemplateStore }] = await Promise.all([import(b), import(s)]);
      return createUserTemplateStore(await createBridge()).save({ toolId: 'design', name: 'Existing design', values: { boxes: [{ id: 'welcome', kind: 'text', text: 'Welcome', x: 80, y: 80, w: 600, h: 150, fontSize: 60, font: 'sans', fg: '#123456' }] } });
    });
    await page.goto(`${origin}/#/p/__templates__?tool=design`);
    const tile = page.locator('.folder-tile').filter({ hasText: 'Existing design' });
    await tile.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Share with rules', exact: true }).click();
    await page.locator('.dr-toolbar').waitFor();
    await page.locator('#tool-canvas [data-box-id="welcome"]').click();
    await page.getByRole('button', { name: 'Make editable', exact: true }).click();
    assert.equal(await page.locator('.dr-panel .dr-input').count(), 1);
    const unchanged = await page.evaluate(async id => {
      const b = '/src/bridge/index.ts', s = '/src/lib/user-templates.ts';
      const [{ createBridge }, { createUserTemplateStore }] = await Promise.all([import(b), import(s)]);
      return createUserTemplateStore(await createBridge()).get(id);
    }, template.id);
    assert.deepEqual(unchanged, template);
    assert.ok(!(await settledUrl(page)).includes('template='));
  } finally { await browser.close(); }
});
