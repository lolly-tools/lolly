// SPDX-License-Identifier: MPL-2.0
/**
 * url-shot's SVG is vector: the CLI and TUI capture (`captureUrl`, svg) walks
 * the live page into geometry instead of wrapping a screenshot in an <svg><image>.
 *
 * One fixture page holds each thing the capture has to carry over from someone
 * else's page:
 *   - a heading in a webfont, which must come back as outlines from that font, and a
 *     line in a face declared by a cross-origin stylesheet the page cannot read,
 *     whose font file Chrome does not keep in the tab's resource cache;
 *   - a picture from another origin that sends no CORS header, which the page walk
 *     cannot fetch and the shell fills from the tab's cache;
 *   - a canvas, which the walk cannot read and the shell fills from the screenshot;
 *   - a blurred box-shadow, which the print path rasterised and the walk draws as
 *     a shape under an SVG blur;
 *   - a strict Content-Security-Policy, which refused the capture's own CSS before
 *     the CSS went in as an inspector stylesheet.
 *
 * Skips, naming the fix, when no headless browser is installed.
 */
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { browserGate } from './helpers/sequence-browser.ts';
import { captureUrl, type CaptureParams } from '../packages/node-shell/src/url-capture.ts';
import { closeBrowser } from '../packages/node-shell/src/browsers.ts';

const FONT = readFileSync(new URL('../shells/web/public/fonts/Outfit-latin[wght].woff2', import.meta.url));
const PNG = readFileSync(new URL('../shells/chrome-extension/icons/icon-48.png', import.meta.url));

const gate = browserGate();

