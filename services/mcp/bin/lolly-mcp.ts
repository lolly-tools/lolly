#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * stdio MCP transport. For local clients (Claude Desktop, Claude Code, the MCP
 * inspector). Reads newline-delimited JSON-RPC from stdin, writes responses to
 * stdout; all logging goes to stderr (stdout is the protocol channel).
 *
 *   claude mcp add lolly -- node /path/to/lolly/services/mcp/bin/lolly-mcp.ts
 */

import { dispatch } from '../src/server.ts';
import { LiveBridge } from '../src/live-bridge.ts';
import type { JsonRpcRequest } from '../src/protocol.ts';

// The live tools (plans/289 D1) exist only here: this process runs on the person's
// machine, so it can reach their open editor. The name the client gave in initialize
// is what the editor's connected pill shows.
let clientName = '';
const live = new LiveBridge({ clientName: () => clientName, log: (line) => process.stderr.write(`${line}\n`) });

let buffer = '';
const pending = new Set<Promise<void>>();
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk: string) => {
  buffer += chunk;
  if (Buffer.byteLength(buffer, 'utf8') > 32 * 1024 * 1024) { process.stderr.write('MCP input exceeds 32 MiB\n'); process.exit(1); }
  let nl: number;
  while ((nl = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (line) { const work = handleLine(line).finally(() => pending.delete(work)); pending.add(work); }
  }
});
process.stdin.on('end', async () => {
  if (buffer.trim()) await handleLine(buffer.trim());
  await Promise.allSettled(pending);
  live.close();
  const { closeBrowser, closeWebShell } = await import('../src/render.ts');
  await closeBrowser(); await closeWebShell();
  process.stdout.write('', () => process.exit(0));
});

async function handleLine(line: string): Promise<void> {
  let req: JsonRpcRequest;
  try {
    req = JSON.parse(line) as JsonRpcRequest;
  } catch {
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n');
    return;
  }
  if (req.method === 'initialize') {
    const info = (req.params as { clientInfo?: { name?: unknown } } | undefined)?.clientInfo;
    if (typeof info?.name === 'string') clientName = info.name.slice(0, 60);
  }
  const res = await dispatch(req, { fileScope: 'local-stdio', live });
  if (res) process.stdout.write(JSON.stringify(res) + '\n');
}

process.stderr.write('lolly-mcp (stdio) ready\n');
