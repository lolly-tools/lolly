// SPDX-License-Identifier: MPL-2.0
/**
 * The stateless OAuth authorization server (src/oauth.ts). Drives the full
 * claude.ai-style flow with no server socket: discovery → dynamic client
 * registration → authorize (passphrase) → token (PKCE) → access-token validation,
 * plus the refusal paths (bad passphrase, PKCE mismatch, expired code) and the
 * raw-shared-token back-compat the endpoint keeps for Claude Code.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizationServerMetadata, authorizeGet, authorizePost, isAuthorized,
  protectedResourceMetadata, register, token,
} from '../src/oauth.ts';
import { randomB64u, sha256B64u } from '../src/sign.ts';

const TOKEN = 'test-secret-token-xyz';
const env = { LOLLY_MCP_TOKEN: TOKEN } as unknown as NodeJS.ProcessEnv;
const REDIRECT = 'https://claude.ai/api/mcp/auth_callback';

test('discovery metadata is well-formed and absolute', () => {
  const pr = protectedResourceMetadata('https://lolly.tools').json as Record<string, unknown>;
  assert.equal(pr.resource, 'https://lolly.tools/api/mcp');
  assert.deepEqual(pr.authorization_servers, ['https://lolly.tools']);

  const as = authorizationServerMetadata('https://lolly.tools').json as Record<string, string[]>;
  assert.equal((as as unknown as { issuer: string }).issuer, 'https://lolly.tools');
  assert.equal((as as unknown as { authorization_endpoint: string }).authorization_endpoint, 'https://lolly.tools/api/mcp/authorize');
  assert.equal((as as unknown as { token_endpoint: string }).token_endpoint, 'https://lolly.tools/api/mcp/token');
  assert.deepEqual(as.code_challenge_methods_supported, ['S256']);
  assert.deepEqual(as.token_endpoint_auth_methods_supported, ['none']);
});

test('dynamic client registration rejects a bad redirect and issues a client for a good one', async () => {
  const bad = await register({ redirect_uris: ['http://evil.example/cb'] }, env);
  assert.equal(bad.status, 400);

  const ok = await register({ redirect_uris: [REDIRECT], client_name: 'Claude' }, env);
  assert.equal(ok.status, 201);
  const client = ok.json as { client_id: string; token_endpoint_auth_method: string };
  assert.ok(client.client_id, 'issues a client_id');
  assert.equal(client.token_endpoint_auth_method, 'none');
});

/** Register a client and return its id. */
async function newClientId(): Promise<string> {
  const r = await register({ redirect_uris: [REDIRECT] }, env);
  return (r.json as { client_id: string }).client_id;
}

test('full authorization-code + PKCE flow yields a usable access token', async () => {
  const clientId = await newClientId();
  const verifier = randomB64u(48);
  const challenge = await sha256B64u(verifier);
  const params = {
    response_type: 'code', client_id: clientId, redirect_uri: REDIRECT,
    code_challenge: challenge, code_challenge_method: 'S256', state: 'xyz123', scope: 'mcp',
  };

  // consent page renders
  const gp = await authorizeGet(params, env);
  assert.equal(gp.status, 200);
  assert.match(gp.html || '', /Access token/);

  // wrong passphrase is refused (re-renders the form, 401)
  const wrong = await authorizePost({ ...params, passphrase: 'nope' }, env);
  assert.equal(wrong.status, 401);
  assert.ok(!wrong.redirect, 'no code leaks on a bad passphrase');

  // correct passphrase → 302 back to the client with code+state
  const good = await authorizePost({ ...params, passphrase: TOKEN }, env);
  assert.equal(good.status, 302);
  const back = new URL(good.redirect!);
  assert.equal(back.origin + back.pathname, REDIRECT);
  assert.equal(back.searchParams.get('state'), 'xyz123');
  const code = back.searchParams.get('code')!;
  assert.ok(code);

  // token exchange with the WRONG verifier is refused
  const badPkce = await token({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, client_id: clientId, code_verifier: 'wrong' }, env);
  assert.equal(badPkce.status, 400);
  assert.equal((badPkce.json as { error: string }).error, 'invalid_grant');

  // token exchange with the right verifier → access + refresh
  const tok = await token({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, client_id: clientId, code_verifier: verifier }, env);
  assert.equal(tok.status, 200);
  const t = tok.json as { access_token: string; token_type: string; refresh_token: string; expires_in: number };
  assert.equal(t.token_type, 'Bearer');
  assert.ok(t.expires_in > 0);

  // the access token authorizes the MCP endpoint; the raw shared token still does too
  assert.equal(await isAuthorized(`Bearer ${t.access_token}`, env), true);
  assert.equal(await isAuthorized(`Bearer ${TOKEN}`, env), true);
  assert.equal(await isAuthorized('Bearer garbage', env), false);
  assert.equal(await isAuthorized(undefined, env), false);

  // refresh_token grant issues a fresh access token
  const refreshed = await token({ grant_type: 'refresh_token', refresh_token: t.refresh_token }, env);
  assert.equal(refreshed.status, 200);
  assert.ok((refreshed.json as { access_token: string }).access_token);
});

test('an expired authorization code is rejected', async () => {
  // Forge the flow but tamper time: mint a code, then advance Date past its 60s TTL.
  const clientId = await newClientId();
  const verifier = randomB64u(48);
  const challenge = await sha256B64u(verifier);
  const params = { response_type: 'code', client_id: clientId, redirect_uri: REDIRECT, code_challenge: challenge, code_challenge_method: 'S256' };
  const good = await authorizePost({ ...params, passphrase: TOKEN }, env);
  const code = new URL(good.redirect!).searchParams.get('code')!;

  const realNow = Date.now;
  Date.now = () => realNow() + 61_000; // 61s later
  try {
    const late = await token({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, client_id: clientId, code_verifier: verifier }, env);
    assert.equal(late.status, 400);
    assert.match((late.json as { error_description?: string }).error_description || '', /expired/);
  } finally {
    Date.now = realNow;
  }
});

test('fails CLOSED when no token is configured (no world-open endpoint)', async () => {
  const noEnv = {} as unknown as NodeJS.ProcessEnv;
  assert.equal(await isAuthorized(undefined, noEnv), false);
  assert.equal(await isAuthorized(`Bearer ${TOKEN}`, noEnv), false);
  assert.equal(await isAuthorized('Bearer anything', noEnv), false);
});

test('anonymous access only with the explicit LOLLY_MCP_ALLOW_ANONYMOUS opt-in', async () => {
  const anon = { LOLLY_MCP_ALLOW_ANONYMOUS: '1' } as unknown as NodeJS.ProcessEnv;
  assert.equal(await isAuthorized(undefined, anon), true);
  assert.equal(await isAuthorized('Bearer whatever', anon), true);
});

test('a redirect_uri not registered to the client is refused', async () => {
  const clientId = await newClientId();
  const bad = await authorizeGet({ response_type: 'code', client_id: clientId, redirect_uri: 'https://claude.ai/other', code_challenge: 'x', code_challenge_method: 'S256' }, env);
  assert.equal(bad.status, 400);
  assert.match(bad.html || '', /not registered/);
});
