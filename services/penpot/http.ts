// SPDX-License-Identifier: MPL-2.0
import { createServer, type Server } from 'node:http';
import { pathToFileURL } from 'node:url';
import { createPenpotProxy } from './vercel-entry.ts';

/** Provider-neutral listener; the same proxy owns token custody and import streaming. */
export function createPenpotHttpServer(fetchImpl: typeof fetch = fetch): Server {
  const proxy = createPenpotProxy(fetchImpl);
  const server = createServer((req, res) => {
    let pathname: string;
    try { pathname = new URL(req.url ?? '/', 'http://internal').pathname; }
    catch { res.writeHead(400); res.end(); return; }
    res.setHeader('cache-control', 'no-store');
    res.setHeader('x-content-type-options', 'nosniff');
    if (pathname === '/healthz') {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { allow: 'GET, HEAD' }); res.end(); return;
      }
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(req.method === 'HEAD' ? undefined : 'ok\n');
      return;
    }
    if (!/^\/api\/penpot\/rpc\/[^/]+\/?$/.test(pathname)) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not-found' }));
      return;
    }
    // Bound inactive and total response time without buffering the SSE stream.
    res.setTimeout(120_000, () => res.destroy());
    const deadline = setTimeout(() => res.destroy(), 300_000);
    deadline.unref();
    res.once('close', () => clearTimeout(deadline));
    proxy(req, res).catch(() => {
      if (res.headersSent) { res.destroy(); return; }
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'penpot-unreachable' }));
    });
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 30_000;
  server.maxHeadersCount = 64;
  server.keepAliveTimeout = 5_000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 8791);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535');
  createPenpotHttpServer().listen(port, process.env.LOLLY_PENPOT_BIND_HOST || '127.0.0.1', () => {
    console.log(`lolly-penpot listening on port ${port}`);
  });
}
