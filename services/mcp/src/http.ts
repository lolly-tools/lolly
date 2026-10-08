// SPDX-License-Identifier: MPL-2.0
/**
 * Streamable-HTTP MCP transport (POST subset) + the OAuth/discovery routes. A
 * single handler (createGateway, gateway.ts) accepts a JSON-RPC POST at /mcp and
 * returns a single JSON response (202 for notifications), and also serves the
 * OAuth authorization-server endpoints so a remote client (claude.ai) can connect.
 * MCP 2026-07-28 uses per-request negotiation without protocol sessions.
 * This server returns JSON results and does not advertise subscriptions.
 *
 * Run standalone:  node services/mcp/src/http.ts   (PORT, default 8790)
 * This is the container/worker deployment path (owns the Tier-B browser pool).
 * The same gateway is wrapped by the Vercel function (vercel-entry.ts) for the
 * serverless "alongside Lolly" deployment. See services/ca for that shape and
 * plans/77-mcp-server.md section 5.
 */

import { pathToFileURL } from 'node:url';
import { createHttpLifecycle, createWriteTracker } from '../../shared/http-lifecycle.mjs';
import { createGateway } from './gateway.ts';
import { createLiveRelay } from './live-relay.ts';
import { browserJobStatus, closeBrowser, closeWebShell } from './render.ts';
import { createUsageBudget } from './usage-budget.ts';

/** @deprecated name kept for back-compat; the gateway now also serves OAuth. */
export const createMcpHttpHandler = createGateway;

export function startHttpServer(port = Number(process.env.PORT || 8790)): void {
  const writes = createWriteTracker();
  const budget = createUsageBudget(process.env, 'mcp', writes.begin);
  const handler = createGateway(process.env, { onWrite: writes.begin, budget });
  const relay = createLiveRelay();
  let dispose = (): void => {};
  const lifecycle = createHttpLifecycle({
    handler: async (req, res) => {
      if (!(await relay.handle(req, res))) await handler(req, res);
    },
    writes,
    queueStatus: browserJobStatus,
    flushAccounting: () => budget.record(0),
    beforeClose: async () => {
      dispose();
      await closeBrowser();
      await closeWebShell();
    },
  });
  dispose = relay.mount(lifecycle.server, () => !lifecycle.isDraining());
  lifecycle.installSignalHandlers();
  lifecycle.server.listen(port, process.env.LOLLY_MCP_BIND_HOST || '127.0.0.1', () => {
    process.stderr.write(`lolly-mcp (http) on http://localhost:${port}/mcp\n`);
    if (!process.env.LOLLY_WEB_BASE)
      process.stderr.write(
        '  note: LOLLY_WEB_BASE unset - Tier-B (browser) formats disabled; svg/data + resvg-png still work.\n'
      );
  });
}

// Run standalone when invoked directly.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) startHttpServer();
