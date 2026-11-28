// SPDX-License-Identifier: MPL-2.0
/**
 * WOFF2 decoding in a real browser: each font in its own module Web Worker.
 *
 * Two lanes:
 *
 * - The production build (`shells/web/dist`), served here with the response headers
 *   vercel.json sends (the Content-Security-Policy with `worker-src`, `script-src` and
 *   `wasm-unsafe-eval`, COOP, COEP), through the service worker and then offline. The
 *   built WOFF2 chunk is imported in the page and decodes every public font in the tree
 *   to the pinned SHA-256 values with the Rust decoder module (one compile per page, a
 *   fresh instance per font), refuses damaged ones with a plain message, leaves the
 *   main thread free while it works, and the service worker keeps the module for
 *   offline use.
 * - The source shell (`LOLLY_EXPORT_TEST_URL`, a Vite dev server, as CI starts it): a
 *   WOFF2 font installed as a user font outlines to paths in an SVG export.
 *
 * Each lane skips by name without Chromium, the build or the source shell.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(REPO, 'shells/web/dist');
const CORPUS = (JSON.parse(readFileSync(join(REPO, 'packages/node-shell/test/fixtures/woff2-corpus.json'), 'utf8')) as {
  fonts: Record<string, { bytes: number; sha256: string }>;
}).fonts;

async function chromiumOrSkip(): Promise<{ chromium: typeof import('playwright').chromium } | string> {
  let chromium: typeof import('playwright').chromium;
  try { ({ chromium } = await import('playwright')); } catch { return 'playwright not installed'; }
  try {
    const path = chromium.executablePath();
    if (!path || !existsSync(path)) return 'no Chromium (pnpm exec playwright install chromium)';
  } catch { return 'no Chromium (pnpm exec playwright install chromium)'; }
  return { chromium };
}

/** The headers vercel.json sends on every app path except /any-site. */
function deployedHeaders(): Record<string, string> {
  const config = JSON.parse(readFileSync(join(REPO, 'vercel.json'), 'utf8')) as { headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }> };
  const app = config.headers.find((rule) => rule.source.startsWith('/((?!any-site'));
  assert.ok(app, 'vercel.json has an app-wide header rule');
  return Object.fromEntries(app.headers.map(({ key, value }) => [key, value]));
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.txt': 'text/plain',
};

/** The built app with the deployed headers, an SPA fallback, and the corpus under /__corpus/. */
async function serveDist(extra: Map<string, string>): Promise<{ origin: string; server: Server }> {
  const headers = deployedHeaders();
  const server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://x').pathname);
    for (const [key, value] of Object.entries(headers)) response.setHeader(key, value);
    let file = extra.get(pathname) ?? normalize(join(DIST, pathname));
    if (!extra.has(pathname) && !file.startsWith(DIST + sep) && file !== DIST) { response.writeHead(403).end(); return; }
    if (!existsSync(file) || !statSync(file).isFile()) {
      if (extname(pathname)) { response.writeHead(404).end(); return; }
      file = join(DIST, 'index.html');
    }
    response.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
    response.end(readFileSync(file));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, server };
}

/** The built guard chunk (`_app/woff2-<hash>.js`), as opposed to its worker chunk. */
function guardChunk(): string | null {
  const app = join(DIST, '_app');
  if (!existsSync(app)) return null;
  const name = readdirSync(app).find((file) => /^woff2-[\w-]+\.js$/.test(file) && !file.includes('worker'));
  return name ? `/_app/${name}` : null;
}

interface Decoded { path: string; hash?: string; error?: { name: string; code?: string; message: string }; ms: number; length?: number }

/** In the page: import the built chunk and decode each URL, in order, timing each. */
const decodeInPage = async ({ chunk, items }: { chunk: string; items: Array<{ path: string; url: string }> }): Promise<Decoded[]> => {
  const mod = await import(chunk) as { decodeWoff2(bytes: Uint8Array): Promise<Uint8Array> };
  const out: Decoded[] = [];
  for (const item of items) {
    const bytes = new Uint8Array(await (await fetch(item.url)).arrayBuffer());
    const started = performance.now();
    try {
      const sfnt = await mod.decodeWoff2(bytes);
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', sfnt as Uint8Array<ArrayBuffer>));
      out.push({ path: item.path, hash: [...digest].map((b) => b.toString(16).padStart(2, '0')).join(''), ms: performance.now() - started, length: sfnt.length });
    } catch (error) {
      const e = error as { name: string; code?: string; message: string };
      out.push({ path: item.path, error: { name: e.name, code: e.code, message: e.message }, ms: performance.now() - started });
    }
  }
  return out;
};

