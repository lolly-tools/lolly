// SPDX-License-Identifier: MPL-2.0
/** Real GPU coverage for the original fields: compile, seek, palette and fallback. */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { chromium, type Browser, type Page } from 'playwright';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

const root = join(import.meta.dirname, '../community');
const dir = join(root, 'backdrop');
const effects = ['silk-flow', 'prism-bloom', 'liquid-contours'];
const tool = await loadTool('backdrop', (p) => readFile(join(root, p), 'utf8'));
const skip = !existsSync(chromium.executablePath()) && 'Install Playwright Chromium for GPU coverage';
let browser: Browser, server: Server, origin: string;

async function open(values: Record<string, unknown> = {}, noWebGL = false, reducedMotion = true): Promise<Page> {
  const runtime = await createRuntime(tool, baseHost(), {
    effect: 'silk-flow', count: 4, color1: '#30ba78', color2: '#00bda7',
    color3: '#f2a65a', color4: '#5b8def', color5: '#e0679f', color6: '#e9f5ff',
    background: '#0b1021', speed: 0, phase: 35, ...values,
  });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  if (noWebGL) await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      return type === 'webgl2' ? null : Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await page.route('**/fixture', (route) => route.fulfill({
    contentType: 'text/html',
    body: `<style>body{margin:0}${tool.styles}</style><div data-lolly-canvas style="width:100vw;height:100vh">${runtime.getHydrated()}</div>`,
  }));
  await page.goto(`${origin}/fixture`);
  await page.waitForFunction(() => !!(window as unknown as { PaperShaders: unknown }).PaperShaders);
  if (!noWebGL) await page.waitForFunction(() => {
    const host = document.querySelector('.bd-host') as HTMLElement & { paperShaderMount?: { program: unknown } };
    const canvas = host.querySelector('canvas');
    return !!host.paperShaderMount?.program && canvas && canvas.width >= innerWidth
      && Math.abs(canvas.width / canvas.height - innerWidth / innerHeight) < 0.01;
  });
  return page;
}

async function frame(page: Page, t: number): Promise<{ png: string; mean: number; range: number; error: number }> {
  return page.evaluate((time) => {
    const canvas = document.querySelector('.bd-host canvas') as HTMLCanvasElement & {
      __lollyFrameDriven: boolean;
      __lollyFrameRender(t: number, seconds: number): void;
    };
    canvas.__lollyFrameDriven = true;
    canvas.__lollyFrameRender(time, 8);
    const copy = document.createElement('canvas');
    copy.width = 120; copy.height = 68;
    const ctx = copy.getContext('2d')!;
    ctx.drawImage(canvas, 0, 0, copy.width, copy.height);
    const pixels = ctx.getImageData(0, 0, copy.width, copy.height).data;
    let min = 255, max = 0, sum = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const l = (pixels[i]! + pixels[i + 1]! + pixels[i + 2]!) / 3;
      min = Math.min(min, l); max = Math.max(max, l); sum += l;
    }
    return { png: canvas.toDataURL(), mean: sum / (pixels.length / 4), range: max - min,
      error: canvas.getContext('webgl2')!.getError() };
  }, t);
}

