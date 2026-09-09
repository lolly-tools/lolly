// SPDX-License-Identifier: MPL-2.0
/**
 * Streamable-HTTP MCP transport (POST subset) + the OAuth/discovery routes. A
 * single handler (createGateway, gateway.ts) accepts a JSON-RPC POST at /mcp and
 * returns a single JSON response (202 for notifications), and also serves the
 * OAuth authorization-server endpoints so a remote client (claude.ai) can connect.
 * Full SSE streaming + session management is roadmap M1 (or adopt the MCP SDK).
 *
 * Run standalone:  node services/mcp/src/http.ts   (PORT, default 8790)
 * This is the container/worker deployment path (owns the Tier-B browser pool).
 * The same gateway is wrapped by the Vercel function (vercel-entry.ts) for the
 * serverless "alongside Lolly" deployment. See services/ca for that shape and
 * plans/77-mcp-server.md section 5.
 */

import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { createGateway } from './gateway.ts';

/** @deprecated name kept for back-compat; the gateway now also serves OAuth. */
export const createMcpHttpHandler = createGateway;

export function startHttpServer(port = Number(process.env.PORT || 8790)): void {
  const handler = createGateway();
  createServer((req, res) => {
    handler(req, res).catch(err => {
      try { res.writeHead(500, { 'content-type': 'application/json' }); res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32603, message: String(err) } })); }
      catch { /* headers already sent */ }
    });
  }).listen(port, () => {
    process.stderr.write(`lolly-mcp (http) on http://localhost:${port}/mcp\n`);
    if (!process.env.LOLLY_WEB_BASE) process.stderr.write('  note: LOLLY_WEB_BASE unset - Tier-B (browser) formats disabled; svg/data + resvg-png still work.\n');
  });
}

// Run standalone when invoked directly.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) startHttpServer();
