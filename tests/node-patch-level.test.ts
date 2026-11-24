// SPDX-License-Identifier: MPL-2.0
/**
 * The Node patch-level warning (packages/node-shell/src/node-patch-level.ts): which
 * versions get it, that it prints once, and that the CLI and the MCP stdio server put it
 * on stderr only, so neither the CLI's payload nor the JSON-RPC channel changes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { unpatchedNodeWarning, warnIfUnpatchedNode } from '../packages/node-shell/src/node-patch-level.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

test('each line is held to its own first fixed release', () => {
  for (const version of ['26.11.1', '26.0.0', '24.22.0', '24.21.0', '22.23.3', '22.18.0', 'v26.12.0']) {
    assert.match(unpatchedNodeWarning(version) ?? '', /^Warning: Node \d+\.\d+\.\d+ decodes Brotli with a flaw \(CVE-2026-111497\) fixed in Node \d+\.\d+\.\d+\./, version);
  }
  for (const version of ['26.12.1', '26.13.1', '24.22.1', '24.22.3', '22.23.4', '22.23.5', '27.0.0']) {
    assert.equal(unpatchedNodeWarning(version), null, version);
  }
  for (const version of ['25.9.0', '23.11.1', '20.19.0']) {
    assert.match(unpatchedNodeWarning(version) ?? '', /has no release with the Brotli fix/, version);
  }
  assert.equal(unpatchedNodeWarning('not a version'), null);
});

test('the warning is written once per process', () => {
  const key = Symbol.for('lolly.node-patch-level.warned');
  const flags = globalThis as unknown as Record<symbol, boolean | undefined>;
  delete flags[key];
  const lines: string[] = [];
  assert.equal(warnIfUnpatchedNode((line) => lines.push(line), '26.13.1'), false);
  assert.equal(warnIfUnpatchedNode((line) => lines.push(line), '26.11.1'), true);
  assert.equal(warnIfUnpatchedNode((line) => lines.push(line), '26.11.1'), false);
  assert.equal(lines.length, 1);
  delete flags[key];
});

/** Run a script under a Node that reports `version`, the way a preload can present one. */
function runAs(version: string, args: string[], input?: string): { status: number | null; stdout: string; stderr: string } {
  const preload = `data:text/javascript,Object.defineProperty(process.versions,'node',{value:${JSON.stringify(version)}})`;
  const run = spawnSync(process.execPath, ['--import', preload, ...args], {
    cwd: ROOT, encoding: 'utf8', input: input ?? '', timeout: 60_000,
    env: { ...process.env, NODE_OPTIONS: '' },
  });
  return { status: run.status, stdout: run.stdout, stderr: run.stderr };
}

test('the CLI warns on stderr, keeps stdout to its payload and stays quiet under --quiet', () => {
  const cli = 'shells/cli/bin/lolly.ts';
  const old = runAs('26.11.1', [cli, '--version']);
  assert.equal(old.status, 0, old.stderr);
  assert.doesNotMatch(old.stdout, /Warning/);
  assert.equal(old.stderr.split('\n').filter((line) => line.includes('CVE-2026-111497')).length, 1);
  const quiet = runAs('26.11.1', [cli, '--version', '--quiet']);
  assert.doesNotMatch(quiet.stderr, /CVE-2026-111497/);
  assert.equal(quiet.stdout, old.stdout);
  const current = runAs('26.12.1', [cli, '--version']);
  assert.doesNotMatch(current.stderr, /CVE-2026-111497/);
  assert.equal(current.stdout, old.stdout);
});

test('the MCP stdio server warns on stderr and leaves the JSON-RPC channel alone', () => {
  const request = `${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' })}\n`;
  const run = runAs('22.23.3', ['services/mcp/bin/lolly-mcp.ts'], request);
  assert.match(run.stderr, /Node 22\.23\.3 decodes Brotli with a flaw \(CVE-2026-111497\) fixed in Node 22\.23\.4/);
  const replies = run.stdout.split('\n').filter(Boolean).map((line) => JSON.parse(line) as { jsonrpc?: string; id?: number });
  assert.deepEqual(replies.map((reply) => [reply.jsonrpc, reply.id]), [['2.0', 1]]);
});
