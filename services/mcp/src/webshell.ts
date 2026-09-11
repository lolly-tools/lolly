// SPDX-License-Identifier: MPL-2.0
/**
 * Tier-B needs a real browser driving a real Lolly web shell. That is the only
 * place the full export pipeline (HTML-layout raster, pdf, video, CMYK, marks)
 * exists. This module resolves that shell, two ways (plans/77-mcp-server.md section 5):
 *
 *   • LOLLY_WEB_BASE set  → a shell is already running somewhere; use it as-is.
 *   • otherwise (self-contained, the recommended container topology) → serve the
 *     BUILT web shell (`shells/web/dist`, or LOLLY_WEB_DIST) from an ephemeral
 *     localhost static server. Built once on demand if the dist is missing and we
 *     are still in the monorepo; a split-out repo/container ships a prebuilt dist
 *     and points LOLLY_WEB_DIST at it (no build step, works air-gapped).
 *
 * The served base is a lazy singleton: built/served once per process, reused by
 * every render, torn down by closeWebShell().
 */

import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, extname, normalize } from 'node:path';
import { REPO_ROOT } from './paths.ts';
import { checkedBase } from './egress.ts';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.map': 'application/json; charset=utf-8',
};

interface Served { base: string; close: () => Promise<void>; }

let served: Promise<Served> | null = null;

/** Base origin of a Lolly web shell to drive for Tier B (no trailing slash). */
export async function webShellBase(): Promise<string> {
  const remote = process.env.LOLLY_WEB_BASE;
  if (remote) return checkedBase(remote).toString().replace(/\/$/, '');
  if (!served) served = buildAndServe().catch(err => { served = null; throw err; });
  return (await served).base;
}

/** Tear down the served shell (no-op for a remote LOLLY_WEB_BASE). */
export async function closeWebShell(): Promise<void> {
  const s = served;
  served = null;
  if (s) { try { await (await s).close(); } catch { /* ignore */ } }
}

async function buildAndServe(): Promise<Served> {
  const dist = process.env.LOLLY_WEB_DIST || join(REPO_ROOT, 'shells', 'web', 'dist');
  if (!existsSync(join(dist, 'index.html'))) {
    // Only the monorepo can build; a container/split repo must ship a prebuilt dist.
    if (!existsSync(join(REPO_ROOT, 'shells', 'web', 'package.json'))) {
      throw new Error(
        `No built web shell at ${dist}. Set LOLLY_WEB_DIST to a prebuilt shell, ` +
        `or LOLLY_WEB_BASE to a running one. Tier-B (pdf/video/HTML-raster) needs it; ` +
        `SVG/data formats render without it.`,
      );
    }
    await buildWebShell();
    if (!existsSync(join(dist, 'index.html'))) throw new Error(`Web shell build produced no ${dist}/index.html`);
  }
  return serveDist(dist);
}

function buildWebShell(): Promise<void> {
  return new Promise<void>((ok, fail) => {
    const child = spawn('npm', ['--workspace', 'shells/web', 'run', 'build'], {
      cwd: REPO_ROOT, stdio: 'inherit', shell: process.platform === 'win32',
    });
    child.on('error', fail);
    child.on('close', code => (code === 0 ? ok() : fail(new Error(`web shell build exited ${code}`))));
  });
}

/** Serve a built dist over localhost, SPA-style (unknown paths → index.html). */
function serveDist(dist: string): Promise<Served> {
  const root = resolve(dist);
  const server = createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]!);
      let filePath = resolve(root, '.' + normalize(urlPath));
      if (!filePath.startsWith(root)) { res.writeHead(403).end(); return; }
      if (urlPath === '/' || !existsSync(filePath) || !(await stat(filePath)).isFile()) {
        filePath = join(root, 'index.html');
      }
      const data = await readFile(filePath);
      res.setHeader('Content-Type', MIME[extname(filePath)] ?? 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store');
      res.end(data);
    } catch { res.writeHead(404).end(); }
  });
  return new Promise<Served>((ok) => {
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port;
      ok({
        base: `http://127.0.0.1:${port}`,
        close: () => new Promise<void>(done => server.close(() => done())),
      });
    });
  });
}
