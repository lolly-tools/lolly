// SPDX-License-Identifier: MPL-2.0
/**
 * The Chrome extension's vector screenshot (`spec.vector`, extension 0.5.0): after
 * one approval it walks the target page with its packaged page-walk script and hands
 * back the walk, a screenshot of the same moment and the tab's own bytes for what
 * the walk could not read. The Lolly app finishes that reading (capture/
 * finish-in-app.ts, covered with the desktop's in url-shot-vector.browser.test.ts).
 *
 * The packed development extension is loaded with the fixture site pre-granted in
 * its manifest, so Approve once does not stop at Chrome's permission bubble, which
 * automation cannot answer. The Lolly page is a context route; the target and its
 * picture come from two local servers, because a tab the extension opens itself is
 * not one Playwright routes, and a second port is a second origin.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { packChromeExtension } from '../scripts/pack-chrome-extension.ts';

const FONT = readFileSync(new URL('../shells/web/public/fonts/Outfit-latin[wght].woff2', import.meta.url));
const PNG = readFileSync(new URL('../shells/chrome-extension/icons/icon-48.png', import.meta.url));

function serve(routes: Record<string, { type: string; body: string | Buffer }>): Promise<{ server: Server; origin: string }> {
  const server = createServer((req, res) => {
    const hit = routes[new URL(req.url ?? '/', 'http://x').pathname];
    if (!hit) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': hit.type });
    res.end(hit.body);
  });
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok({ server, origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}` })));
}

interface VectorReply {
  ok: boolean;
  error?: string;
  vector?: {
    walk: { svg: string; unresolved: string[]; text: { runs: Array<{ text: string }>; fonts: { rules: Array<{ urls: string[] }> } } };
    shot: string;
    scale: number;
    resources: Record<string, { base64: string; mime: string }>;
  };
}

test('one approval returns the page walked into SVG with the bytes it named', {
  skip: existsSync(chromium.executablePath()) ? false : 'Install Playwright Chromium for extension vector coverage',
  timeout: 60_000,
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lolly-extension-vector-'));
  const extension = join(directory, 'extension');
  await packChromeExtension({ development: true, outputDir: extension });
  const manifestPath = join(extension, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.host_permissions = ['http://127.0.0.1/*'];
  await writeFile(manifestPath, JSON.stringify(manifest));
  const cdn = await serve({ '/p.png': { type: 'image/png', body: PNG } });
  const target = await serve({
    '/f.woff2': { type: 'font/woff2', body: FONT },
    '/page': {
      type: 'text/html',
      body: `<!doctype html><style>@font-face{font-family:F;src:url(/f.woff2) format('woff2');font-weight:100 900}
        body{margin:0;font-family:F}h1{margin:20px;font-size:40px}</style>
        <h1>Walked</h1><img src="${cdn.origin}/p.png" width="48" height="48">
        <canvas id="c" width="60" height="30"></canvas>
        <script>document.getElementById('c').getContext('2d').fillRect(0, 0, 60, 30)</script>`,
    },
  });
  const context = await chromium.launchPersistentContext(join(directory, 'profile'), {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    await context.route('http://localhost:5173/vector-fixture', route => route.fulfill({ contentType: 'text/html', body: '<main>Lolly fixture</main>' }));
    const page = await context.newPage();
    await page.goto('http://localhost:5173/vector-fixture');
    await page.waitForFunction(() => (window as unknown as { __lollyCapture?: { vectorProtocol?: number } }).__lollyCapture?.vectorProtocol === 1);
    const approvalOpened = context.waitForEvent('page');
    await page.evaluate((url) => {
      window.addEventListener('message', event => {
        if (event.source === window && event.data?.source === 'lolly-capture/ext' && event.data.id === 'vector-request') {
          (window as unknown as Record<string, unknown>).fixtureReply = event.data;
        }
      });
      window.postMessage({ source: 'lolly-capture/page', type: 'capture', id: 'vector-request',
        spec: { url, width: 640, height: 400, waitMs: 300, vector: true } }, location.origin);
    }, `${target.origin}/page`);
    const approval = await approvalOpened;
    await approval.waitForURL(/consent\.html\?request=/);
    await approval.waitForFunction(() => !(document.getElementById('approve') as HTMLButtonElement).disabled);
    assert.equal(await approval.locator('#reading').textContent(), 'vector screenshot', 'the approval says what is read');
    await approval.getByRole('button', { name: 'Approve once' }).click();
    await page.waitForFunction(() => !!(window as unknown as Record<string, unknown>).fixtureReply, null, { timeout: 45_000 });
    const reply = await page.evaluate(() => (window as unknown as Record<string, unknown>).fixtureReply as VectorReply);
    assert.equal(reply.ok, true, reply.error ?? 'the reading did not succeed');
    const v = reply.vector!;
    assert.match(v.walk.svg, /^<svg/);
    assert.match(v.walk.svg, /lolly-region:/, 'the canvas is a region box for the app to fill');
    assert.ok(v.walk.text.runs.some(r => r.text === 'Walked'), 'the heading is a run for the app to outline');
    assert.ok(v.shot.length > 100, 'a screenshot of the same moment');
    assert.deepEqual(v.walk.unresolved, [`${cdn.origin}/p.png`], 'the cross-origin picture is the one the page could not read');
    assert.ok(v.resources[`${cdn.origin}/p.png`], 'and it comes back from the tab');
    assert.ok(v.resources[`${target.origin}/f.woff2`], 'so does the font the page loaded');
  } finally {
    await context.close();
    cdn.server.close();
    target.server.close();
    await rm(directory, { recursive: true, force: true });
  }
});
