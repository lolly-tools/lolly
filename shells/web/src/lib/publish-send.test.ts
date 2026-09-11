// SPDX-License-Identifier: MPL-2.0
/**
 * Publish-tier send targets (plans/129 WP5) + the WP4 loopback authorize leg.
 *
 * Headless: connections ride provider-connections' memory-only mode (no IDB in
 * node), the network is a stubbed global fetch, and the loopback leg gets a
 * recording fake transport - the Rust side's contract (oauth_listen → port,
 * narrow Rust OAuth opener, oauth_wait → query string) is what the fake speaks.
 */

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { loopbackVia, codeGrant, pkceChallenge } from './provider-auth.ts';
import { parseWebhookUrl, testDiscord, connectDiscord, discordSendTarget } from './discord-send.ts';
import { BLUESKY_IMAGE_MAX, connectBluesky, blueskySendTarget } from './bluesky-send.ts';
import { parseServerUrl, mastodonSendTarget } from './mastodon-send.ts';
import { resetConnectionsForTests, saveConnection } from './provider-connections.ts';

const realFetch = globalThis.fetch;

beforeEach(() => resetConnectionsForTests());
afterEach(() => {
  resetConnectionsForTests();
  globalThis.fetch = realFetch;
});

/** One canned JSON response per URL-substring, recorded as it is served. */
function stubFetch(routes: Array<{ match: string; status?: number; json?: unknown }>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const route = routes.find(r => url.includes(r.match));
    if (!route) return new Response('not stubbed', { status: 500 });
    return new Response(JSON.stringify(route.json ?? {}), {
      status: route.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  return calls;
}

// ── WP4: the loopback authorize leg ──────────────────────────────────────────

test('loopbackVia: binds first, opens the system browser, hands back the query', async () => {
  const invokes: Array<{ cmd: string; args?: Record<string, unknown> }> = [];
  const via = await loopbackVia({
    async invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
      invokes.push({ cmd, args });
      if (cmd === 'oauth_listen') return 49152 as T;
      if (cmd === 'oauth_wait') return 'code=abc&state=xyz' as T;
      return undefined as T;
    },
  });
  assert.equal(via.redirectUri, 'http://127.0.0.1:49152/oauth-return');
  const ret = await via.run('https://provider.example/authorize?x=1');
  assert.equal(ret.search, 'code=abc&state=xyz');
  assert.deepEqual(invokes.map(i => i.cmd), ['oauth_listen', 'oauth_open', 'oauth_wait']);
  assert.equal(invokes[1]!.args?.raw, 'https://provider.example/authorize?x=1');
});

test('loopbackVia: the host and port options reach the Rust contract (WP4b)', async () => {
  const invokes: Array<{ cmd: string; args?: Record<string, unknown> }> = [];
  const transport = {
    async invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
      invokes.push({ cmd, args });
      if (cmd === 'oauth_listen') return ((args?.ports as number[] | undefined)?.[0] ?? 49152) as T;
      if (cmd === 'oauth_wait') return 'code=abc&state=xyz' as T;
      return undefined as T;
    },
  };
  // Dropbox/Microsoft shape: the literal host `localhost` (neither documents
  // 127.0.0.1 as acceptable), still an ephemeral port.
  const localhost = await loopbackVia(transport, { host: 'localhost' });
  assert.equal(localhost.redirectUri, 'http://localhost:49152/oauth-return');
  assert.equal(invokes[0]!.args, undefined, 'no list = the Rust side binds :0, exactly as before');
  // LinkedIn shape: a fixed list, because the redirect is matched exactly.
  const pinned = await loopbackVia(transport, { host: 'localhost', ports: [47811, 47812, 47813] });
  assert.equal(pinned.redirectUri, 'http://localhost:47811/oauth-return');
  assert.deepEqual(invokes[1]!.args, { ports: [47811, 47812, 47813] });
});

