// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { test } from 'node:test';
import {
  BodyTooLargeError,
  clientIp,
  createGateway,
  OAUTH_BODY_MAX,
  publicOrigin,
  readBody,
} from '../src/gateway.ts';

test('hosted MCP requires a canonical HTTPS public origin', () => {
  assert.throws(() => publicOrigin({ VERCEL: '1' }), /PUBLIC_ORIGIN is required/);
  assert.throws(() => publicOrigin({ LOLLY_MCP_PUBLIC_ORIGIN: 'http://mcp.example.test' }), /must use https/);
  assert.throws(() => publicOrigin({ LOLLY_MCP_PUBLIC_ORIGIN: 'https://mcp.example.test/path' }), /only scheme/);
  assert.throws(() => publicOrigin({ LOLLY_MCP_PUBLIC_ORIGIN: 'https://user:pw@mcp.example.test' }), /only scheme/);
  assert.equal(publicOrigin({ LOLLY_MCP_PUBLIC_ORIGIN: 'https://mcp.example.test:8443' }), 'https://mcp.example.test:8443');
  assert.match(publicOrigin({ PORT: '9001' }), /^http:\/\/localhost:9001$/);
  assert.throws(() => publicOrigin({ PORT: '99999' }), /PORT must be an integer/);
});

test('client attribution ignores forwarded headers unless the socket peer is explicitly trusted', () => {
  const req = {
    headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' },
    socket: { remoteAddress: '10.0.0.8' },
  } as unknown as IncomingMessage;
  assert.equal(clientIp(req, {}), '10.0.0.8');
  assert.equal(clientIp(req, { LOLLY_MCP_TRUST_PROXY: '1', LOLLY_MCP_TRUSTED_PROXIES: '10.0.0.7' }), '10.0.0.8');
  assert.equal(clientIp(req, { LOLLY_MCP_TRUST_PROXY: '1', LOLLY_MCP_TRUSTED_PROXIES: '10.0.0.8' }), '203.0.113.9');
});

test('materialized request bodies receive the same byte cap as streams', async () => {
  const req = { headers: {}, body: 'x'.repeat(OAUTH_BODY_MAX + 1) } as unknown as IncomingMessage;
  await assert.rejects(readBody(req, OAUTH_BODY_MAX), BodyTooLargeError);
});

interface CapturedResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

async function drive(
  url: string,
  env: NodeJS.ProcessEnv,
  options: { method?: string; headers?: Record<string, string>; body?: unknown } = {},
): Promise<CapturedResponse> {
  const req = {
    method: options.method ?? 'GET',
    url,
    headers: { host: 'attacker.invalid', 'x-forwarded-proto': 'http', ...(options.headers ?? {}) },
    socket: { remoteAddress: '127.0.0.1' },
    ...(options.body === undefined ? {} : { body: options.body }),
  } as unknown as IncomingMessage;
  return new Promise((resolve, reject) => {
    const out: CapturedResponse = { status: 0, headers: {}, body: '' };
    const res = {
      writeHead(status: number, headers?: Record<string, string>) {
        out.status = status;
        out.headers = headers ?? {};
        return this;
      },
      end(body?: string | Buffer) {
        out.body = body === undefined ? '' : String(body);
        resolve(out);
      },
    } as unknown as ServerResponse;
    createGateway(env)(req, res).catch(reject);
  });
}

test('OAuth metadata and challenges use configured origin, never Host/Forwarded', async () => {
  const env = {
    LOLLY_MCP_TOKEN: 'test-token',
    LOLLY_MCP_PUBLIC_ORIGIN: 'https://mcp.example.test',
  } as NodeJS.ProcessEnv;
  const metadata = await drive('/.well-known/oauth-authorization-server', env);
  assert.equal(metadata.status, 200);
  assert.equal((JSON.parse(metadata.body) as { issuer: string }).issuer, 'https://mcp.example.test');
  assert.doesNotMatch(metadata.body, /attacker\.invalid/);

  const challenge = await drive('/api/mcp', env, { method: 'POST', body: '{}' });
  assert.equal(challenge.status, 401);
  assert.match(challenge.headers['www-authenticate'] ?? '', /https:\/\/mcp\.example\.test/);
  assert.doesNotMatch(challenge.headers['www-authenticate'] ?? '', /attacker\.invalid/);
});

test('oversized OAuth materialized bodies return 413', async () => {
  const env = {
    LOLLY_MCP_TOKEN: 'test-token',
    LOLLY_MCP_PUBLIC_ORIGIN: 'https://mcp.example.test',
  } as NodeJS.ProcessEnv;
  const response = await drive('/api/mcp/register', env, {
    method: 'POST',
    body: 'x'.repeat(OAUTH_BODY_MAX + 1),
  });
  assert.equal(response.status, 413);
  assert.match(response.body, /request_too_large/);
});
