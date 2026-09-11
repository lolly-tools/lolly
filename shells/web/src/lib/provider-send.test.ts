// SPDX-License-Identifier: MPL-2.0
/**
 * The pure halves of the personal send-target providers (plans/129): PKCE
 * against the RFC 7636 vector, the SigV4 signer cross-checked against an
 * independent node:crypto reimplementation, the Dropbox ASCII header rule,
 * Graph upload-session chunk maths, WebDAV URL building, and the custody
 * semantics of the connections store (memory-only mode - no IndexedDB here).
 * Networks and popups appear nowhere in this file; the interactive flows are
 * covered by the severed-popup browser harness (plans/127's, extended).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, createHash } from 'node:crypto';

import { pkceChallenge, parseCodeReturn, tokenSetFrom } from './provider-auth.ts';
import { deriveSigningKey, sigV4Headers, encodeS3Key, amzDates } from './s3-send.ts';
import { dropboxApiArg } from './dropbox-send.ts';
import { uploadChunkRanges, GRAPH_CHUNK_BYTES, GRAPH_SIMPLE_UPLOAD_MAX } from './onedrive-send.ts';
import { davUrl } from './nextcloud-send.ts';
import {
  saveConnection, getConnection, removeConnection, hasConnection,
  cacheToken, cachedToken, resetConnectionsForTests,
} from './provider-connections.ts';

// ── PKCE ──────────────────────────────────────────────────────────────────────

test('pkceChallenge matches the RFC 7636 appendix B vector', async () => {
  assert.equal(
    await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),
    'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  );
});

test('parseCodeReturn validates state and surfaces provider errors', () => {
  assert.equal(parseCodeReturn('?code=abc&state=s1', 's1'), 'abc');
  assert.throws(() => parseCodeReturn('?code=abc&state=WRONG', 's1'), /state mismatch/);
  assert.throws(() => parseCodeReturn('?error=access_denied&state=s1', 's1'), /access_denied/);
  assert.throws(() => parseCodeReturn('?state=s1', 's1'), /no code/);
});

test('tokenSetFrom keeps the refresh token and expires a minute early', () => {
  const before = Date.now();
  const set = tokenSetFrom({ access_token: 'A', refresh_token: 'R', expires_in: 3600 });
  assert.equal(set.accessToken, 'A');
  assert.equal(set.refreshToken, 'R');
  assert.ok(set.expiresAt >= before + 3539_000 && set.expiresAt <= Date.now() + 3540_000);
  assert.ok(!('refreshToken' in tokenSetFrom({ access_token: 'A' })), 'no refresh key when none granted');
  assert.throws(() => tokenSetFrom({}), /no token/);
});

// ── SigV4 ─────────────────────────────────────────────────────────────────────

/** Independent SigV4 built on node:crypto - a cross-implementation check of
 *  the WebCrypto signer (chaining order, encodings, canonical layout). */
function nodeSigningKey(secret: string, date: string, region: string, service: string): Buffer {
  const h = (key: Buffer | string, data: string) => createHmac('sha256', key).update(data).digest();
  return h(h(h(h(`AWS4${secret}`, date), region), service), 'aws4_request');
}

test('deriveSigningKey agrees with an independent node:crypto implementation', async () => {
  const key = await deriveSigningKey('wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY', '20150830', 'us-east-1', 'iam');
  const expected = nodeSigningKey('wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY', '20150830', 'us-east-1', 'iam');
  assert.equal(Buffer.from(key).toString('hex'), expected.toString('hex'));
});