test('codeGrant through a via: redirect + PKCE + client_secret land in the exchange', async () => {
  let authorizeUrl = '';
  let exchangeBody: URLSearchParams | null = null;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    exchangeBody = new URLSearchParams(String(init?.body));
    return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600, refresh_token: 'ref' }), {
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  const set = await codeGrant({
    authorizeUrl: 'https://accounts.example/auth',
    tokenUrl: 'https://accounts.example/token',
    clientId: 'cid',
    clientSecret: 'shhh-but-not-really',
    scopes: 'files',
  }, undefined, {
    redirectUri: 'http://127.0.0.1:5000/oauth-return',
    async run(url: string) {
      authorizeUrl = url;
      const state = new URL(url).searchParams.get('state')!;
      return { hash: '', search: `code=thecode&state=${state}` };
    },
  });
  assert.equal(set.accessToken, 'tok');
  assert.equal(set.refreshToken, 'ref');
  const auth = new URL(authorizeUrl);
  assert.equal(auth.searchParams.get('redirect_uri'), 'http://127.0.0.1:5000/oauth-return');
  assert.equal(auth.searchParams.get('code_challenge_method'), 'S256');
  const body = exchangeBody!;
  assert.equal(body.get('code'), 'thecode');
  assert.equal(body.get('client_secret'), 'shhh-but-not-really');
  assert.equal(body.get('redirect_uri'), 'http://127.0.0.1:5000/oauth-return');
  // The verifier must actually match the challenge the authorize URL carried.
  assert.equal(await pkceChallenge(body.get('code_verifier')!), auth.searchParams.get('code_challenge'));
});

