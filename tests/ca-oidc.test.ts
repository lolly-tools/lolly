// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSign, generateKeyPairSync } from 'node:crypto';
import { buildAuthorizeUrl, fetchVerifiedEmail } from '../services/ca/lib/oidc.mjs';

const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...keys.publicKey.export({ format: 'jwk' }), kid: 'one', use: 'sig' };
const signed = (claims: Record<string, unknown>, kid = 'one'): string => {
  const data = [{ alg: 'RS256', kid }, claims].map(v => Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');
  return `${data}.${createSign('sha256').update(data).sign(keys.privateKey).toString('base64url')}`;
};
const args = { code: 'code', redirectUri: 'https://ca.example/api/ca/callback/suse', pkceVerifier: 'verifier', nonce: 'nonce' };

test('CA discovery, token validation, key rotation and enterprise email policy', async t => {
  const issuer = 'https://ca-test-issuer.example';
  const env: Record<string, string> = { SUSE_ISSUER: issuer, SUSE_CLIENT_ID: 'ca', SUSE_CLIENT_SECRET: 'secret' };
  const claims = { iss: issuer, sub: 'person', aud: 'ca', exp: Math.floor(Date.now() / 1000) + 300,
    iat: Math.floor(Date.now() / 1000), nonce: 'nonce', email: 'person@example.test', email_verified: true };
  let payload: Record<string, unknown> = claims, kid = 'one', jwksCalls = 0, method = 'client_secret_post';
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    assert.equal(init?.redirect, 'error'); assert.ok(init?.signal);
    if (url.endsWith('openid-configuration')) return Response.json({ issuer,
      authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`, jwks_uri: `${issuer}/jwks`,
      token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'] });
    if (url.endsWith('/jwks')) { jwksCalls++; return Response.json({ keys: [{ ...jwk, kid }] }); }
    if (url.endsWith('/token')) {
      const body = new URLSearchParams(String(init?.body));
      assert.equal(body.get('code_verifier'), 'verifier');
      if (method === 'client_secret_basic') { assert.match(new Headers(init?.headers).get('authorization') ?? '', /^Basic /); assert.equal(body.has('client_secret'), false); }
      else assert.equal(body.get('client_secret'), 'secret');
      return Response.json({ id_token: signed(payload, kid) });
    }
    throw new Error('unexpected URL');
  });
  assert.equal(await fetchVerifiedEmail('suse', env, args), claims.email);
  assert.equal(jwksCalls, 1);
  kid = 'two'; assert.equal(await fetchVerifiedEmail('suse', env, args), claims.email); assert.equal(jwksCalls, 2);
  for (const patch of [{ iat: undefined }, { iat: 'today' }, { iat: claims.iat + 400 }, { sub: undefined }, { aud: ['ca', 'other'] },
    { azp: 'other' }, { nonce: 'wrong' }, { iss: 'https://other.example' }, { exp: claims.iat - 1 }, { email_verified: false }, { email_verified: undefined }, { email_verified: 'true' }]) {
    payload = { ...claims, ...patch }; await assert.rejects(fetchVerifiedEmail('suse', env, args), JSON.stringify(patch));
  }
  payload = { ...claims, email_verified: undefined }; env.SUSE_EMAIL_VERIFICATION = 'trusted';
  assert.equal(await fetchVerifiedEmail('suse', env, args), claims.email);
  payload = { ...claims, email_verified: false }; await assert.rejects(fetchVerifiedEmail('suse', env, args));
  payload = claims; method = 'client_secret_basic'; env.SUSE_TOKEN_AUTH_METHOD = method;
  assert.equal(await fetchVerifiedEmail('suse', env, args), claims.email);
});

test('CA refuses a different discovered issuer before redirecting or exchanging credentials', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ issuer: 'https://wrong.example', authorization_endpoint: 'https://wrong.example/auth' }));
  await assert.rejects(buildAuthorizeUrl('suse', { SUSE_ISSUER: 'https://discovery-mismatch.example' },
    { ...args, state: 'state' }), /issuer mismatch/);
});

test('GitHub certificate identity must come from a verified email record', async t => {
  const paths: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    paths.push(String(input));
    return String(input).endsWith('/access_token') ? Response.json({ access_token: 'access' }) : Response.json([{ email: 'unverified@example.test', primary: true, verified: false }]);
  });
  await assert.rejects(fetchVerifiedEmail('github', { GITHUB_CLIENT_ID: 'id', GITHUB_CLIENT_SECRET: 'secret' }, args), /no verified email/);
  assert.equal(paths.some(p => p.endsWith('/user')), false);
});
