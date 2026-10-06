// SPDX-License-Identifier: MPL-2.0
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { createLiveRelay } from './live-relay.ts';

/** The hosted invitation relay exposes only document-scoped collaboration. */
export function createLiveHttpServer(env: NodeJS.ProcessEnv = process.env) {
  const relay = createLiveRelay(env);
  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ service: 'lolly-live', status: 'ok' }));
      return;
    }
    relay.handle(req, res).then(handled => {
      if (!handled) { res.writeHead(404); res.end(); }
    }).catch(() => { if (!res.headersSent) res.writeHead(500); res.end(); });
  });
  const dispose = relay.mount(server);
  server.on('upgrade', (req, socket) => {
    if ((req.url ?? '').split('?')[0] !== '/live/editor') socket.destroy();
  });
  server.once('close', dispose);
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createLiveHttpServer();
  server.listen(Number(process.env.PORT || 8790), process.env.LOLLY_MCP_BIND_HOST || '127.0.0.1');
  for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => {
    server.close();
    server.closeAllConnections();
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
