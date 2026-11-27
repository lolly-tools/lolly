// SPDX-License-Identifier: MPL-2.0
/**
 * Gradient's Field method drawn as a one-shot picture, in a real browser with a real
 * GPU context: the picture a template thumbnail, a batch row or a Multi-edit still is
 * taken from.
 *
 * A one-shot picture is taken when the page goes quiet. The shader's first frame comes
 * later than that (its library and noise texture load first), so every Field starter
 * was photographed as the same CSS wash. An off-screen Field render now follows the
 * readiness contract in docs/tool-rendering.md: it raises `__toolHasReadySignal` and
 * dispatches `tool:ready` once its chosen moment is painted. This file holds the
 * contract to what a capture needs: at the signal the shader has drawn, two starters
 * with different effects are different pictures, neither is the wash, a listener that
 * starts late still hears the signal, and the context is handed back afterwards.
 *
 * The capture itself (lib/featured-render.ts choosing a raster format for the look, then
 * pro/render-export.ts waiting through lib/render-lifecycle.ts) needs the whole web
 * shell and is not run here; tests/export-format.test.ts and
 * shells/web/src/lib/featured-render.test.ts hold the format choice.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { chromium, type Browser, type Page } from 'playwright';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

const root = join(import.meta.dirname, '../community');
const dir = join(root, 'gradient');
const tool = await loadTool('gradient', (p) => readFile(join(root, p), 'utf8'));
const skip = !existsSync(chromium.executablePath()) && 'Install Playwright Chromium for GPU coverage';
let browser: Browser, server: Server, origin: string;

/** A starter's values, with its design tokens given the colours Lolly Demo gives them. */
function starter(id: string): Record<string, unknown> {
  const values = JSON.parse(readFileSync(join(dir, 'templates', `${id}.json`), 'utf8')).values as Record<string, unknown>;
  const colour: Record<string, string> = { '{color.semantic.primary}': '#033633', '{color.semantic.secondary}': '#008657' };
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, typeof value === 'string' && colour[value] ? colour[value] : value]));
}

interface Heard { mounted: boolean; lit: boolean; flagUp: boolean }

/**
 * Mount one look the way the off-screen stage does (pro/render-export.ts mountToolCanvas:
 * a `data-lolly-canvas data-lolly-offscreen` root), with a listener in place before the
 * template runs and a second one that starts 400 ms late, as a capture that was still
 * waiting for fonts would.
 */
async function open(values: Record<string, unknown>, opts: { noWebGL?: boolean; live?: boolean } = {}): Promise<Page> {
  const runtime = await createRuntime(tool, baseHost(), values as never);
  const page = await browser.newPage({ viewport: { width: 640, height: 360 }, reducedMotion: 'reduce' });
  if (opts.noWebGL) await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      return type === 'webgl2' ? null : Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  const probe = `<script>
    window.__heard = [];
    document.addEventListener('tool:ready', function () {
      // A canvas with no context is the one the library leaves behind when it cannot start.
      var cv = document.querySelector('.mg-field canvas'), gl = cv && cv.getContext('webgl2'), lit = false;
      if (gl) { var px = new Uint8Array(4 * 64); gl.readPixels(0, 0, 8, 8, gl.RGBA, gl.UNSIGNED_BYTE, px); lit = px.some(function (v) { return v > 0; }); }
      window.__heard.push({ mounted: !!gl, lit: lit, flagUp: !!window.__toolHasReadySignal });
    });
    setTimeout(function () {
      // What lib/render-lifecycle.ts waitForQuiescence does when it starts: take the flag down, then listen.
      window.__lateNeeded = !!window.__toolHasReadySignal;
      delete window.__toolHasReadySignal;
      document.addEventListener('tool:ready', function () { window.__lateHeard = true; }, { once: true });
    }, 400);
  </script>`;
  await page.route('**/fixture', (route) => route.fulfill({
    contentType: 'text/html',
    body: `<style>body{margin:0}${tool.styles}</style>${probe}<div id="stage" data-lolly-canvas ${opts.live ? '' : 'data-lolly-offscreen'} style="width:100vw;height:100vh">${runtime.getHydrated()}</div>`,
  }));
  await page.goto(`${origin}/fixture`);
  return page;
}