test('codeGrant with pkce:false sends no challenge and no verifier, but keeps the secret', async () => {
  // LinkedIn's shape: PKCE is partner-only there and the exchange is refused if
  // a verifier rides along, so the option must remove BOTH halves of it.
  let authorizeUrl = '';
  let exchangeBody: URLSearchParams | null = null;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    exchangeBody = new URLSearchParams(String(init?.body));
    return new Response(JSON.stringify({ access_token: 'tok', expires_in: 5_184_000 }), {
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  const set = await codeGrant({
    authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    clientId: 'cid',
    clientSecret: 'org-owned-secret',
    scopes: 'openid profile w_member_social',
    pkce: false,
  }, undefined, {
    redirectUri: 'http://localhost:47811/oauth-return',
    async run(url: string) {
      authorizeUrl = url;
      const state = new URL(url).searchParams.get('state')!;
      return { hash: '', search: `code=thecode&state=${state}` };
    },
  });
  assert.equal(set.accessToken, 'tok');
  const auth = new URL(authorizeUrl);
  assert.equal(auth.searchParams.get('code_challenge'), null, 'no challenge on the authorize URL');
  assert.equal(auth.searchParams.get('code_challenge_method'), null);
  const body = exchangeBody!;
  assert.equal(body.get('code_verifier'), null, 'and none in the exchange');
  assert.equal(body.get('client_secret'), 'org-owned-secret', 'which is what makes the secret necessary');
  assert.equal(body.get('redirect_uri'), 'http://localhost:47811/oauth-return');
});

// ── Discord ──────────────────────────────────────────────────────────────────

test('parseWebhookUrl: accepts real webhook URLs, refuses lookalikes', () => {
  assert.equal(
    parseWebhookUrl('https://discord.com/api/webhooks/123456/token-abc_DEF'),
    'https://discord.com/api/webhooks/123456/token-abc_DEF');
  assert.ok(parseWebhookUrl('https://discordapp.com/api/v10/webhooks/1/t'));
  assert.equal(parseWebhookUrl('http://discord.com/api/webhooks/1/t'), null, 'https only');
  assert.equal(parseWebhookUrl('https://evil.example/api/webhooks/1/t'), null);
  assert.equal(parseWebhookUrl('https://discord.com.evil.example/api/webhooks/1/t'), null);
  assert.equal(parseWebhookUrl('https://discord.com/api/webhooks/1/t/extra'), null);
});

test('discord: test names the hook; send posts multipart and returns the attachment url', async () => {
  const hook = 'https://discord.com/api/webhooks/42/tok';
  const calls = stubFetch([
    { match: '?wait=true', json: { attachments: [{ url: 'https://cdn.discordapp.com/a.png' }] } },
    { match: '/api/webhooks/42/tok', json: { name: 'exports' } },
  ]);
  const probe = await testDiscord(hook);
  assert.ok(probe.ok);
  assert.equal(probe.name, 'exports');
  await connectDiscord(hook, probe.name);
  const target = discordSendTarget();
  assert.ok(target.available());
  const out = await target.send({ bytes: new Uint8Array([1]), name: 'poster', format: 'png', mime: 'image/png' });
  assert.equal(out.url, 'https://cdn.discordapp.com/a.png');
  const post = calls.find(c => c.url.includes('?wait=true'))!;
  assert.ok(post.init?.body instanceof FormData);
});

test('discord: a 413 maps to the size sentence, not a raw status', async () => {
  await connectDiscord('https://discord.com/api/webhooks/42/tok');
  stubFetch([{ match: '?wait=true', status: 413 }]);
  await assert.rejects(
    () => discordSendTarget().send({ bytes: new Uint8Array([1]), name: 'x', format: 'png', mime: 'image/png' }),
    /larger than this Discord server/);
});

// ── Bluesky ──────────────────────────────────────────────────────────────────

test('bluesky: oversized images are refused before any upload', async () => {
  await connectBluesky({ service: 'https://bsky.social', identifier: 'me.bsky.social', appPassword: 'app-pass' });
  const calls = stubFetch([]);
  await assert.rejects(
    () => blueskySendTarget().send({
      bytes: new Uint8Array(BLUESKY_IMAGE_MAX + 1), name: 'big', format: 'png', mime: 'image/png',
    }),
    /1 MB/);
  assert.equal(calls.length, 0, 'no network before the size check');
});

test('bluesky: session → blob → post, with the profile URL assembled from the record uri', async () => {
  await connectBluesky({ service: 'https://bsky.social', identifier: 'me.bsky.social', appPassword: 'app-pass' });
  stubFetch([
    { match: 'createSession', json: { accessJwt: 'jwt', did: 'did:plc:me', handle: 'me.bsky.social' } },
    { match: 'uploadBlob', json: { blob: { ref: 'x' } } },
    { match: 'createRecord', json: { uri: 'at://did:plc:me/app.bsky.feed.post/3kabc' } },
  ]);
  const out = await blueskySendTarget().send({ bytes: new Uint8Array([1]), name: 'poster', format: 'png', mime: 'image/png' });
  assert.equal(out.url, 'https://bsky.app/profile/me.bsky.social/post/3kabc');
});

test('bluesky: formats stay image-shaped', () => {
  assert.ok(blueskySendTarget().formats!.includes('png'));
  assert.ok(!blueskySendTarget().formats!.includes('pdf'));
});

// ── Mastodon ─────────────────────────────────────────────────────────────────

test('parseServerUrl: normalises bare hosts, refuses non-https and hostless', () => {
  assert.equal(parseServerUrl('mastodon.social'), 'https://mastodon.social');
  assert.equal(parseServerUrl('https://fosstodon.org/'), 'https://fosstodon.org');
  assert.equal(parseServerUrl('http://mastodon.social'), null);
  assert.equal(parseServerUrl('localhost'), null);
  assert.equal(parseServerUrl(''), null);
});

test('mastodon: send uploads media then posts the status, returning its url', async () => {
  await saveConnection({
    kind: 'mastodon', account: '@me@mastodon.social', persist: true,
    config: { server: 'https://mastodon.social', accessToken: 'tok' },
    connectedAt: new Date().toISOString(),
  });
  const calls = stubFetch([
    { match: '/api/v2/media', json: { id: 'm1', url: 'https://files/m1.png' } },
    { match: '/api/v1/statuses', json: { url: 'https://mastodon.social/@me/111' } },
  ]);
  const target = mastodonSendTarget();
  assert.ok(target.available());
  const out = await target.send({ bytes: new Uint8Array([1]), name: 'poster', format: 'png', mime: 'image/png' });
  assert.equal(out.url, 'https://mastodon.social/@me/111');
  const post = calls.find(c => c.url.includes('/statuses'))!;
  const body = JSON.parse(String(post.init?.body)) as { media_ids: string[]; status: string };
  assert.deepEqual(body.media_ids, ['m1']);
});

test('mastodon: a dead session reads as connect-again, and 413 as a size sentence', async () => {
  await saveConnection({
    kind: 'mastodon', account: '@me@mastodon.social', persist: true,
    config: { server: 'https://mastodon.social', accessToken: 'tok' },
    connectedAt: new Date().toISOString(),
  });
  stubFetch([{ match: '/api/v2/media', status: 401 }]);
  await assert.rejects(
    () => mastodonSendTarget().send({ bytes: new Uint8Array([1]), name: 'x', format: 'png', mime: 'image/png' }),
    /connect again/);
  stubFetch([{ match: '/api/v2/media', status: 413 }]);
  await assert.rejects(
    () => mastodonSendTarget().send({ bytes: new Uint8Array([1]), name: 'x', format: 'png', mime: 'image/png' }),
    /larger than your Mastodon server/);
});