const PUBLIC_FONTS = Object.keys(CORPUS).filter((path) => path.startsWith('shells/web/public/fonts/'));
const median = (values: number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

test('the production build decodes WOFF2 in a worker under the deployed CSP, online and offline', { timeout: 300_000 }, async (t) => {
  const browserType = await chromiumOrSkip();
  if (typeof browserType === 'string') { t.skip(browserType); return; }
  const chunk = guardChunk();
  if (!existsSync(join(DIST, 'index.html')) || !chunk) { t.skip('no production build of the web shell (pnpm run build:web)'); return; }

  const extra = new Map<string, string>();
  for (const path of Object.keys(CORPUS)) extra.set(`/__corpus/${path}`, join(REPO, path));
  const { origin, server } = await serveDist(extra);
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const browser = await browserType.chromium.launch({ headless: true, channel: process.env.LOLLY_BROWSER_CHANNEL });
  t.after(() => browser.close());
  const context = await browser.newContext();
  const page = await context.newPage();
  const policyErrors: string[] = [];
  page.on('console', (message) => { if (/Content.Security.Policy|Refused to/i.test(message.text())) policyErrors.push(message.text()); });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      const seen = window as unknown as { __csp?: string[] };
      seen.__csp = [...(seen.__csp ?? []), `${event.violatedDirective} ${event.blockedURI}`];
    });
  });

  // First visit: the service worker registers on load; the second load runs under the worker.
  await page.goto(`${origin}/`, { waitUntil: 'load' });
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload({ waitUntil: 'load' });
  assert.equal(await page.evaluate(() => !!navigator.serviceWorker.controller), true, 'the service worker controls the page');

  const items = PUBLIC_FONTS.map((path) => ({ path, url: `/fonts/${path.split('/').pop()}` }));
  for (const result of await page.evaluate(decodeInPage, { chunk, items })) {
    assert.equal(result.error, undefined, `${result.path}: ${result.error?.message}`);
    assert.equal(result.hash, CORPUS[result.path]!.sha256, result.path);
  }

  // Every public WOFF2 font in the tree, the fallback fonts included, three times over:
  // byte for byte, with the time each takes (a worker start, an instance and the decode).
  const everything = Object.keys(CORPUS).map((path) => ({ path, url: `/__corpus/${path}` }));
  const times = new Map<string, number[]>();
  for (let round = 0; round < 3; round++) {
    for (const result of await page.evaluate(decodeInPage, { chunk, items: everything })) {
      assert.equal(result.error, undefined, `${result.path}: ${result.error?.message}`);
      assert.equal(result.hash, CORPUS[result.path]!.sha256, result.path);
      times.set(result.path, [...(times.get(result.path) ?? []), result.ms]);
    }
  }
  let total = 0;
  for (const [path, ms] of times) {
    total += median(ms);
    t.diagnostic(`${median(ms).toFixed(1).padStart(7)} ms  ${CORPUS[path]!.bytes} bytes  ${path}`);
  }
  t.diagnostic(`all ${times.size} fonts: ${total.toFixed(0)} ms (sum of medians, one worker per font)`);

  // Twenty faces asked for together, as the font registry asks for a family's faces: at
  // most four workers at once, every result byte for byte, the main thread still ticking.
  const together = await page.evaluate(async ({ chunk: path, items: list }) => {
    const mod = await import(path) as { decodeWoff2(bytes: Uint8Array): Promise<Uint8Array> };
    const files = await Promise.all(list.map(async (item) => new Uint8Array(await (await fetch(item.url)).arrayBuffer())));
    let maxGap = 0, last = performance.now(), running = true;
    const tick = (): void => { const now = performance.now(); maxGap = Math.max(maxGap, now - last); last = now; if (running) setTimeout(tick, 0); };
    setTimeout(tick, 0);
    const started = performance.now();
    const outs = await Promise.all(files.map((bytes) => mod.decodeWoff2(bytes)));
    const ms = performance.now() - started;
    running = false;
    const hashes = await Promise.all(outs.map(async (out) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', out as Uint8Array<ArrayBuffer>))].map((b) => b.toString(16).padStart(2, '0')).join('')));
    return { ms, maxGap, hashes };
  }, { chunk, items: everything.slice(0, 20) });
  for (const [i, hash] of together.hashes.entries()) assert.equal(hash, CORPUS[everything[i]!.path]!.sha256, `together: ${everything[i]!.path}`);
  t.diagnostic(`twenty fonts requested together: ${together.ms.toFixed(0)} ms; longest main-thread gap ${together.maxGap.toFixed(0)} ms`);

  // A damaged file is refused with a plain message, before the decoder (bad header) and
  // by the decoder in its worker (a corrupt Brotli stream).
  const refusals = await page.evaluate(async ({ chunk: path, url }) => {
    const mod = await import(path) as { decodeWoff2(bytes: Uint8Array): Promise<Uint8Array> };
    const good = new Uint8Array(await (await fetch(url)).arrayBuffer());
    const header = good.slice(0, 40);
    const stream = good.slice();
    stream.fill(0xff, 140, 400);
    const results: Array<{ name: string; code?: string; message: string }> = [];
    for (const bytes of [header, stream]) {
      try { await mod.decodeWoff2(bytes); results.push({ name: 'decoded', message: '' }); }
      catch (error) { const e = error as { name: string; code?: string; message: string }; results.push({ name: e.name, code: e.code, message: e.message }); }
    }
    return results;
  }, { chunk, url: '/fonts/Outfit-latin-ext[wght].woff2' });
  assert.deepEqual(refusals.map((r) => [r.name, r.code]), [['Woff2Error', 'malformed'], ['Woff2Error', 'decode-failed']]);
  for (const r of refusals) assert.match(r.message, /^This WOFF2 font (is damaged: .+|could not be decoded)\.$/);

  // The main thread keeps running while the largest public font decodes in its worker.
  const responsive = await page.evaluate(async ({ chunk: path, url }) => {
    const mod = await import(path) as { decodeWoff2(bytes: Uint8Array): Promise<Uint8Array> };
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
    let maxGap = 0, last = performance.now(), ticks = 0, running = true;
    const tick = (): void => { const now = performance.now(); maxGap = Math.max(maxGap, now - last); last = now; ticks++; if (running) setTimeout(tick, 0); };
    setTimeout(tick, 0);
    const started = performance.now();
    await mod.decodeWoff2(bytes);
    const ms = performance.now() - started;
    running = false;
    return { maxGap, ms, ticks };
  }, { chunk, url: '/fonts/NotoColorEmoji-COLRv1.woff2' });
  t.diagnostic(`NotoColorEmoji decode ${responsive.ms.toFixed(0)} ms; longest main-thread gap ${responsive.maxGap.toFixed(0)} ms over ${responsive.ticks} ticks`);
  assert.ok(responsive.ticks > 10, 'the main thread ran while the font decoded');
  assert.ok(responsive.maxGap < 100, `the main thread stalled for ${responsive.maxGap.toFixed(0)} ms`);

  // Where no worker can run, the font is refused with a plain message; nothing falls
  // back to decoding in the page.
  const fallbacks = await page.evaluate(async ({ chunk: path, url }) => {
    const mod = await import(path) as { decodeWoff2(bytes: Uint8Array): Promise<Uint8Array> };
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
    const scope = window as unknown as { Worker: unknown };
    const real = scope.Worker as typeof Worker;
    const attempt = async (): Promise<{ name: string; code?: string; message: string }> => {
      try { await mod.decodeWoff2(bytes); return { name: 'decoded', message: '' }; }
      catch (error) { const e = error as { name: string; code?: string; message: string }; return { name: e.name, code: e.code, message: e.message }; }
    };
    const results: Array<{ name: string; code?: string; message: string }> = [];
    try {
      scope.Worker = undefined;
      results.push(await attempt());
      scope.Worker = class extends real { constructor(_url: string | URL, options?: WorkerOptions) { super('/_app/no-such-worker.js', options); } };
      results.push(await attempt());
    } finally { scope.Worker = real; }
    results.push(await attempt());
    return results;
  }, { chunk, url: '/fonts/Outfit-latin-ext[wght].woff2' });
  assert.deepEqual(fallbacks.map((r) => [r.name, r.code]), [['Woff2Error', 'decode-failed'], ['Woff2Error', 'decode-failed'], ['decoded', undefined]]);
  assert.match(fallbacks[0]!.message, /^No separate WOFF2 decoder is available here, so the font was not decoded\.$/);
  assert.equal(fallbacks[1]!.message, 'This WOFF2 font could not be decoded.');

  // The service worker holds the decoder module, so an offline page can decode too.
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) urls.push(new URL(request.url).pathname);
    }
    return urls.filter((path) => /^\/_app\/woff2-kernel-[\w-]+\.wasm$/.test(path));
  });
  assert.equal(cached.length, 1, `the service worker caches the WOFF2 decoder module (${cached.join(', ') || 'none'})`);

  // Offline, from the service worker's cache: the guard chunk, the worker chunk and the
  // decoder module still load, in a page that has not compiled the module yet.
  await context.setOffline(true);
  await page.reload({ waitUntil: 'load' });
  const offline = await page.evaluate(decodeInPage, { chunk, items: items.slice(0, 2) });
  for (const result of offline) assert.equal(result.hash, CORPUS[result.path]!.sha256, `offline ${result.path}: ${result.error?.message}`);
  await context.setOffline(false);

  assert.deepEqual(policyErrors, []);
  assert.deepEqual(await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []), []);
});