const heard = (page: Page): Promise<Heard[]> => page.evaluate(() => (window as unknown as { __heard: Heard[] }).__heard);
const firstSignal = (page: Page, timeout = 15_000) => page.waitForFunction(() => (window as unknown as { __heard: unknown[] }).__heard.length > 0, null, { timeout });

describe('Gradient Field as a one-shot picture', { skip }, () => {
  before(async () => {
    server = createServer(async (req, res) => {
      if (req.url === '/tools/gradient/lib/paper-shaders.min.js') {
        res.setHeader('Content-Type', 'text/javascript');
        res.end(await readFile(join(dir, 'lib', 'paper-shaders.min.js')));
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

  it('gives the ready signal once the shader has drawn, and two starters are two pictures, neither the wash', async () => {
    const shots = new Map<string, string>();
    for (const id of ['cathedral-rays', 'lava-lamp']) {
      const page = await open(starter(id));
      try {
        await firstSignal(page);
        const [first] = await heard(page);
        assert.equal(first!.mounted, true, `${id}: the shader canvas is on the page at the signal`);
        assert.equal(first!.lit, true, `${id}: and it has drawn`);
        // The picture a capture takes at the signal.
        shots.set(id, (await page.locator('#stage').screenshot()).toString('base64'));
      } finally { await page.close(); }
    }
    // The bare wash: the same starter where the shader cannot run.
    const washed = await open(starter('cathedral-rays'), { noWebGL: true });
    try {
      await firstSignal(washed);
      assert.equal((await heard(washed))[0]!.mounted, false, 'no shader: the wash is the picture');
      shots.set('wash', (await washed.locator('#stage').screenshot()).toString('base64'));
    } finally { await washed.close(); }
    assert.notEqual(shots.get('cathedral-rays'), shots.get('lava-lamp'), 'God rays and Metaballs are different thumbnails');
    assert.notEqual(shots.get('cathedral-rays'), shots.get('wash'), 'Cathedral rays is not the wash');
    assert.notEqual(shots.get('lava-lamp'), shots.get('wash'), 'Lava lamp is not the wash');
  });

  it('a capture that starts listening late still hears the signal', async () => {
    const page = await open(starter('liquid-silk'));
    try {
      await firstSignal(page);
      await page.waitForFunction(() => (window as unknown as { __lateHeard?: boolean }).__lateHeard === true, null, { timeout: 15_000 });
      assert.equal(await page.evaluate(() => (window as unknown as { __lateNeeded: boolean }).__lateNeeded), true, 'the flag was up for the late listener to find');
      // Once someone has taken the flag down, the signal stops.
      const count = (await heard(page)).length;
      await page.waitForTimeout(400);
      assert.equal((await heard(page)).length, count, 'no signal is given after the flag is down');
    } finally { await page.close(); }
  });

  it('the wash is signalled soon where the shader cannot run, so a capture never waits on a field that will not come', async () => {
    const page = await open(starter('velvet-warp'), { noWebGL: true });
    try {
      const started = Date.now();
      await firstSignal(page, 9000);
      assert.ok(Date.now() - started < 3000, 'soon after the library loaded, not at the capture path\'s own 25 s limit');
    } finally { await page.close(); }
  });

  it('hands its WebGL context back when the stage leaves the page', async () => {
    const page = await open(starter('prismatic-bloom'));
    try {
      await firstSignal(page);
      const lost = await page.evaluate(async () => {
        const stage = document.getElementById('stage') as HTMLElement & { __mgFieldMount?: { gl: WebGL2RenderingContext } | null };
        const gl = stage.__mgFieldMount!.gl;
        stage.remove();
        await new Promise((resolve) => setTimeout(resolve, 1200));
        return { lost: gl.isContextLost(), kept: stage.__mgFieldMount };
      });
      assert.deepEqual(lost, { lost: true, kept: null });
    } finally { await page.close(); }
  });

  it('the live canvas raises no flag: the flag is one value for the whole page', async () => {
    const page = await open(starter('smoke-halo'), { live: true });
    try {
      await page.waitForFunction(() => !!document.querySelector('.mg-field canvas'), null, { timeout: 15_000 });
      await page.waitForTimeout(300);
      assert.deepEqual(await heard(page), [], 'no signal');
      assert.equal(await page.evaluate(() => (window as unknown as { __lateNeeded?: boolean }).__lateNeeded ?? !!(window as unknown as { __toolHasReadySignal?: boolean }).__toolHasReadySignal), false, 'and no flag');
    } finally { await page.close(); }
  });
});
