// SPDX-License-Identifier: MPL-2.0
/**
 * The Node floor (packages/node-shell/src/node-patch-level.ts): which versions are
 * accepted, that every package states the same `engines.node` range, and that the CLI and
 * the MCP stdio server refuse an older Node before any work, on stderr, leaving stdout to
 * the CLI's JSON envelope and keeping the JSON-RPC channel empty.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { satisfiesRange } from '../engine/src/semver-range.ts';
import { NODE_ENGINES, nodeMeetsFloor, unsupportedNodeMessage } from '../packages/node-shell/src/node-patch-level.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const REFUSED = ['26.11.1', '26.12.0', '26.0.0', '25.9.0', '24.22.0', '24.21.0', '23.11.1', '22.23.3', '22.18.0', '20.19.0', 'v26.12.0'];
const ACCEPTED = ['26.12.1', '26.13.1', '24.22.1', '24.22.3', '24.23.0', '22.23.4', '22.23.5', '22.24.0', '27.0.0'];

test('each line is held to its own first fixed release, and lines without one are refused', () => {
  for (const version of REFUSED) {
    assert.equal(nodeMeetsFloor(version), false, version);
    assert.match(unsupportedNodeMessage(version) ?? '', /^Node \d+\.\d+\.\d+ is no longer accepted: its Brotli decoder has a flaw \(CVE-2026-111497\)\. Use Node 22\.23\.4 or later on Node 22, 24\.22\.1 or later on Node 24, or 26\.12\.1 or later\.$/, version);
  }
  for (const version of ACCEPTED) {
    assert.equal(nodeMeetsFloor(version), true, version);
    assert.equal(unsupportedNodeMessage(version), null, version);
  }
  assert.equal(unsupportedNodeMessage('not a version'), null);
});

test('the check and the engines range agree on every version tried', () => {
  for (const version of [...REFUSED, ...ACCEPTED]) {
    assert.equal(nodeMeetsFloor(version), satisfiesRange(version.replace(/^v/, ''), NODE_ENGINES), version);
  }
});

test('every package that runs Lolly on Node states the same engines range', () => {
  for (const file of ['package.json', 'services/mcp/package.json', 'services/ca/package.json']) {
    const pkg = JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')) as { engines?: { node?: string } };
    assert.equal(pkg.engines?.node, NODE_ENGINES, file);
  }
  // The published CLI's package.json is written by pack-cli from the same constant.
  assert.match(readFileSync(new URL('../scripts/pack-cli.ts', import.meta.url), 'utf8'), /engines: \{ node: NODE_ENGINES \}/);
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

test('the CLI refuses an older Node with exit 3, --version and --quiet included', () => {
  const cli = 'shells/cli/bin/lolly.ts';
  for (const extra of [[], ['--quiet']]) {
    const old = runAs('26.11.1', [cli, '--version', ...extra]);
    assert.equal(old.status, 3, old.stderr);
    assert.equal(old.stdout, '');
    assert.match(old.stderr, /^Error: Node 26\.11\.1 is no longer accepted: its Brotli decoder has a flaw \(CVE-2026-111497\)\./);
  }
  const current = runAs('26.12.1', [cli, '--version']);
  assert.equal(current.status, 0, current.stderr);
  assert.match(current.stdout, /^lolly \d+\.\d+\.\d+ \(engine \d+\.\d+\.\d+\)\n$/);
  assert.doesNotMatch(current.stderr, /CVE-2026-111497/);
});

test('under --json the CLI refusal is an envelope on stdout', () => {
  const run = runAs('22.23.3', ['shells/cli/bin/lolly.ts', 'list', '--json']);
  assert.equal(run.status, 3, run.stderr);
  const envelope = JSON.parse(run.stdout) as { ok?: boolean; error?: { kind?: string; message?: string } };
  assert.equal(envelope.ok, false);
  assert.equal(envelope.error?.kind, 'NODE_UNSUPPORTED');
  assert.match(envelope.error?.message ?? '', /Node 22\.23\.3 is no longer accepted/);
});

test('the MCP stdio server refuses an older Node and writes nothing to the JSON-RPC channel', () => {
  const request = `${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' })}\n`;
  const old = runAs('22.23.3', ['services/mcp/bin/lolly-mcp.ts'], request);
  assert.equal(old.status, 1);
  assert.equal(old.stdout, '');
  assert.match(old.stderr, /^lolly-mcp: Node 22\.23\.3 is no longer accepted: its Brotli decoder has a flaw \(CVE-2026-111497\)\./);
  const current = runAs('22.23.4', ['services/mcp/bin/lolly-mcp.ts'], request);
  assert.doesNotMatch(current.stderr, /CVE-2026-111497/);
  const replies = current.stdout.split('\n').filter(Boolean).map((line) => JSON.parse(line) as { jsonrpc?: string; id?: number });
  assert.deepEqual(replies.map((reply) => [reply.jsonrpc, reply.id]), [['2.0', 1]]);
});
