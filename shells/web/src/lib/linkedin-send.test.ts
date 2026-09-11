// SPDX-License-Identifier: MPL-2.0
/**
 * The LinkedIn driver (plans/129 WP4b) plus the two desktop un-gatings that
 * shipped beside it.
 *
 * Headless, like publish-send.test.ts: connections ride provider-connections'
 * memory-only mode, the network is a stubbed global fetch, and the authorize
 * leg is injected rather than bound - node is not a Tauri shell, which is also
 * what makes the "desktop only" assertion below meaningful.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/linkedin-send.test.ts
 */

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  LINKEDIN_DOCUMENT_MAX, LINKEDIN_LOOPBACK_PORTS, LINKEDIN_VERSION,
  connectLinkedIn, disconnectLinkedIn, linkedInAvailable, linkedinSendTarget, setLinkedInClient,
} from './linkedin-send.ts';
import { dropboxAvailable, dropboxSendTarget, setDropboxClientId } from './dropbox-send.ts';
import {
  oneDriveAvailable, oneDriveDesktopAvailable, oneDriveSendTarget,
  setOneDriveClientId, setOneDriveDesktopClientId,
} from './onedrive-send.ts';
import { cachedToken, getConnection, resetConnectionsForTests, saveConnection } from './provider-connections.ts';
import type { AuthorizeVia } from './provider-auth.ts';

const realFetch = globalThis.fetch;

beforeEach(() => resetConnectionsForTests());
afterEach(() => {
  resetConnectionsForTests();
  setLinkedInClient(null);
  setDropboxClientId(null);
  setOneDriveClientId(null);
  setOneDriveDesktopClientId(null);
  globalThis.fetch = realFetch;
});

interface Route { match: string; status?: number; json?: unknown; headers?: Record<string, string> }

/** One canned response per URL-substring, recorded as it is served. Unlike the
 *  publish-send harness this one can set response HEADERS, because LinkedIn
 *  returns the new post's URN in `x-restli-id` and nowhere else. */
function stubFetch(routes: Route[]) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const route = routes.find((r) => url.includes(r.match));
    if (!route) return new Response('not stubbed', { status: 500 });
    return new Response(JSON.stringify(route.json ?? {}), {
      status: route.status ?? 200,
      headers: { 'content-type': 'application/json', ...route.headers },
    });
  }) as typeof fetch;
  return calls;
}

/** The authorize leg a desktop connect would get from loopbackVia, with the
 *  registered port already chosen. */
const fakeVia = (port = LINKEDIN_LOOPBACK_PORTS[0]!): AuthorizeVia => ({
  redirectUri: `http://localhost:${port}/oauth-return`,
  async run(url: string) {
    const state = new URL(url).searchParams.get('state')!;
    return { hash: '', search: `code=thecode&state=${state}` };
  },
});

/** A connected LinkedIn member, as connect() leaves the store. */
async function connected(persist = true): Promise<void> {
  await saveConnection({
    kind: 'linkedin',
    account: 'Ada Lovelace',
    persist,
    config: { member: 'urn:li:person:ABC123', ...(persist ? { accessToken: 'tok' } : {}) },
    connectedAt: new Date().toISOString(),
  });
}

const headersOf = (init?: RequestInit): Record<string, string> =>
  (init?.headers ?? {}) as Record<string, string>;

// ── Config gate ──────────────────────────────────────────────────────────────

test('linkedin: dormant without BOTH halves of the client pair', () => {
  assert.equal(linkedInAvailable(), false, 'nothing configured');
  setLinkedInClient('client-id');
  assert.equal(linkedInAvailable(), false, 'an id with no secret cannot finish the exchange');
  setLinkedInClient('client-id', 'org-secret');
  assert.equal(linkedInAvailable(), true);
});

test('linkedin: the target stays unavailable off a Tauri shell, ids or no ids', async () => {
  setLinkedInClient('client-id', 'org-secret');
  await connected();
  // node is not a Tauri shell, so this is the web build's answer: no button,
  // because the secret cannot live in a page and api.linkedin.com answers no CORS.
  assert.equal(linkedinSendTarget().available(), false);
  assert.ok(linkedinSendTarget().formats!.includes('png'));
  assert.ok(linkedinSendTarget().formats!.includes('pdf'));
});

