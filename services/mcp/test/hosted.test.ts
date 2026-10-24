// SPDX-License-Identifier: MPL-2.0
/**
 * What makes this server hosted, the size settings a hosted server reads
 * (src/hosted.ts), the Vercel adapter that states its platform's limits as those
 * settings (src/vercel-platform.ts), the browser tier test lolly_check uses to
 * choose its render hook, and the gateway applying the request and response
 * limits to a hosted server only.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  HOSTED_MAX_IMAGE_BYTES,
  HOSTED_REQUEST_MAX_BYTES,
  HOSTED_RESPONSE_MAX_BYTES,
  hostedDeployment,
  hostedMaxImageBytes,
  hostedRequestMaxBytes,
  hostedResponseMaxBytes,
  isHostedServer,
} from '../src/hosted.ts';
import { browserInstalled, browserTierAvailable } from '../src/render.ts';
import { createGateway } from '../src/gateway.ts';

test('a deployment is hosted by its own flags or a public origin, never by the platform it runs on', () => {
  for (const env of [{ LOLLY_MCP_HOSTED: '1' }, { NODE_ENV: 'production' }]) {
    assert.equal(hostedDeployment(env), true, JSON.stringify(env));
    assert.equal(isHostedServer(env), true, JSON.stringify(env));
  }
  assert.equal(hostedDeployment({ VERCEL: '1' }), false);
  assert.equal(isHostedServer({ VERCEL: '1' }), false, 'VERCEL alone is not a hosted signal');
  // A public origin other machines can reach makes the server hosted for its limits,
  // but not for the deployment flags the rate limiter and the budget read.
  assert.equal(isHostedServer({ LOLLY_MCP_PUBLIC_ORIGIN: 'https://mcp.example.test' }), true);
  assert.equal(hostedDeployment({ LOLLY_MCP_PUBLIC_ORIGIN: 'https://mcp.example.test' }), false);
  assert.equal(isHostedServer({ LOLLY_MCP_PUBLIC_ORIGIN: 'http://127.0.0.1:8790' }), false);
  assert.equal(isHostedServer({}), false);
});

test('the size settings read whole numbers of bytes and keep the default otherwise', () => {
  assert.equal(hostedRequestMaxBytes({}), HOSTED_REQUEST_MAX_BYTES);
  assert.equal(hostedResponseMaxBytes({}), HOSTED_RESPONSE_MAX_BYTES);
  assert.equal(hostedMaxImageBytes({}), HOSTED_MAX_IMAGE_BYTES);
  assert.equal(hostedRequestMaxBytes({ LOLLY_MCP_REQUEST_MAX_BYTES: '33554432' }), 33_554_432);
  assert.equal(hostedResponseMaxBytes({ LOLLY_MCP_RESPONSE_MAX_BYTES: ' 16000000 ' }), 16_000_000);
  assert.equal(hostedMaxImageBytes({ LOLLY_MCP_MAX_IMAGE_BYTES: '8388608' }), 8_388_608);
  for (const bad of ['0', '-1', '4MB', '1.5', '1e6', 'lots']) {
    assert.equal(hostedRequestMaxBytes({ LOLLY_MCP_REQUEST_MAX_BYTES: bad }), HOSTED_REQUEST_MAX_BYTES, bad);
  }
});

test('the Vercel function states its platform limits as settings before the gateway loads, and a project value wins', async () => {
  const keys = ['LOLLY_MCP_HOSTED', 'LOLLY_MCP_REQUEST_MAX_BYTES', 'LOLLY_MCP_RESPONSE_MAX_BYTES', 'LOLLY_MCP_MAX_IMAGE_BYTES'] as const;
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    process.env.LOLLY_MCP_RESPONSE_MAX_BYTES = '1234567';
    await import('../src/vercel-platform.ts');
    assert.equal(isHostedServer(), true);
    assert.equal(hostedRequestMaxBytes(), 4_500_000);
    assert.equal(hostedResponseMaxBytes(), 1_234_567);
    assert.equal(hostedMaxImageBytes(), 4 * 1024 * 1024);
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
  const entry = readFileSync(new URL('../src/vercel-entry.ts', import.meta.url), 'utf8');
  const imports = entry.split('\n').filter((line) => line.startsWith('import '));
  assert.equal(imports[0], "import './vercel-platform.ts';", 'the platform settings are the first module the entry loads');
  // The committed bundle keeps that order: the settings run before the gateway is defined.
  const bundle = readFileSync(new URL('../../../api/mcp/[...path].js', import.meta.url), 'utf8');
  const settings = bundle.indexOf('process.env.LOLLY_MCP_HOSTED ??=');
  assert.ok(settings >= 0, 'the bundle carries the Vercel platform settings');
  assert.ok(settings < bundle.indexOf('function createGateway('), 'the settings come before the gateway');
});

test('the browser tier is found where a browser and a web shell are, and nowhere else', async () => {
  // A file that exists, standing in for a browser binary.
  const there = process.execPath;
  const missing = '/nonexistent/chromium';
  assert.equal(await browserInstalled({ LOLLY_BROWSER_PATH: there }), true);
  assert.equal(await browserInstalled({ LOLLY_BROWSER_PATH: missing }), false);
  assert.equal(await browserTierAvailable({ LOLLY_BROWSER_PATH: there, LOLLY_WEB_BASE: 'https://lolly.example' }), true);
  assert.equal(await browserTierAvailable({ LOLLY_BROWSER_PATH: missing, LOLLY_WEB_BASE: 'https://lolly.example' }), false, 'no browser to open');
  // The charts set LOLLY_WEB_BASE to an empty string when no shell is named.
  assert.equal(await browserTierAvailable({ LOLLY_BROWSER_PATH: there, LOLLY_WEB_BASE: '', LOLLY_WEB_DIST: '/nonexistent/dist' }), false, 'no web shell to drive');
});

interface Captured { status: number; body: string }

function post(env: NodeJS.ProcessEnv, body: unknown): Promise<Captured> {
  const req = {
    method: 'POST',
    url: '/api/mcp',
    headers: { 'content-type': 'application/json' },
    socket: { remoteAddress: '127.0.0.1' },
    body: JSON.stringify(body),
  } as unknown as IncomingMessage;
  return new Promise((resolve, reject) => {
    const out: Captured = { status: 0, body: '' };
    const res = {
      writeHead(status: number) { out.status = status; return this; },
      end(chunk?: string | Buffer) { out.body = chunk === undefined ? '' : String(chunk); resolve(out); },
    } as unknown as ServerResponse;
    createGateway(env)(req, res).catch(reject);
  });
}

const LOCAL = { LOLLY_MCP_ALLOW_ANONYMOUS: '1' } as NodeJS.ProcessEnv;
const HOSTED = {
  LOLLY_MCP_HOSTED: '1',
  LOLLY_MCP_ALLOW_ANONYMOUS: '1',
  LOLLY_MCP_PUBLIC_ORIGIN: 'https://mcp.example.test',
  LOLLY_ALLOW_IN_MEMORY_RATE_LIMIT: '1',
} as NodeJS.ProcessEnv;
const init = (name = 't') => ({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name, version: '1' } } });

test('a hosted gateway reads requests up to LOLLY_MCP_REQUEST_MAX_BYTES; a local one keeps its own room', async () => {
  const padded = init('x'.repeat(4000));
  const refused = await post({ ...HOSTED, LOLLY_MCP_REQUEST_MAX_BYTES: '2000' }, padded);
  assert.equal(refused.status, 413);
  assert.match(refused.body, /Request body too large/);
  assert.equal((await post(HOSTED, padded)).status, 200, 'the default takes the same request');
  assert.equal((await post({ ...LOCAL, LOLLY_MCP_REQUEST_MAX_BYTES: '2000' }, padded)).status, 200, 'a local server reads none of the settings');
});

test('a hosted gateway answers up to LOLLY_MCP_RESPONSE_MAX_BYTES and says so past it; a local one sends any size', async () => {
  const roomy = await post(HOSTED, init());
  assert.equal(roomy.status, 200);
  assert.match(roomy.body, /"result"/);
  const limit = Buffer.byteLength(roomy.body) - 1;
  const replaced = await post({ ...HOSTED, LOLLY_MCP_RESPONSE_MAX_BYTES: String(limit) }, init());
  const answer = JSON.parse(replaced.body) as { result?: unknown; error?: { message: string } };
  assert.equal(answer.result, undefined);
  assert.match(answer.error?.message ?? '', /this hosted endpoint can return/);
  const local = await post({ ...LOCAL, LOLLY_MCP_RESPONSE_MAX_BYTES: String(limit) }, init());
  assert.match(local.body, /"result"/);
});
