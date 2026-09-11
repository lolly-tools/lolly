// SPDX-License-Identifier: MPL-2.0
/**
 * lib/google-drive.ts - the pure pieces (auth URL, return-fragment parsing,
 * multipart body) plus the upload/fallback decision tree over an injected
 * fetch. The interactive popup leg is browser-only and not covered here; the
 * token is seeded via seedDriveTokenForTests.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAuthUrl, parseOAuthReturn, buildMultipart,
  setDriveClientId, driveAvailable,
  sendEmfToDrive, seedDriveTokenForTests, resetDriveToken,
} from './google-drive.ts';

beforeEach(() => { setDriveClientId(null); resetDriveToken(); });

test('driveAvailable follows the configured client id (dormant without one)', () => {
  setDriveClientId('');
  assert.equal(driveAvailable(), false);
  setDriveClientId('abc.apps.googleusercontent.com');
  assert.equal(driveAvailable(), true);
});

test('buildAuthUrl carries the implicit-grant essentials', () => {
  const u = new URL(buildAuthUrl('client-1', 'state-xyz', 'https://app.example/oauth-return.html'));
  assert.equal(u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(u.searchParams.get('client_id'), 'client-1');
  assert.equal(u.searchParams.get('redirect_uri'), 'https://app.example/oauth-return.html');
  assert.equal(u.searchParams.get('response_type'), 'token');
  assert.equal(u.searchParams.get('scope'), 'https://www.googleapis.com/auth/drive.file');
  assert.equal(u.searchParams.get('state'), 'state-xyz');
});

test('parseOAuthReturn: happy path, default expiry, and every refusal', () => {
  const ok = parseOAuthReturn('#access_token=tok123&expires_in=1799&state=s1&token_type=Bearer', 's1');
  assert.deepEqual(ok, { token: 'tok123', expiresInS: 1799 });
  // Missing expires_in degrades to an hour, never NaN.
  assert.equal(parseOAuthReturn('#access_token=t&state=s1', 's1').expiresInS, 3600);
  assert.throws(() => parseOAuthReturn('#error=access_denied&state=s1', 's1'), /access_denied/);
  assert.throws(() => parseOAuthReturn('#access_token=t&state=WRONG', 's1'), /state mismatch/);
  assert.throws(() => parseOAuthReturn('#state=s1', 's1'), /no token/);
});

test('buildMultipart writes an RFC 2387 body: JSON part, typed bytes part, closing boundary', () => {
  const bytes = Uint8Array.from([1, 2, 3, 4]);
  const body = buildMultipart({ name: 'x', mimeType: 'application/vnd.google-apps.drawing' },
    'application/x-msmetafile', bytes, 'BOUND');
  const text = new TextDecoder().decode(body);
  const [head, rest] = text.split('\r\n\r\n{');
  assert.match(head!, /^--BOUND\r\nContent-Type: application\/json; charset=UTF-8$/);
  assert.match('{' + rest!, /"mimeType":"application\/vnd\.google-apps\.drawing"/);
  assert.match(text, /--BOUND\r\nContent-Type: application\/x-msmetafile\r\n\r\n/);
  assert.match(text, /\r\n--BOUND--\r\n$/);
  // The payload bytes ride verbatim between the second part header and the tail.
  const from = text.indexOf('application/x-msmetafile\r\n\r\n') + 'application/x-msmetafile\r\n\r\n'.length;
  assert.deepEqual([...body.slice(from, from + 4)], [1, 2, 3, 4]);
});

// A fetch stub that answers each call from a script of {status, json} steps and
// records what it was asked.
function scriptedFetch(steps: Array<{ status: number; json?: object; body?: string }>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init! });
    const step = steps.shift() ?? { status: 500, body: 'script exhausted' };
    return {
      ok: step.status >= 200 && step.status < 300,
      status: step.status,
      json: async () => step.json ?? {},
      text: async () => step.body ?? JSON.stringify(step.json ?? {}),
    } as Response;
  }) as typeof fetch;
  return { fn, calls };
}

test('sendEmfToDrive: a successful conversion reports the native Drawing', async () => {
  setDriveClientId('cid'); seedDriveTokenForTests('tok');
  const { fn, calls } = scriptedFetch([
    { status: 200, json: { id: 'f1', mimeType: 'application/vnd.google-apps.drawing', webViewLink: 'https://docs.google.com/drawings/d/f1' } },
  ]);
  const out = await sendEmfToDrive(Uint8Array.of(1), 'poster.emf', fn);
  assert.equal(out.converted, true);
  assert.equal(out.file.id, 'f1');
  assert.equal(calls.length, 1);
  assert.match(calls[0]!.url, /^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files\?uploadType=multipart/);
  assert.equal((calls[0]!.init.headers as Record<string, string>).Authorization, 'Bearer tok');
  // The .emf suffix is dropped from a Drawing's name.
  assert.match(new TextDecoder().decode(calls[0]!.init.body as Uint8Array), /"name":"poster"/);
});

test('sendEmfToDrive: an import refusal (4xx) falls back to a typed .emf file', async () => {
  setDriveClientId('cid'); seedDriveTokenForTests('tok');
  const { fn, calls } = scriptedFetch([
    { status: 400, body: 'cannotImportFile' },
    { status: 200, json: { id: 'f2', mimeType: 'application/x-msmetafile' } },
  ]);
  const out = await sendEmfToDrive(Uint8Array.of(1), 'poster', fn);
  assert.equal(out.converted, false);
  assert.equal(out.file.id, 'f2');
  assert.equal(calls.length, 2);
  const second = new TextDecoder().decode(calls[1]!.init.body as Uint8Array);
  assert.match(second, /"name":"poster\.emf"/);
  assert.match(second, /"mimeType":"application\/x-msmetafile"/);
});

test('sendEmfToDrive: a server error (5xx) surfaces instead of degrading', async () => {
  setDriveClientId('cid'); seedDriveTokenForTests('tok');
  const { fn, calls } = scriptedFetch([{ status: 503, body: 'backend' }]);
  await assert.rejects(() => sendEmfToDrive(Uint8Array.of(1), 'poster', fn), /503/);
  assert.equal(calls.length, 1, 'no silent fallback on a non-4xx failure');
});