// ── Connect ──────────────────────────────────────────────────────────────────

test('linkedin: connect exchanges the code, names the member, and honours custody', async () => {
  setLinkedInClient('client-id', 'org-secret');
  const calls = stubFetch([
    { match: '/oauth/v2/accessToken', json: { access_token: 'tok', expires_in: 5_184_000 } },
    { match: '/v2/userinfo', json: { sub: 'ABC123', name: 'Ada Lovelace' } },
  ]);
  const account = await connectLinkedIn(true, fakeVia());
  assert.equal(account, 'Ada Lovelace');
  const conn = await getConnection('linkedin');
  assert.equal(conn?.config?.member, 'urn:li:person:ABC123', 'the author URN every post needs');
  assert.equal(conn?.config?.accessToken, 'tok', 'stay-connected keeps the token at rest');
  assert.equal(cachedToken('linkedin'), 'tok');
  const exchange = new URLSearchParams(String(calls[0]!.init?.body));
  assert.equal(exchange.get('client_secret'), 'org-secret');
  assert.equal(exchange.get('code_verifier'), null, 'PKCE is off for LinkedIn');
  assert.equal(exchange.get('redirect_uri'), `http://localhost:${LINKEDIN_LOOPBACK_PORTS[0]}/oauth-return`);
});

test('linkedin: session-only custody keeps the token out of the stored record', async () => {
  setLinkedInClient('client-id', 'org-secret');
  stubFetch([
    { match: '/oauth/v2/accessToken', json: { access_token: 'tok', expires_in: 5_184_000 } },
    { match: '/v2/userinfo', json: { sub: 'ABC123', name: 'Ada Lovelace' } },
  ]);
  await connectLinkedIn(false, fakeVia());
  const conn = await getConnection('linkedin');
  assert.equal(conn?.config?.accessToken, undefined, 'nothing at rest');
  assert.equal(cachedToken('linkedin'), 'tok', 'the session still holds it');
});

test('linkedin: a build with no client pair refuses to start a connect', async () => {
  await assert.rejects(() => connectLinkedIn(true, fakeVia()), /no LinkedIn app configured/);
});

test('linkedin: disconnect revokes best-effort with the client pair, then wipes', async () => {
  setLinkedInClient('client-id', 'org-secret');
  await connected();
  const calls = stubFetch([{ match: '/oauth/v2/revoke', json: {} }]);
  await disconnectLinkedIn();
  const revoke = new URLSearchParams(String(calls[0]!.init?.body));
  assert.equal(revoke.get('token'), 'tok');
  assert.equal(revoke.get('client_id'), 'client-id');
  assert.equal(await getConnection('linkedin'), null, 'the local wipe is the guarantee');
});

// ── Send ─────────────────────────────────────────────────────────────────────

test('linkedin: an image post initialises, PUTs the bytes, then posts with the versioned headers', async () => {
  await connected();
  const calls = stubFetch([
    {
      match: '/rest/images?action=initializeUpload',
      json: { value: { uploadUrl: 'https://upload.linkedin.example/img', image: 'urn:li:image:IMG1' } },
    },
    { match: 'upload.linkedin.example', status: 201 },
    { match: '/rest/posts', status: 201, headers: { 'x-restli-id': 'urn:li:share:7000' } },
  ]);
  const out = await linkedinSendTarget().send({
    bytes: new Uint8Array([1, 2, 3]), name: 'poster', format: 'png', mime: 'image/png',
  });
  assert.equal(out.url, 'https://www.linkedin.com/feed/update/urn:li:share:7000/');
  assert.equal(out.label, 'Posted to LinkedIn');

  const init = calls.find((c) => c.url.includes('initializeUpload'))!;
  assert.equal(headersOf(init.init)['LinkedIn-Version'], LINKEDIN_VERSION);
  assert.equal(headersOf(init.init)['X-Restli-Protocol-Version'], '2.0.0');
  assert.deepEqual(JSON.parse(String(init.init?.body)), {
    initializeUploadRequest: { owner: 'urn:li:person:ABC123' },
  });

  const put = calls.find((c) => c.url.includes('upload.linkedin.example'))!;
  assert.equal(put.init?.method, 'PUT');
  assert.equal(headersOf(put.init).Authorization, 'Bearer tok', 'the upload address is NOT pre-authenticated');
  assert.equal(headersOf(put.init)['Content-Type'], 'application/octet-stream');

  const post = calls.find((c) => c.url.endsWith('/rest/posts'))!;
  const body = JSON.parse(String(post.init?.body)) as Record<string, unknown>;
  assert.equal(body.author, 'urn:li:person:ABC123');
  assert.equal(body.commentary, 'poster');
  assert.equal(body.visibility, 'PUBLIC');
  assert.equal(body.lifecycleState, 'PUBLISHED');
  assert.deepEqual(body.content, { media: { id: 'urn:li:image:IMG1', altText: 'poster' } });
});

