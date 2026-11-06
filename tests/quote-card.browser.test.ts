// SPDX-License-Identifier: MPL-2.0
/**
 * Quote in a real browser: fit, the SVG that carries motion, and a placed box on Design's
 * timeline. tests/quote-card.test.ts holds what needs no browser.
 *
 *   LOLLY_EXPORT_TEST_URL=http://127.0.0.1:5173 node --test tests/quote-card.browser.test.ts
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { chromium, type Browser, type Page } from 'playwright';
import { webGpuLaunchArgs } from '../packages/node-shell/src/webgpu-launch.ts';

const origin = process.env.LOLLY_EXPORT_TEST_URL;
const skip = origin ? false : 'set LOLLY_EXPORT_TEST_URL';

const QUOTE = 'The best tools disappear, so the work can speak.';
const link = (params: Record<string, string>): string =>
  `https://lolly.tools/tool/quote-card.svg?${new URLSearchParams({ quote: QUOTE, name: 'Maya Lindqvist', role: 'Head of Product', ...params })}`;

describe('Quote in the web shell', { skip }, () => {
  let browser: Browser;
  let page: Page;

  before(async () => {
    browser = await chromium.launch({ args: webGpuLaunchArgs() });
    page = await browser.newPage({ serviceWorkers: 'block', viewport: { width: 1400, height: 900 } });
    page.setDefaultNavigationTimeout(90_000);
    await page.goto(`${origin}/#/tool/quote-card`);
    await page.waitForSelector('#tool-canvas .qc', { timeout: 60_000 });
  });
  after(async () => { await browser?.close(); });

  const svgOf = (url: string, opts: Record<string, unknown> = {}): Promise<{ text: string; meta: Record<string, unknown> }> => page.evaluate(async ({ url, opts }) => {
    const path = '/src/lib/host-ref.ts';
    const host = (await import(path)).getHostRef();
    const ref = await host.compose.renderUrl(url, { format: 'svg', thumbnail: true, ...opts });
    return { text: await (await fetch(ref.url)).text(), meta: ref.meta };
  }, { url, opts });

  test('motion none draws the same SVG bytes as the same link without the field', { timeout: 120_000 }, async () => {
    for (const layout of ['beside', 'centred', 'type', 'marker']) {
      const without = await svgOf(`${link({ layout, phrase: 'work' })}&w=800&h=600`);
      const none = await svgOf(`${link({ layout, phrase: 'work', motion: 'none' })}&w=800&h=600`);
      assert.equal(none.text, without.text, layout);
      assert.doesNotMatch(none.text, /animation:|@keyframes|data-clip-ms/, `${layout}: a still file carries no motion`);
      assert.equal(none.meta.animated, undefined, layout);
    }
  });

  test('the SVG carries the motion, says how long it lasts and needs no second clock', { timeout: 120_000 }, async () => {
    const { text, meta } = await svgOf(`${link({ layout: 'type', motion: 'word' })}&w=800&h=600`);
    assert.equal(meta.animated, true);
    assert.ok(Number(meta.durationMs) > 2000, 'the box gets a clip');
    assert.match(text, /<svg[^>]*data-clip-ms="\d+"/);
    assert.match(text, /@keyframes qc-rise/);
    assert.equal((text.match(/animation:qc-rise/g) ?? []).length, 9, 'one group per word');
    assert.match(text, /@media \(scripting: none\)/);
  });

  test('an image of the file shows the finished card, the same ink as a still', { timeout: 120_000 }, async () => {
    const moving = await svgOf(`${link({ layout: 'type', motion: 'word' })}&w=400&h=300`);
    const inks = await page.evaluate(async (svg) => {
      const img = new Image();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      await img.decode();
      await new Promise(r => setTimeout(r, 200));
      const canvas = document.createElement('canvas');
      canvas.width = 400; canvas.height = 300;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, 400, 300);
      const px = ctx.getImageData(0, 0, 400, 300).data;
      let light = 0;
      for (let i = 0; i < px.length; i += 4) if (px[i]! > 200) light++;
      return light;
    }, moving.text);
    assert.ok(inks > 4000, `the words are on the card, ${inks} light pixels`);
  });

  test('a derived format gets one finished picture', { timeout: 120_000 }, async () => {
    const result = await page.evaluate(async () => {
      const paths = ['/src/lib/host-ref.ts', '/src/pro/render-export.ts'];
      const [hosts, exports] = await Promise.all(paths.map(path => import(path)));
      const { blob } = await exports.renderRowToBlob({ toolId: 'quote-card', values: { quote: 'Say less.', layout: 'type', motion: 'word' } }, hosts.getHostRef(), { format: 'png', width: 400, height: 300, watermark: false, embedMeta: false, c2pa: false });
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = 400; canvas.height = 300;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0);
      const px = ctx.getImageData(0, 0, 400, 300).data;
      let light = 0;
      for (let i = 0; i < px.length; i += 4) if (px[i]! > 200) light++;
      return { light };
    });
    assert.ok(result.light > 2000, `a PNG of a moving card is finished, ${result.light} light pixels`);
  });

  test('long and short quotes fit every shape, in every layout', { timeout: 300_000 }, async () => {
    const LONG = 'A long quotation has to keep its dignity when it fills the card, so the type comes down until every word sits inside the frame with the same margins. '.repeat(5).slice(0, 600);
    const bad = await page.evaluate(async ({ LONG }) => {
      const paths = ['/src/pro/render-export.ts', '/src/lib/host-ref.ts', '/src/lib/mount-runtime.ts', '/src/bridge/tool-loader.ts'];
      const [exports, hosts, runtimes, loader] = await Promise.all(paths.map(path => import(path)));
      const host = hosts.getHostRef();
      const tool = await loader.getTool('quote-card');
      const out: string[] = [];
      const longName = 'Maximiliana Wolfeschlegelsteinhausenbergerdorff-Featherstonehaugh von Hohenzollern-Sigmaringen';
      for (const quote of ['Ship today.', LONG, 'أفضل الأدوات تختفي، حتى يتحدث العمل عن نفسه.', '最好的工具会隐于无形，让作品自己说话。']) {
        for (const layout of ['beside', 'centred', 'type', 'glyph', 'pull', 'citation', 'portrait', 'marker']) {
          for (const [width, height] of [[1080, 1080], [1080, 1350], [1080, 1920], [1920, 1080], [1500, 500]]) {
            const source = await runtimes.createToolRuntime(tool, host, { quote, layout, name: longName, role: 'Head of Product' });
            const mounted = await exports.mountDocumentExport(tool, host, source, { width, height });
            try {
              await new Promise(r => setTimeout(r, 30));
              const root = mounted.canvas.querySelector('.qc');
              const frame = root.getBoundingClientRect();
              for (const el of root.querySelectorAll('.qc-quote, .qc-name, .qc-role, .qc-ref')) {
                const r = el.getBoundingClientRect();
                const off = Math.max(frame.left - r.left, r.right - frame.right, frame.top - r.top, r.bottom - frame.bottom);
                if (off > 1) out.push(`${layout} ${width}x${height} ${el.className} ${Math.round(off)}px, ${quote.slice(0, 12)}`);
              }
            } finally { mounted.destroy(); source.destroy(); }
          }
        }
      }
      return out;
    }, { LONG });
    assert.deepEqual(bad, []);
  });

  test('a placed box plays on Design\'s timeline, seeks exactly and follows a colourway', { timeout: 240_000 }, async () => {
    const boxes = [{ id: 'q1', kind: 'image', x: 0, y: 0, w: 1600, h: 900, image: { id: `${link({ layout: 'type', ground: 'lead', motion: 'word' })}&w=1600&h=900` }, start: 0, dur: 4 }];
    const design = await browser.newPage({ serviceWorkers: 'block', viewport: { width: 1500, height: 1000 } });
    design.setDefaultNavigationTimeout(90_000);
    try {
      await design.goto(`${origin}/#/tool/design?${new URLSearchParams({ boxes: JSON.stringify(boxes), width: '1600', height: '900' })}`);
      await design.waitForSelector('[data-anim-src] > svg', { state: 'attached', timeout: 60_000 });
      await design.waitForSelector('.tl-panel', { timeout: 60_000 });
      const read = () => design.evaluate(() => {
        const marker = document.querySelector('[data-anim-src]')!;
        const animations = marker.getAnimations({ subtree: true });
        const first = marker.querySelector<SVGGElement>('g[style*="animation"]')!;
        return { count: animations.length, states: [...new Set(animations.map(a => a.playState))], time: animations[0]?.currentTime, opacity: getComputedStyle(first).opacity };
      });
      await design.waitForFunction(() => {
        const a = document.querySelector('[data-anim-src]')?.getAnimations({ subtree: true }) ?? [];
        return a.length > 0 && a.every(x => x.playState === 'paused');
      });
      const parked = await read();
      assert.equal(parked.count, 11, 'nine words and two lines of name');
      assert.equal(parked.time, 0);
      assert.equal(parked.opacity, '0', 'the clock poses the first instant');
      const { x, y } = await design.evaluate(() => {
        const inner = document.querySelector('.tl-ruler-inner')!.getBoundingClientRect();
        const tick = [...document.querySelectorAll('.tl-ruler-inner *')].find(e => !e.children.length && e.textContent?.trim() === '0:02.0')!.getBoundingClientRect();
        return { x: tick.left, y: inner.top + inner.height / 2 };
      });
      await design.mouse.click(x, y);
      await design.waitForFunction(() => {
        const a = document.querySelector('[data-anim-src]')?.getAnimations({ subtree: true }) ?? [];
        return Number(a[0]?.currentTime) > 1500;
      });
      const later = await read();
      assert.ok(Math.abs(Number(later.time) - 2000) < 80, `the picture follows the playhead, ${later.time}`);
      assert.equal(later.opacity, '1');
      assert.deepEqual(later.states, ['paused'], 'nothing free-runs on its own clock');
      const ground = () => document.querySelector('[data-anim-src] > svg rect')?.getAttribute('fill');
      const before = await design.evaluate(ground);
      await design.mouse.click(700, 110);
      await design.getByText('Morning', { exact: true }).first().click();
      await design.waitForFunction(was => document.querySelector('[data-anim-src] > svg rect')?.getAttribute('fill') !== was, before, { timeout: 60_000 });
      assert.notEqual(await design.evaluate(ground), before, 'the picture follows the colourway');
    } finally { await design.close(); }
  });
});
