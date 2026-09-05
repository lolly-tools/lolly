// SPDX-License-Identifier: MPL-2.0
/**
 * The NODE half of the phase-3 sequence-export browser tier: bundle the in-page
 * harness, serve it, and hand back a Playwright page with `window.SEQ` ready.
 *
 * There was no browser-driven test in this repo before phase 3, so this establishes
 * the pattern. It follows the two conventions that already exist:
 *   • the external-dependency gate (`c2pa-c2patool-conformance.test.ts`): skip with a
 *     message naming what is missing, never fail, so `npm test` stays green on a bare
 *     machine - here that is `browserInstalled()` from packages/node-shell;
 *   • the page lifecycle of `packages/node-shell/src/webshell-render.ts`: the pooled
 *     `getBrowser()`, a fresh context per run, `closeBrowser()` in teardown.
 *
 * It does NOT serve the built web-shell dist. That machinery exists to drive the real
 * export UI; what is under test here is three bridge modules, so the page is a bare
 * document with the modules bundled into it - no `npm run build:web` prerequisite.
 *
 * CODECS. `getBrowser()` defaults to Playwright's BUNDLED Chromium, whose proprietary
 * codec support is NOT guaranteed: an H.264/AAC (mp4) case can fail there on codec
 * support rather than on our code, and `LOLLY_BROWSER_CHANNEL=chrome` is the fix. Which
 * is why nothing is gated on the env var alone - `probe()` asks the launched browser what
 * it can actually do (isConfigSupported) and the tests skip on THAT. VP8/VP9/Opus/WebM
 * work everywhere, so the bulk of the suite runs on any build.
 */
import { createServer, type Server } from 'node:http';
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright-core';
import { getBrowser, browserInstalled } from '../../packages/node-shell/src/browsers.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

// One harness at a time across the whole test run. Each openHarness() file drives
// a real video encoder for tens of seconds, and two encoding at once under
// full-suite CPU load starve each other into the executor's 10s no-progress
// watchdog (SEQ_ABORTED - seen as lift-flythrough and depth-flythrough stalling
// each other on alternate runs). node:test runs files in separate processes, so
// the mutex must be cross-process: an atomic mkdir in the OS tmpdir, spun on
// with a stale takeover so a crashed run cannot wedge the tier for the next one.
const ENCODE_LOCK = join(tmpdir(), 'lolly-sequence-browser.lock');
const ENCODE_LOCK_STALE_MS = 5 * 60_000;

async function acquireEncodeLock(): Promise<void> {
  for (;;) {
    try {
      mkdirSync(ENCODE_LOCK);
      return;
    } catch {
      try {
        if (Date.now() - statSync(ENCODE_LOCK).mtimeMs > ENCODE_LOCK_STALE_MS) {
          rmSync(ENCODE_LOCK, { recursive: true, force: true });
          continue;
        }
      } catch { /* the holder released between our mkdir and stat - just retry */ }
      await new Promise((r) => setTimeout(r, 250 + Math.floor(Math.random() * 250)));
    }
  }
}

function releaseEncodeLock(): void {
  rmSync(ENCODE_LOCK, { recursive: true, force: true });
}

export interface CodecProbe {
  webcodecs: boolean;
  avcDecode: boolean;
  avcEncode: boolean;
  vp8: boolean;
  vp9: boolean;
  opus: boolean;
  aac: boolean;
  ua: string;
  deviceMemory: number | null;
}

export interface Harness {
  page: Page;
  probe: CodecProbe;
  close(): Promise<void>;
}

/** Why the browser tier can't run here, or null when it can. */
export function browserGate(): string | null {
  if (!browserInstalled()) {
    return 'no headless browser: run `npm run install:browser` in shells/cli, or set LOLLY_BROWSER_CHANNEL=chrome';
  }
  return null;
}

/** True when the launched browser is a real Chrome/Edge channel (proprietary codecs). */
export function usingChannel(): boolean {
  return Boolean(process.env.LOLLY_BROWSER_CHANNEL || process.env.LOLLY_BROWSER_PATH);
}