test('linkedin: a PDF goes down the documents path, titled rather than alt-texted', async () => {
  await connected();
  const calls = stubFetch([
    {
      match: '/rest/documents?action=initializeUpload',
      json: { value: { uploadUrl: 'https://upload.linkedin.example/doc', document: 'urn:li:document:DOC1' } },
    },
    { match: 'upload.linkedin.example', status: 201 },
    { match: '/rest/posts', status: 201, headers: { 'x-restli-id': 'urn:li:share:8000' } },
  ]);
  const out = await linkedinSendTarget().send({
    bytes: new Uint8Array([1]), name: 'deck', format: 'pdf', mime: 'application/pdf',
  });
  assert.equal(out.url, 'https://www.linkedin.com/feed/update/urn:li:share:8000/');
  const post = calls.find((c) => c.url.endsWith('/rest/posts'))!;
  const body = JSON.parse(String(post.init?.body)) as { content: unknown };
  assert.deepEqual(body.content, { media: { id: 'urn:li:document:DOC1', title: 'deck' } });
});

test('linkedin: a document over 100 MB is refused before any network', async () => {
  await connected();
  const calls = stubFetch([]);
  // Only byteLength is read before the check, so the cap is testable without
  // allocating a hundred megabytes to prove it.
  const bytes = { byteLength: LINKEDIN_DOCUMENT_MAX + 1 } as unknown as Uint8Array;
  await assert.rejects(
    () => linkedinSendTarget().send({ bytes, name: 'huge', format: 'pdf', mime: 'application/pdf' }),
    /100 MB/);
  assert.equal(calls.length, 0, 'no upload started');
});

test('linkedin: 401 and 403 become sentences a person can act on', async () => {
  await connected();
  stubFetch([{ match: '/rest/images', status: 401 }]);
  await assert.rejects(
    () => linkedinSendTarget().send({ bytes: new Uint8Array([1]), name: 'x', format: 'png', mime: 'image/png' }),
    /session ended - connect again in Profile/);
  stubFetch([{ match: '/rest/images', status: 403 }]);
  await assert.rejects(
    () => linkedinSendTarget().send({ bytes: new Uint8Array([1]), name: 'x', format: 'png', mime: 'image/png' }),
    /Share on LinkedIn/);
});

test('linkedin: with nothing connected, the send says where to fix it', async () => {
  await assert.rejects(
    () => linkedinSendTarget().send({ bytes: new Uint8Array([1]), name: 'x', format: 'png', mime: 'image/png' }),
    /Connect LinkedIn in Profile first/);
});

// ── The WP4b un-gatings, from the web shell's side ───────────────────────────

test('dropbox: the web target still gates on the app key alone', () => {
  assert.equal(dropboxAvailable(), false);
  assert.equal(dropboxSendTarget().available(), false, 'dormant with no id');
  setDropboxClientId('app-key');
  assert.equal(dropboxSendTarget().available(), true, 'and offered with one - on every shell now');
});

test('onedrive: the web target reads the SPA client, the desktop one its own', () => {
  assert.equal(oneDriveSendTarget().available(), false);
  setOneDriveDesktopClientId('desktop-app-id');
  assert.equal(oneDriveDesktopAvailable(), true);
  assert.equal(oneDriveSendTarget().available(), false, 'a desktop id alone changes nothing on the web');
  setOneDriveClientId('spa-app-id');
  assert.equal(oneDriveAvailable(), true);
  assert.equal(oneDriveSendTarget().available(), true);
});
