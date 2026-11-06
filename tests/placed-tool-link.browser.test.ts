// SPDX-License-Identifier: MPL-2.0
/**
 * A tool placed in Design takes edits from the inspector's Tool section under a design
 * system whose emoji style is long.
 *
 * Lolly Demo's emoji treatment lists its whole palette. Written into a placed tool's link
 * it made the link longer than an embed id may be (4096 characters), no link could be
 * minted, and every field in the Tool section did nothing, for every tool.
 *
 *   LOLLY_EXPORT_TEST_URL=http://127.0.0.1:5173 node --test tests/placed-tool-link.browser.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';
import { chromium, type Browser } from 'playwright';
import { webGpuLaunchArgs } from '../packages/node-shell/src/webgpu-launch.ts';

/** shells/web/src/bridge/tokens.ts `AUTOMATION_DESIGN_SYSTEM_GLOBAL`, read once at boot. */
const AUTOMATION_DESIGN_SYSTEM_GLOBAL = '__lollyAutomationDesignSystem';
const DEMO = JSON.parse(readFileSync(new URL('../brands/lolly-demo/catalog/assets/lolly/tokens/demo.json', import.meta.url), 'utf8'));

const origin = process.env.LOLLY_EXPORT_TEST_URL;
const skip = origin ? false : 'set LOLLY_EXPORT_TEST_URL';

const LINK = `https://lolly.tools/tool/qr-code.svg?${new URLSearchParams({ url: 'https://example.com/first', w: '600', h: '600' })}`;
const BOXES = [{ id: 'placed', kind: 'image', x: 0, y: 0, w: 600, h: 600, image: { id: LINK } }];

describe('a placed tool under a design system with a long emoji style', { skip }, () => {
  let browser: Browser;
  before(async () => { browser = await chromium.launch({ args: webGpuLaunchArgs() }); });
  after(async () => { await browser?.close(); });

  test('a change in the Tool section reaches the picture on the board', { timeout: 180_000 }, async () => {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1500, height: 1000 } });
    await context.addInitScript(([key, doc]) => { (globalThis as Record<string, unknown>)[key as string] = doc; }, [AUTOMATION_DESIGN_SYSTEM_GLOBAL, DEMO] as const);
    const page = await context.newPage();
    page.setDefaultTimeout(60_000);
    try {
      await page.goto(`${origin}/#/tool/design?${new URLSearchParams({ boxes: JSON.stringify(BOXES), width: '800', height: '800' })}`);
      const box = page.locator('.lolly-box[data-box-id="placed"]');
      const picture = box.locator('img.lolly-box-img');
      await picture.waitFor({ state: 'attached' });
      await page.waitForFunction(() => document.querySelector<HTMLImageElement>('.lolly-box[data-box-id="placed"] img.lolly-box-img')?.complete);

      // The bug needs this design system's emoji style, so check the page really has one.
      const emojiLength = await page.evaluate(async () => {
        const paths = ['/src/lib/host-ref.ts', '/src/lib/emoji-runtime-style.ts'];
        const [hosts, styles] = await Promise.all(paths.map(path => import(path)));
        const style = await styles.mountEmojiStyle(hosts.getHostRef(), { url: null });
        return style ? styles.queryWithEmoji('a=1', style).length : 0;
      });
      assert.ok(emojiLength > 4096, `the emoji style alone runs past an embed id, ${emojiLength} characters`);

      await box.click({ force: true });
      const field = page.locator('[data-tool-settings] [data-input-id="url"]').first();
      await field.waitFor();
      const drawn = (): Promise<string> => page.evaluate(async () => {
        const src = document.querySelector<HTMLImageElement>('.lolly-box[data-box-id="placed"] img.lolly-box-img')?.src;
        return src ? (await fetch(src)).text() : '';
      });
      const was = await drawn();
      assert.match(was, /<svg/);
      await field.fill('https://example.com/second');
      await page.waitForFunction(
        previous => document.querySelector<HTMLImageElement>('.lolly-box[data-box-id="placed"] img.lolly-box-img')?.src !== previous,
        await picture.evaluate((img: HTMLImageElement) => img.src),
        { timeout: 30_000 },
      ).catch(() => assert.fail('the picture never changed after an edit in the Tool section'));
      await page.waitForFunction(() => document.querySelector<HTMLImageElement>('.lolly-box[data-box-id="placed"] img.lolly-box-img')?.complete);
      assert.notEqual(await drawn(), was, 'the new link draws a different code');
    } finally { await context.close(); }
  });
});
