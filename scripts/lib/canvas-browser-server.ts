// SPDX-License-Identifier: MPL-2.0
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import type { AddressInfo } from 'node:net';

/** Disposable loopback server for canvas measurements against a production build. */
export async function serveCanvasBuild() {
  const dist = resolve(process.env.LOLLY_WEB_DIST ?? 'shells/web/dist');
  if (!existsSync(join(dist, 'index.html'))) throw new Error('Build the web shell first or set LOLLY_WEB_DIST.');
  const mime: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.png': 'image/png' };
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      let path = resolve(dist, `.${decodeURIComponent(url.pathname)}`);
      if (!path.startsWith(`${dist}/`) && path !== dist) { response.writeHead(403); response.end(); return; }
      if (url.pathname === '/' || !existsSync(path)) path = join(dist, 'index.html');
      const bytes = await readFile(path);
      response.writeHead(200, { 'content-type': mime[extname(path)] ?? 'application/octet-stream' });
      response.end(bytes);
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, close: () => new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done())) };
}