describe('Backdrop GPU fields', { skip }, () => {
  before(async () => {
    server = createServer(async (req, res) => {
      if (req.url === '/tools/backdrop/lib/paper-shaders.min.js') {
        res.setHeader('Content-Type', 'text/javascript');
        res.end(await readFile(join(dir, 'lib/paper-shaders.min.js')));
      } else { res.statusCode = 404; res.end(); }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    browser = await chromium.launch({ headless: true });
  });
  after(async () => {
    await browser?.close();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  it('paints three distinct, animated fields and seeks to an identical export frame', async () => {
    const frames = new Set<string>();
    for (const effect of effects) {
      const page = await open({ effect });
      try {
        const a = await frame(page, 0);
        const b = await frame(page, 0.7);
        const c = await frame(page, 0);
        assert.equal(a.error, 0, `${effect}: no WebGL errors`);
        assert.ok(a.mean > 10 && a.range > 30, `${effect}: visible light and shadow`);
        assert.notEqual(a.png, b.png, `${effect}: export advances even with live speed 0`);
        assert.ok(a.png === c.png, `${effect}: seeking does not depend on prior frames`);
        frames.add(a.png);
        if (process.env.BACKDROP_SHOTS) {
          await mkdir(process.env.BACKDROP_SHOTS, { recursive: true });
          await page.screenshot({ path: join(process.env.BACKDROP_SHOTS, `${effect}.png`) });
        }
      } finally { await page.close(); }
    }
    assert.equal(frames.size, 3);
  });

  it('all six swatches influence the image; full influence recolours, off preserves the spectrum', async () => {
    for (const effect of effects) {
      const page = await open({ effect, count: 6, brandInfluence: 'full' });
      try {
        const original = await frame(page, 0.2);
        const isolateSwatch = async (index: number) => page.evaluate((selected) => {
          const host = document.querySelector('.bd-host') as HTMLElement & {
            paperShaderMount: { setUniforms(u: Record<string, unknown>): void };
          };
          host.paperShaderMount.setUniforms({
            u_colors: Array.from({ length: 6 }, (_, i) => i === selected ? [1, 0.05, 0.05, 1] : [0.25, 0.25, 0.25, 1]),
            u_colorAccent: [0.25, 0.25, 0.25, 1],
          });
        }, index);
        await isolateSwatch(-1);
        const neutral = await frame(page, 0.2);
        for (let i = 0; i < 6; i++) {
          await isolateSwatch(i);
          assert.notEqual((await frame(page, 0.2)).png, neutral.png, `${effect}: swatch ${i + 1} contributes`);
        }
        // Change the actual GPU uniforms to exercise the full palette without recompiling.
        const setPalette = async (red: boolean, influence: number) => page.evaluate(({ red, influence }) => {
          const host = document.querySelector('.bd-host') as HTMLElement & {
            paperShaderMount: { setUniforms(u: Record<string, unknown>): void };
          };
          const color = red ? [1, 0.05, 0.05, 1] : [0.05, 0.05, 1, 1];
          host.paperShaderMount.setUniforms({ u_colors: Array.from({ length: 6 }, () => color),
            u_colorAccent: color, u_brandMix: influence });
        }, { red, influence });
        await setPalette(true, 0.94);
        const red = await frame(page, 0.2);
        await setPalette(false, 0.94);
        const blue = await frame(page, 0.2);
        assert.notEqual(red.png, blue.png, `${effect}: brand changes the rendered pixels`);
        assert.notEqual(original.png, blue.png);
        await setPalette(true, 0);
        const offRed = await frame(page, 0.2);
        await setPalette(false, 0);
        assert.equal(offRed.png, (await frame(page, 0.2)).png, `${effect}: off retains its original spectrum`);
      } finally { await page.close(); }
    }
  });

  it('handles one colour, bright grounds and portrait sizing at control limits', async () => {
    for (const effect of effects) {
      const page = await open({ effect, count: 1, color1: '#aa2255', background: '#faf7f0',
        intensity: 100, density: 100, scale: 25, rotation: 315, brandInfluence: 'full' });
      try {
        await page.setViewportSize({ width: 360, height: 640 });
        await page.waitForFunction(() => {
          const canvas = document.querySelector('canvas')!;
          return Math.abs(canvas.width / canvas.height - 360 / 640) < 0.01;
        });
        const result = await frame(page, 1);
        assert.equal(result.error, 0);
        assert.ok(result.range > 20, `${effect}: one swatch still has relief`);
      } finally { await page.close(); }
    }
  });

  it('parks live playback under reduced motion and keeps the colour wash without WebGL', async () => {
    const page = await open({ speed: 100 });
    try {
      const state = await page.evaluate(() => {
        const host = document.querySelector('.bd-host') as HTMLElement & {
          paperShaderMount: { speed: number; getCurrentFrame(): number };
        };
        return { speed: host.paperShaderMount.speed, phase: host.paperShaderMount.getCurrentFrame() };
      });
      assert.equal(state.speed, 0);
      assert.equal(state.phase, 3500);
    } finally { await page.close(); }
    const fallback = await open({}, true);
    try {
      assert.ok(await fallback.locator('.bd-wash').isVisible());
      assert.match(await fallback.locator('.bd-wash').evaluate((el) => getComputedStyle(el).backgroundImage), /radial-gradient/);
    } finally { await fallback.close(); }
  });

  it('advances live playback when motion is enabled', async () => {
    for (const effect of effects) {
      const page = await open({ effect, speed: 100 }, false, false);
      try {
        await page.waitForFunction(() => {
          const host = document.querySelector('.bd-host') as HTMLElement & {
            paperShaderMount: { getCurrentFrame(): number };
          };
          return host.paperShaderMount.getCurrentFrame() > 3600;
        });
      } finally { await page.close(); }
    }
  });
});