async function bundleHarness(): Promise<string> {
  return await bundleFor(join(HERE, 'sequence-browser-harness.ts'));
}

/**
 * The phase-4 composite+encode Worker, bundled as its own module.
 *
 * esbuild leaves `new Worker(new URL('./sequence-render.worker.ts', import.meta.url))`
 * exactly as written, so the page resolves it against `/harness.js` and asks the
 * server for `/sequence-render.worker.ts`. Serving a real bundle there is what
 * makes the worker path reachable in the browser tier at all - without it the
 * spawn 404s, the client reports a plain (non-coded) failure and the render
 * silently falls back in-thread, which would make the comparison vacuous.
 */
async function bundleSequenceWorker(): Promise<string> {
  return await bundleFor(join(HERE, '..', '..', 'shells', 'web', 'src', 'bridge', 'sequence-render.worker.ts'));
}

async function bundleFor(entry: string): Promise<string> {
  const esbuild = await import('esbuild');
  if (!existsSync(entry)) throw new Error(`bundle entry missing: ${entry}`);
  const out = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: 'esm',
    target: 'chrome120',
    platform: 'browser',
    // The harness re-exports the modules under test; a failed tree-shake or a
    // mis-resolved workspace alias must fail the build here, not silently in-page.
    logLevel: 'silent',
    // Vite serves a `import '../styles/parts/x.css'` side-effect import as a real
    // stylesheet; esbuild with no output path refuses it outright. The harness
    // never paints app chrome, so the sheets are dropped rather than emitted.
    // This graph reaches one: bridge/format-support.ts's durable probe lazily
    // imports lib/model-prefetch.ts, and esbuild inlines dynamic imports into
    // the single output file, so components/instance-sheet.ts and its sheet come
    // along even though nothing here ever evaluates them.
    loader: { '.css': 'empty' },
    define: { 'process.env.NODE_ENV': '"test"' },
  });
  return out.outputFiles[0]?.text ?? '';
}

/**
 * Bundle + serve + launch. The server also answers `/stall` with a response that
 * never completes, which is the fixture the provider-timeout case needs.
 */
export async function openHarness(): Promise<Harness> {
  await acquireEncodeLock();
  try {
    return await openHarnessLocked();
  } catch (e) {
    releaseEncodeLock(); // a failed launch must not hold the tier until stale takeover
    throw e;
  }
}

async function openHarnessLocked(): Promise<Harness> {
  const js = await bundleHarness();
  const workerJs = await bundleSequenceWorker();
  const html = '<!doctype html><meta charset="utf-8"><title>sequence tier</title><body><script type="module" src="/harness.js"></script></body>';

  const openSockets = new Set<import('node:net').Socket>();
  const server: Server = createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    if (path === '/harness.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      res.end(js);
      return;
    }
    if (path === '/sequence-render.worker.ts') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      res.end(workerJs);
      return;
    }
    if (path === '/stall') {
      // Headers, one byte, then nothing - ever. A fetch against this resolves its
      // headers and then hangs on the body, which is exactly the "decoder went
      // quiet" shape the timeout is supposed to catch.
      res.writeHead(200, { 'content-type': 'video/webm', 'content-length': '10000000' });
      res.write('\x1aE\xdf\xa3');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  server.on('connection', (s) => { openSockets.add(s); s.on('close', () => openSockets.delete(s)); });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as { port: number }).port;

  const browser: Browser = await getBrowser();
  const ctx: BrowserContext = await browser.newContext();
  const page = await ctx.newPage();
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(`console: ${m.text()}`); });

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
  try {
    await page.waitForFunction('window.__SEQ_READY === true', undefined, { timeout: 20_000 });
  } catch {
    throw new Error(`harness never became ready. Page errors:\n${pageErrors.join('\n') || '(none)'}`);
  }
  const probe = (await page.evaluate('window.SEQ.probe()')) as CodecProbe;

  return {
    page,
    probe,
    async close(): Promise<void> {
      try {
        await ctx.close().catch(() => {});
        for (const s of openSockets) s.destroy();
        await new Promise<void>((r) => server.close(() => r()));
      } finally {
        releaseEncodeLock();
      }
    },
  };
}