test('WOFF2 faces outline to paths in an SVG export', { timeout: 300_000 }, async (t) => {
  const browserType = await chromiumOrSkip();
  if (typeof browserType === 'string') { t.skip(browserType); return; }
  const origin = process.env.LOLLY_EXPORT_TEST_URL;
  if (!origin) { t.skip('set LOLLY_EXPORT_TEST_URL to a local Vite shell'); return; }

  const browser = await browserType.chromium.launch({ headless: true, channel: process.env.LOLLY_BROWSER_CHANNEL });
  t.after(() => browser.close());
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.goto(`${origin}/#/profile`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  // Cinzel: a public WOFF2 face that no catalog or platform font answers for, so an
  // outline can only come from the WOFF2 bytes through the decoder.
  const cinzel = readFileSync(join(REPO, 'shells/web/public/info/fonts/cinzel-latin.woff2')).toString('base64');
  const result = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const [{ createBridge }, { installFontFromBytes }, { renderSvgFromHtml }, { setExportHost }, registry] = await Promise.all([
      import('/src/bridge/index.ts' as string), import('/src/user-fonts.ts' as string),
      import('/src/bridge/export-svg-walker.ts' as string), import('/src/bridge/export-shared.ts' as string),
      import('/src/bridge/font-registry.ts' as string),
    ]);
    const host = await createBridge();
    setExportHost(host);
    const exportRun = async (family: string): Promise<string> => {
      const node = document.createElement('div');
      node.style.cssText = 'position:fixed;left:0;top:0;width:640px;height:160px;background:#fff;color:#111';
      const run = document.createElement('span');
      run.style.cssText = `font-family:"${family}";font-size:64px;line-height:1`;
      run.textContent = 'LOLLY FONTS';
      node.append(run);
      document.body.append(node);
      await document.fonts.load(`64px "${family}"`);
      registry.bustFontRegistry();
      try { return await (await renderSvgFromHtml(node, { format: 'svg', convertPaths: true, embedMeta: false })).text(); }
      finally { node.remove(); }
    };

    // A WOFF2 face the page declares with @font-face (a brand or web font): the
    // registry fetches the url() and decodes the bytes in a worker.
    const style = document.createElement('style');
    style.textContent = '@font-face{font-family:"Cinzel Webfont";src:url("/info/fonts/cinzel-latin.woff2") format("woff2")}';
    document.head.append(style);
    const declared = await exportRun('Cinzel Webfont');

    // The same face uploaded as a user font, into whichever design system is active
    // (tests/user-font-design-system.browser.test.ts covers each kind of system).
    const installed = await installFontFromBytes(host, bytes, { filename: 'cinzel-latin.woff2', makePrimary: false });
    if (!installed) throw new Error('the WOFF2 font was not installed');
    const uploaded = await exportRun(installed.family);
    return { family: installed.family, declared, uploaded };
  }, cinzel);
  assert.equal(result.family, 'Cinzel');
  for (const [label, svg] of [['declared', result.declared], ['uploaded', result.uploaded]] as const) {
    assert.match(svg, /<path\b[^>]*\bd="M/, `${label}: the run became outlines`);
    assert.doesNotMatch(svg, /<text\b/, `${label}: no <text> fallback`);
  }
});