test('sigV4Headers signs a PUT the way an independent signer does', async () => {
  const cfg = { region: 'eu-central-1', accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'shhh' };
  const when = new Date('2026-08-19T12:00:00Z');
  const url = new URL('https://s3.eu-central-1.amazonaws.com/my-bucket/lolly/chart%201.png');
  const payloadHash = createHash('sha256').update('bytes').digest('hex');
  const got = await sigV4Headers(cfg, 'PUT', url, payloadHash, 'image/png', when);

  // Reassemble with node:crypto.
  const [amzDate, date] = amzDates(when);
  const headers: Record<string, string> = {
    'content-type': 'image/png', host: url.host,
    'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate,
  };
  const names = Object.keys(headers).sort();
  const canonical = [
    'PUT', url.pathname, '',
    names.map((n) => `${n}:${headers[n]}\n`).join(''),
    names.join(';'), payloadHash,
  ].join('\n');
  const scope = `${date}/eu-central-1/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, createHash('sha256').update(canonical).digest('hex')].join('\n');
  const sig = createHmac('sha256', nodeSigningKey('shhh', date, 'eu-central-1', 's3')).update(stringToSign).digest('hex');

  assert.equal(got.Authorization,
    `AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/${scope}, SignedHeaders=${names.join(';')}, Signature=${sig}`);
  assert.equal(got['x-amz-date'], amzDate);
  assert.ok(!('host' in got), 'host participates in the signature but fetch sets it itself');
});

test('encodeS3Key percent-encodes segments and keeps slashes', () => {
  assert.equal(encodeS3Key('lolly/chart 1.png'), 'lolly/chart%201.png');
  assert.equal(encodeS3Key("a!'()*b/ü.png"), 'a%21%27%28%29%2Ab/%C3%BC.png');
});

test('amzDates renders the ISO-basic pair', () => {
  const [amz, date] = amzDates(new Date('2026-08-19T09:05:07.123Z'));
  assert.equal(amz, '20260819T090507Z');
  assert.equal(date, '20260819');
});

// ── Dropbox ───────────────────────────────────────────────────────────────────

test('Dropbox-API-Arg JSON is pure ASCII whatever the filename', () => {
  const arg = dropboxApiArg({ path: '/gráfico - ñandú.png', mode: 'add' });
  assert.ok(/^[\x20-\x7e]+$/.test(arg), `non-ASCII survived: ${arg}`);
  assert.deepEqual(JSON.parse(arg), { path: '/gráfico - ñandú.png', mode: 'add' });
});

// ── OneDrive upload sessions ──────────────────────────────────────────────────

test('uploadChunkRanges covers the bytes exactly with Graph-legal chunks', () => {
  assert.equal(GRAPH_CHUNK_BYTES % (320 * 1024), 0, 'chunk must be a multiple of 320 KiB');
  const total = GRAPH_SIMPLE_UPLOAD_MAX * 3 + 12345;
  const ranges = uploadChunkRanges(total);
  assert.equal(ranges[0]!.start, 0);
  assert.equal(ranges.at(-1)!.end, total);
  for (let i = 1; i < ranges.length; i++) assert.equal(ranges[i]!.start, ranges[i - 1]!.end, 'contiguous');
  assert.equal(ranges[0]!.range, `bytes 0-${GRAPH_CHUNK_BYTES - 1}/${total}`);
  assert.deepEqual(uploadChunkRanges(10, 4).map(r => r.range), ['bytes 0-3/10', 'bytes 4-7/10', 'bytes 8-9/10']);
});

// ── WebDAV ────────────────────────────────────────────────────────────────────

test('davUrl encodes user and path segments against the files DAV root', () => {
  const cfg = { baseUrl: 'https://cloud.example.org/', username: 'andy fitz', appPassword: 'x' };
  assert.equal(
    davUrl(cfg, 'Lolly/chart 1.png'),
    'https://cloud.example.org/remote.php/dav/files/andy%20fitz/Lolly/chart%201.png',
  );
});

// ── Custody (memory-only mode - no IndexedDB in node) ─────────────────────────

describe('provider-connections custody', () => {
  test('session-only records live in memory; persist is an explicit choice', async () => {
    resetConnectionsForTests();
    await saveConnection({ kind: 'dropbox', account: 'a@b.c', persist: false, connectedAt: 'now' });
    assert.ok(hasConnection('dropbox'));
    assert.equal((await getConnection('dropbox'))?.refreshToken, undefined);
    await saveConnection({ kind: 'dropbox', account: 'a@b.c', persist: true, refreshToken: 'R', connectedAt: 'now' });
    assert.equal((await getConnection('dropbox'))?.refreshToken, 'R');
    await removeConnection('dropbox');
    assert.ok(!hasConnection('dropbox'));
    assert.equal(await getConnection('dropbox'), null);
  });

  test('a bring-your-own Dropbox app key makes the target available', async () => {
    const { dropboxAvailable, dropboxClientId, setDropboxClientId } = await import('./dropbox-send.ts');
    resetConnectionsForTests();
    assert.ok(!dropboxAvailable(), 'dormant with no deploy id and no connection');
    await saveConnection({ kind: 'dropbox', account: 'a@b.c', persist: false, config: { clientId: 'user-key' }, connectedAt: 'now' });
    assert.equal(dropboxClientId(), 'user-key', 'the saved key is the client id');
    assert.ok(dropboxAvailable());
    setDropboxClientId('instance-key');
    assert.equal(dropboxClientId(), 'instance-key', 'an instance override still wins');
    setDropboxClientId(null);
    resetConnectionsForTests();
  });

  test('token cache honours expiry and disconnect', async () => {
    resetConnectionsForTests();
    cacheToken('o365', 'T', Date.now() + 60_000);
    assert.equal(cachedToken('o365'), 'T');
    cacheToken('o365', 'T2', Date.now() - 1);
    assert.equal(cachedToken('o365'), null, 'an expired token never comes back');
    cacheToken('o365', 'T3', Date.now() + 60_000);
    await removeConnection('o365');
    assert.equal(cachedToken('o365'), null, 'disconnect drops the cached token');
  });
});