function serve(handler: (path: string) => { type: string; body: string | Buffer; headers?: Record<string, string> } | null): Promise<{ server: Server; origin: string }> {
  const server = createServer((req, res) => {
    const out = handler(new URL(req.url ?? '/', 'http://x').pathname);
    if (!out) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': out.type, ...(out.headers ?? {}) });
    res.end(out.body);
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({ server, origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}` })));
}

describe('url-shot SVG capture is vector', { skip: gate ?? false, concurrency: 1 }, () => {
  let page: Awaited<ReturnType<typeof serve>>;
  let images: Awaited<ReturnType<typeof serve>>;
  before(async () => {
    // No Access-Control-Allow-Origin: the picture is cross-origin to the page, and the page cannot read the bytes.
    images = await serve((p) => {
      if (p === '/p.png') return { type: 'image/png', body: PNG };
      if (p === '/css/g.css') return { type: 'text/css', body: "@font-face { font-family: Second; src: url(../fonts/g.woff2) format('woff2'); font-weight: 100 900; }" };
      if (p === '/fonts/g.woff2') return { type: 'font/woff2', body: FONT, headers: { 'access-control-allow-origin': '*' } };
      return null;
    });
    page = await serve((p) => {
      if (p === '/f.woff2') return { type: 'font/woff2', body: FONT };
      // Loads, then never gives its main thread back: no evaluation or DevTools call answers.
      if (p === '/busy') return { type: 'text/html', body: '<!doctype html><p>Busy</p><script>addEventListener("load", () => setTimeout(() => { for (;;) {} }, 50))</script>' };
      if (p !== '/') return null;
      return {
        type: 'text/html',
        headers: { 'content-security-policy': `default-src 'self'; img-src 'self' ${images.origin}; script-src 'unsafe-inline'; style-src 'self' 'unsafe-inline' ${images.origin}; font-src 'self' ${images.origin}` },
        body: `<!doctype html><html><head><link rel="stylesheet" href="${images.origin}/css/g.css"><style>
          @font-face { font-family: Fixture; src: url(/f.woff2) format('woff2'); font-weight: 100 900; }
          html { background: #f4f1ea; } body { margin: 0; font-family: Fixture, sans-serif; }
          h1 { margin: 24px; font-size: 44px; font-weight: 700; color: #0c322c; }
          .card { margin: 24px; width: 220px; height: 60px; border-radius: 12px; background: #30ba78; box-shadow: 0 8px 24px rgba(0,0,0,.35); }
        </style></head><body>
          <h1>Vector capture</h1>
          <p style="margin:0 24px;font:500 18px Second, sans-serif">A second face</p>
          <img src="${images.origin}/p.png" width="96" height="96" style="margin:0 24px">
          <canvas id="c" width="120" height="60" style="margin:0 24px"></canvas>
          <div class="card"></div>
          <script>const x = document.getElementById('c').getContext('2d'); x.fillStyle = '#da1889'; x.fillRect(0, 0, 120, 60);</script>
        </body></html>`,
      };
    });
  });
  after(async () => {
    await closeBrowser();
    page.server.close();
    images.server.close();
  });

  const params = (over: Partial<CaptureParams> = {}): CaptureParams => ({
    url: `${page.origin}/`, scrollDepth: 0, waitMs: 300, css: '',
    cropLeft: 0, cropRight: 0, cropTop: 0, cropBottom: 0,
    recolor: 'none', tintColor: '#30ba78', hue: 0, zoom: 1, ...over,
  });

  test('geometry, outlined text, the page\'s own picture and the canvas off the screen', async () => {
    const { bytes, mime, notes } = await captureUrl(params(), 'svg', { width: 640, height: 400, dpi: 96 });
    const svg = new TextDecoder().decode(bytes);
    assert.equal(mime, 'image/svg+xml');
    assert.deepEqual(notes, [], 'no fallback to a screenshot');
    assert.match(svg, /^<svg[^>]*\swidth="640"[^>]*\sheight="400"/);
    assert.doesNotMatch(svg, /<text\b/, 'the heading is outlined from the page\'s webfont');
    assert.doesNotMatch(svg, /lolly-region:|lolly-font:|data-lolly-text|https?:\/\/127\.0\.0\.1/, 'no placeholder or page URL is left in the file');
    const hrefs = [...svg.matchAll(/<image\b[^>]*\shref="([^"]{0,40})/g)].map((m) => m[1]!);
    assert.equal(hrefs.length, 2, `the picture and the canvas, and nothing else, are bitmaps (got ${hrefs.join(', ')})`);
    assert.ok(hrefs.every((h) => h.startsWith('data:image/png')), 'both are inlined');
    assert.match(svg, /<feGaussianBlur\b/, 'the shadow is a blurred shape, not a bitmap');
    // The shaper writes one path per line: the heading's holds a subpath for each of
    // its 13 visible glyphs (more, for the counters of e, a, p and t).
    const glyphs = Math.max(...[...svg.matchAll(/<path\b[^>]*\sd="([^"]*)"/g)].map((m) => (m[1]!.match(/M/g) ?? []).length));
    assert.ok(glyphs >= 13, `the heading is drawn glyph by glyph (largest path has ${glyphs} subpaths)`);
  });

  test('a crop frames the walked window, and recolour stays a filter', async () => {
    const { bytes } = await captureUrl(params({ cropTop: 0.25, cropLeft: 0.1, recolor: 'grayscale' }), 'svg', { width: 640, height: 400, dpi: 96 });
    const svg = new TextDecoder().decode(bytes);
    assert.match(svg, /^<svg[^>]*\swidth="576"[^>]*\sheight="300"[^>]*\sviewBox="64 100 576 300"/);
    assert.match(svg, /<feColorMatrix\b/, 'the greyscale pass reached the page through its CSP and stayed vector');
  });

  test('zoom draws a smaller viewport larger, as the browser does', async () => {
    const { bytes } = await captureUrl(params({ zoom: 2 }), 'svg', { width: 640, height: 400, dpi: 96 });
    const svg = new TextDecoder().decode(bytes);
    assert.match(svg, /^<svg[^>]*\swidth="640"[^>]*\sheight="400"[^>]*\sviewBox="0 0 320 200"/);
  });

  test('a page that stops answering ends the capture at the deadline instead of hanging', async () => {
    const t0 = Date.now();
    await assert.rejects(
      captureUrl(params({ url: `${page.origin}/busy` }), 'svg', { width: 640, height: 400, dpi: 96 }, { deadlineMs: 4000 }),
      /stopped answering/,
    );
    assert.ok(Date.now() - t0 < 20_000, 'the context closes at the deadline');
  });
});
