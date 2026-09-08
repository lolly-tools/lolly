// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { type Browser, chromium, type Page } from 'playwright';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

const root = join(import.meta.dirname, '../community'),
  dir = join(root, 'timezone');
const skip =
  !existsSync(chromium.executablePath()) && 'Install the Playwright browser to run WebGL tests';
let browser: Browser, server: Server, origin: string;
const tool = await loadTool('timezone', (p) => readFile(join(root, p), 'utf8'));
async function open(values: Record<string, unknown> = {}, noWebGL = false): Promise<Page> {
  const runtime = await createRuntime(tool, baseHost(), {
    renderer: 'webgl',
    motion: 'tour',
    timeMode: 'fixed',
    eventTime: '2026-09-09T15:00',
    referenceZone: 'UTC',
    accent: '#50cbb1',
    locations: [
      { label: 'London', place: 'Europe/London' },
      { label: 'New York', place: 'America/New_York' },
      { label: 'Singapore', place: 'Asia/Singapore' },
    ],
    ...values,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  if (noWebGL)
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        type: any,
        ...args: any[]
      ) {
        return type === 'webgl' || type === 'webgl2' ? null : original.call(this, type, ...args);
      } as any;
    });
  const html = `<style>body{margin:0}${await readFile(join(dir, 'styles.css'), 'utf8')}</style><div id="tool-inputs"><input data-input-id="view"></div><div id="fixture-artboard" style="width:1440px;height:1080px">${runtime.getHydrated()}</div><script>document.querySelector('[data-input-id="view"]').addEventListener('input',e=>{history.replaceState(null,'','?view='+encodeURIComponent(e.target.value))});</script>`;
  await page.route('**/fixture', (route) =>
    route.fulfill({ contentType: 'text/html', body: html })
  );
  await page.goto(origin + '/fixture');
  await page.waitForSelector('#tz-root[data-ready="true"]');
  await page.evaluate(() => {
    (document.querySelector('#tz-root canvas') as any).__lollyFrameDriven = true;
  });
  return page;
}
describe('Timezone browser renderer', { skip }, () => {
  before(async () => {
    server = createServer(async (req, res) => {
      if (req.url === '/tools/timezone/lib/renderer.min.js') {
        res.setHeader('Content-Type', 'text/javascript');
        res.end(await readFile(join(dir, 'lib/renderer.min.js')));
      } else {
        res.statusCode = 404;
        res.end();
      }
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    origin = 'http://127.0.0.1:' + (server.address() as { port: number }).port;
    browser = await chromium.launch({ headless: true });
  });
  after(async () => {
    await browser?.close();
    await new Promise<void>((r) => server?.close(() => r()));
  });
  it('fits the containing export artboard in both renderers without changing the size', async () => {
    for (const renderer of ['vector', 'webgl']) {
      const page = await open({
        renderer,
        motion: 'still',
        heading: 'Around the world',
        footer: 'Join us',
      });
      try {
        for (const [width, height] of [
          [1080, 1920],
          [1920, 720],
          [320, 320],
        ] as const) {
          await page.locator('#fixture-artboard').evaluate(
            (el, dims) => {
              el.style.width = dims[0] + 'px';
              el.style.height = dims[1] + 'px';
            },
            [width, height]
          );
          await page.waitForFunction(
            ([w, h]) =>
              document.querySelector('.tz-artwork')?.getAttribute('viewBox') === `0 0 ${w} ${h}`,
            [width, height]
          );
          const geometry = await page.evaluate(() => {
            const root = document.querySelector('#tz-root') as any;
            const box = root.getBoundingClientRect();
            const map = root.querySelector('.tz-interaction').getBoundingClientRect();
            const texts = [...root.querySelectorAll('.tz-artwork > g text')].map((t: any) => {
              const b = t.getBoundingClientRect();
              return {
                x: b.x - box.x,
                y: b.y - box.y,
                right: b.right - box.x,
                bottom: b.bottom - box.y,
              };
            });
            return {
              width: box.width,
              height: box.height,
              mapW: map.width,
              mapH: map.height,
              texts,
            };
          });
          assert.equal(geometry.width, width);
          assert.equal(geometry.height, height);
          assert.ok(geometry.mapW > 0 && geometry.mapH > 0);
          for (const t of geometry.texts) {
            assert.ok(
              t.x >= -1 && t.y >= -1 && t.right <= width + 1 && t.bottom <= height + 1,
              JSON.stringify(t)
            );
          }
        }
      } finally {
        await page.close();
      }
    }
  });
  it('fills the full canvas width for clean map animations in both renderers', async () => {
    for (const { renderer, projection } of [
      { renderer: 'vector', projection: 'globe' },
      { renderer: 'webgl', projection: 'globe' },
      { renderer: 'vector', projection: 'equalEarth' },
      { renderer: 'webgl', projection: 'equalEarth' },
    ]) {
      const page = await open({
        renderer,
        projection,
        motion: 'orbit',
        timeMode: 'now',
        eventTime: '',
        referenceZone: '',
        locations: [],
      });
      try {
        await page.locator('#fixture-artboard').evaluate((el) => {
          el.style.width = '960px';
          el.style.height = '540px';
        });
        await page.waitForFunction(
          () => (document.querySelector('#tz-root') as any).__timezone.state.width === 960
        );
        const result = await page.evaluate(() => {
          const root = document.querySelector('#tz-root') as any,
            box = root.getBoundingClientRect();
          root.__timezone.draw(0);
          const map = root.querySelector('.tz-interaction').getBoundingClientRect();
          const canvas = root.querySelector('canvas');
          let span: number;
          if (canvas.hidden) span = root.querySelector('.tz-vector-map > path').getBBox().width;
          else {
            const { width: w, height: h } = canvas;
            const pixels = canvas.getContext('2d').getImageData(0, Math.floor(h / 2), w, 1).data;
            const hex = root.__timezone.state.palette.background;
            const bg = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
            const painted = Array.from({ length: w }, (_, x) => x).filter((x) =>
              bg.some((c, k) => Math.abs(pixels[x * 4 + k] - c) > 2)
            );
            span = painted.length ? ((painted.at(-1)! - painted[0]! + 1) / w) * box.width : 0;
          }
          const frame = canvas.hidden
            ? root.querySelector('.tz-vector-map').innerHTML
            : canvas.toDataURL();
          root.__timezone.draw(0.25);
          const next = canvas.hidden
            ? root.querySelector('.tz-vector-map').innerHTML
            : canvas.toDataURL();
          return {
            x: map.x - box.x,
            y: map.y - box.y,
            width: map.width,
            height: map.height,
            span,
            sections: root.querySelectorAll('[data-section]').length,
            animated: frame !== next,
          };
        });
        assert.equal(result.x, 0);
        assert.equal(result.y, 0);
        assert.equal(result.width, 960);
        assert.equal(result.height, 540);
        assert.ok(result.span >= 950 && result.span <= 970, `${renderer}: ${result.span}`);
        assert.equal(result.sections, 0);
        assert.equal(result.animated, true);
      } finally {
        await page.close();
      }
    }
  });
  it('can keep a complete globe visible while map-only tours retain their destinations', async () => {
    for (const renderer of ['vector', 'webgl']) {
      const page = await open({
        renderer,
        composition: 'map',
        mapFit: 'fit',
        heading: 'Hidden story',
        footer: 'Hidden footer',
        showLabels: false,
      });
      try {
        const result = await page.evaluate(() => {
          const root = document.querySelector('#tz-root') as any;
          root.__timezone.draw(0);
          const canvas = root.querySelector('canvas');
          const first = canvas.hidden
            ? root.querySelector('.tz-vector-map').innerHTML
            : canvas.toDataURL();
          root.__timezone.draw(0.67);
          const second = canvas.hidden
            ? root.querySelector('.tz-vector-map').innerHTML
            : canvas.toDataURL();
          let globe: { x: number; y: number; w: number; h: number } | null = null;
          if (canvas.hidden) {
            const b = root.querySelector('.tz-vector-map > path').getBBox();
            globe = { x: b.x, y: b.y, w: b.width, h: b.height };
          }
          return {
            globe,
            width: root.clientWidth,
            height: root.clientHeight,
            sections: root.querySelectorAll('[data-section]').length,
            places: root.__timezone.state.places.length,
            changed: first !== second,
          };
        });
        assert.equal(result.sections, 0);
        assert.equal(result.places, 3);
        assert.equal(result.changed, true);
        if (result.globe) {
          assert.ok(result.globe.x >= -1 && result.globe.y >= -1);
          assert.ok(result.globe.x + result.globe.w <= result.width + 1);
          assert.ok(result.globe.y + result.globe.h <= result.height + 1);
        }
      } finally {
        await page.close();
      }
    }
  });
  it('renders deterministic tour frames, changes viewpoint, and keeps labels in step', async () => {
    const page = await open();
    try {
      assert.equal(await page.locator('canvas.tz-globe').getAttribute('data-backend'), 'webgl2');
      const sample = async (t: number) =>
        page.evaluate((t) => {
          const r = document.querySelector('#tz-root') as any;
          r.__timezone.draw(t);
          return {
            pixels: r.querySelector('canvas').toDataURL(),
            labels: r.querySelector('.tz-pins').textContent,
          };
        }, t);
      const a = await sample(0),
        b = await sample(0.67),
        again = await sample(0);
      assert.equal(a.pixels, again.pixels);
      assert.notEqual(a.pixels, b.pixels);
      assert.match(b.labels, /Singapore/);
      const data = await page
        .locator('canvas.tz-globe')
        .evaluate((c: HTMLCanvasElement) =>
          Array.from(c.getContext('2d')!.getImageData(c.width / 2, c.height / 2, 1, 1).data)
        );
      assert.equal(data[3], 255);
    } finally {
      await page.close();
    }
  });
  it('unfolds the same geographic map and keeps all labels in the flat projection', async () => {
    const page = await open({ projection: 'equalEarth', motion: 'unfold' });
    try {
      const result = await page.evaluate(() => {
        const r = document.querySelector('#tz-root') as any;
        r.__timezone.draw(0);
        const globe = r.querySelector('canvas').toDataURL();
        r.__timezone.draw(0.5);
        return {
          changed: globe !== r.querySelector('canvas').toDataURL(),
          labels: r.querySelector('.tz-pins').textContent,
        };
      });
      assert.equal(result.changed, true);
      assert.match(result.labels, /London/);
      assert.match(result.labels, /New York/);
      assert.match(result.labels, /Singapore/);
    } finally {
      await page.close();
    }
  });
  it('keyboard rotation commits the same view input and resources dispose after navigation', async () => {
    const page = await open({ motion: 'still' });
    try {
      await page.locator('.tz-interaction').focus();
      await page.keyboard.press('ArrowRight');
      await page.waitForURL(/view=20/);
      const disposed = await page.evaluate(async () => {
        const r = document.querySelector('#tz-root') as any,
          canvas = r.querySelector('canvas');
        r.remove();
        await new Promise((resolve) => setTimeout(resolve, 60));
        return { width: canvas.width, clock: typeof canvas.__lollyFrameRender };
      });
      assert.equal(disposed.width, 1);
      assert.equal(disposed.clock, 'undefined');
    } finally {
      await page.close();
    }
  });
  it('falls back to a complete vector artwork when WebGL cannot start', async () => {
    const page = await open({ motion: 'still' }, true);
    try {
      assert.equal(await page.locator('#tz-root').getAttribute('data-backend'), 'vector-fallback');
      assert.equal(await page.locator('canvas.tz-globe').isVisible(), false);
      assert.ok((await page.locator('.tz-vector-map path').count()) > 3);
      assert.match((await page.locator('.tz-art').textContent()) || '', /New York/);
    } finally {
      await page.close();
    }
  });
});
