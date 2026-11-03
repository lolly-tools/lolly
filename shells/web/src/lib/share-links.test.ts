// SPDX-License-Identifier: MPL-2.0
/**
 * Share links after Send: the seam, the shared orchestration, and each provider's
 * request shapes against a simulated fetch. No network, no real credentials; the
 * request shapes follow the providers' published API references.
 */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, createHash } from 'node:crypto';

import {
  ShareRefusedError, ShareUnavailableError, canShare, registerSendTarget, unregisterSendTarget,
  type SendTarget, type ShareCapabilities,
} from './send-target.ts';
import {
  checkShareOptions, createShareLink, listSharedLinks, narrowerAudiences, stopSharing, canStopSharing,
  resetSharedLinksForTests, shareUnavailable, isExpired, expiryFromDays,
} from './share-links.ts';
import { overrideFlagInMemory, SHARE_LINK_FLAGS, shareLinksEnabled } from '../feature-flags.ts';
import { driveShare, driveRevoke, driveShareCapabilities } from './google-drive.ts';
import { seedDriveTokenForTests } from './google-drive.ts';
import { ocsShareBody, nextcloudShare, nextcloudRevoke } from './nextcloud-send.ts';
import { presignGetUrl, s3Share, s3ShareCapabilities, amzDates } from './s3-send.ts';
import { dropboxShare, dropboxRevoke } from './dropbox-send.ts';
import { oneDriveShare, oneDriveRevoke, oneDriveShareCapabilities } from './onedrive-send.ts';
import { saveConnection, cacheToken, resetConnectionsForTests } from './provider-connections.ts';

interface Call { url: string; method: string; headers: Record<string, string>; body: string }
function sim(replies: Array<Response | ((c: Call) => Response)>): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const f = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const call: Call = {
      url: String(input), method: init.method ?? 'GET',
      headers: Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>)),
      body: typeof init.body === 'string' ? init.body : '',
    };
    calls.push(call);
    const next = replies.shift();
    if (!next) throw new Error(`unexpected request ${call.method} ${call.url}`);
    return typeof next === 'function' ? next(call) : next;
  }) as typeof fetch;
  return { fetch: f, calls };
}
const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => { resetSharedLinksForTests(); resetConnectionsForTests(); });

// ── Pure rules ────────────────────────────────────────────────────────────────

describe('share rules', () => {
  const caps: ShareCapabilities = { audiences: ['anyone', 'organisation'], password: false, expiry: true, maxExpiryDays: 30, revocable: true };

  test('narrowerAudiences lists only supported audiences below the refused one', () => {
    assert.deepEqual(narrowerAudiences(caps, 'anyone'), ['organisation']);
    assert.deepEqual(narrowerAudiences(caps, 'organisation'), []);
    assert.deepEqual(narrowerAudiences({ ...caps, audiences: ['anyone', 'organisation', 'people'] }, 'anyone'), ['organisation', 'people']);
  });

  test('checkShareOptions refuses what the provider cannot do, before any request', () => {
    assert.equal(checkShareOptions(caps, { audience: 'anyone', expiresInDays: 7 }), null);
    assert.match(checkShareOptions(caps, { audience: 'people', people: ['a@b.c'] })!, /cannot make that kind/);
    assert.match(checkShareOptions(caps, { audience: 'anyone', password: 'x' })!, /password/);
    assert.match(checkShareOptions(caps, { audience: 'anyone', expiresInDays: 31 })!, /at most 30/);
    assert.match(checkShareOptions({ ...caps, audiences: ['people'] }, { audience: 'people' })!, /email/);
    assert.match(checkShareOptions({ ...caps, expiryRequired: true }, { audience: 'anyone' })!, /stop working/);
  });

  test('the per-kind switch defaults on and follows the flag', () => {
    for (const f of SHARE_LINK_FLAGS) assert.equal(f.id, `share-${f.connector}`);
    assert.equal(shareLinksEnabled('gdrive'), true);
    overrideFlagInMemory('share-gdrive', false);
    assert.equal(shareLinksEnabled('gdrive'), false);
    overrideFlagInMemory('share-gdrive', true);
    assert.equal(shareLinksEnabled('penpot'), true, 'a kind with no switch is not gated');
  });

  test('expiry helpers', () => {
    assert.equal(expiryFromDays(2, Date.parse('2026-01-01T00:00:00Z')), '2026-01-03T00:00:00.000Z');
    assert.ok(isExpired({ expiresAt: '2000-01-01T00:00:00Z' }));
    assert.ok(!isExpired({}));
  });
});

// ── Orchestration ─────────────────────────────────────────────────────────────

describe('createShareLink', () => {
  const mk = (over: Partial<SendTarget> = {}): SendTarget => ({
    kind: 'gdrive', label: 'Drive', available: () => true, send: async () => ({ label: 'ok' }),
    shareCapabilities: () => ({ audiences: ['anyone', 'organisation'], password: false, expiry: false, revocable: true }),
    share: async (_ref, o) => ({ url: 'https://x/y', audience: o.audience, revokeRef: 'p1' }),
    revoke: async () => {},
    ...over,
  });

  test('a target without share behaves as before and cannot share', () => {
    assert.equal(canShare({ kind: 'gdrive', label: 'D', available: () => true, send: async () => ({ label: 'x' }) }), false);
  });

  test('records the link with no token and lists it newest first', async () => {
    const r = await createShareLink(mk(), 'f1', 'a.png', { audience: 'anyone' });
    assert.ok(r.ok);
    const list = await listSharedLinks();
    assert.equal(list.length, 1);
    assert.deepEqual(Object.keys(list[0]!).filter((k) => /token|secret|password/i.test(k)), []);
    assert.equal(list[0]!.url, 'https://x/y');
  });

  test('a refused audience comes back as data with the narrower choices, never a silent fallback', async () => {
    let asked = 0;
    const target = mk({ share: async (_r, o) => { asked++; throw new ShareRefusedError(o.audience, 'admin says no'); } });
    const r = await createShareLink(target, 'f1', 'a.png', { audience: 'anyone' });
    assert.ok(!r.ok && r.kind === 'refused');
    assert.deepEqual(r.narrower, ['organisation']);
    assert.equal(asked, 1, 'asked once, no retry with another audience');
    assert.equal((await listSharedLinks()).length, 0);
  });

  test('an unavailable connection is reported with its hand-off url', async () => {
    const target = mk({ share: async () => { throw new ShareUnavailableError('use the provider', 'https://h/o'); } });
    const r = await createShareLink(target, 'f1', 'a.png', { audience: 'anyone' });
    assert.ok(!r.ok && r.kind === 'unavailable' && r.handoffUrl === 'https://h/o');
  });

  test('switching share links off for the kind stops the request', async () => {
    overrideFlagInMemory('share-gdrive', false);
    try { await assert.rejects(createShareLink(mk(), 'f1', 'a.png', { audience: 'anyone' }), /off for this provider/); }
    finally { overrideFlagInMemory('share-gdrive', true); }
  });

  test('Stop sharing revokes at the provider, then drops the record', async () => {
    const revoked: string[] = [];
    const target = mk({ revoke: async (l) => { revoked.push(`${l.ref}:${l.revokeRef}`); } });
    registerSendTarget(target);
    try {
      const r = await createShareLink(target, 'f1', 'a.png', { audience: 'anyone' });
      assert.ok(r.ok && canStopSharing(r.record));
      await stopSharing(r.record);
      assert.deepEqual(revoked, ['f1:p1']);
      assert.equal((await listSharedLinks()).length, 0);
    } finally { unregisterSendTarget('gdrive'); }
  });
});

// ── Google Drive ──────────────────────────────────────────────────────────────

describe('Google Drive', () => {
  beforeEach(() => seedDriveTokenForTests('tok'));

  test('anyone: one reader permission, then the webViewLink', async () => {
    const s = sim([json({ id: 'perm1' }), json({ webViewLink: 'https://drive.google.com/file/d/f1/view' })]);
    const out = await driveShare('f1', { audience: 'anyone' }, s.fetch);
    assert.equal(s.calls[0]!.method, 'POST');
    assert.equal(s.calls[0]!.url, 'https://www.googleapis.com/drive/v3/files/f1/permissions?fields=id');
    assert.deepEqual(JSON.parse(s.calls[0]!.body), { type: 'anyone', role: 'reader', allowFileDiscovery: false });
    assert.equal(s.calls[0]!.headers.Authorization, 'Bearer tok');
    assert.equal(s.calls[1]!.url, 'https://www.googleapis.com/drive/v3/files/f1?fields=webViewLink');
    assert.deepEqual([out.url, out.revokeRef, out.audience], ['https://drive.google.com/file/d/f1/view', 'perm1', 'anyone']);
  });

  test('organisation: a domain permission built from the signed-in account', async () => {
    const s = sim([json({ user: { emailAddress: 'a@suse.com' } }), json({ id: 'p2' }), json({ webViewLink: 'https://l' })]);
    await driveShare('f1', { audience: 'organisation' }, s.fetch);
    assert.deepEqual(JSON.parse(s.calls[1]!.body), { type: 'domain', domain: 'suse.com', role: 'reader', allowFileDiscovery: false });
  });

  test('organisation on a personal account is refused, not widened', async () => {
    const s = sim([json({ user: { emailAddress: 'a@gmail.com' } })]);
    await assert.rejects(driveShare('f1', { audience: 'organisation' }, s.fetch), ShareRefusedError);
    assert.equal(s.calls.length, 1, 'no permission was created');
  });

  test('people: one user permission each with the notification email on', async () => {
    const s = sim([json({ id: 'u1' }), json({ id: 'u2' }), json({ webViewLink: 'https://l' })]);
    const out = await driveShare('f1', { audience: 'people', people: ['a@b.c', 'd@e.f'] }, s.fetch);
    assert.ok(s.calls[0]!.url.endsWith('permissions?fields=id&sendNotificationEmail=true'));
    assert.deepEqual(JSON.parse(s.calls[1]!.body), { type: 'user', role: 'reader', emailAddress: 'd@e.f' });
    assert.equal(out.revokeRef, 'u1,u2');
  });

  test('an admin-policy 403 becomes a refusal for the audience asked', async () => {
    const s = sim([json({ error: { errors: [{ reason: 'forbidden' }] } }, 403)]);
    await assert.rejects(driveShare('f1', { audience: 'anyone' }, s.fetch), (e: Error) => e instanceof ShareRefusedError && e.audience === 'anyone' && /administrator/.test(e.message));
  });

  test('a rate limit 403 is an ordinary error, not a refusal', async () => {
    const s = sim([json({ error: { errors: [{ reason: 'userRateLimitExceeded' }] } }, 403)]);
    await assert.rejects(driveShare('f1', { audience: 'anyone' }, s.fetch), (e: Error) => !(e instanceof ShareRefusedError));
  });

  test('a half-finished people share takes back what it made', async () => {
    const s = sim([json({ id: 'u1' }), json({}, 403), new Response(null, { status: 204 })]);
    await assert.rejects(driveShare('f1', { audience: 'people', people: ['a@b.c', 'x@y.z'] }, s.fetch), ShareRefusedError);
    assert.equal(s.calls[2]!.method, 'DELETE');
  });

  test('revoke deletes each permission and treats 404 as done', async () => {
    const s = sim([new Response(null, { status: 204 }), new Response(null, { status: 404 })]);
    await driveRevoke('f1', 'u1,u2', s.fetch);
    assert.deepEqual(s.calls.map((c) => `${c.method} ${c.url}`), [
      'DELETE https://www.googleapis.com/drive/v3/files/f1/permissions/u1',
      'DELETE https://www.googleapis.com/drive/v3/files/f1/permissions/u2',
    ]);
  });

  test('capabilities: three audiences, no password, no expiry', () => {
    assert.deepEqual(driveShareCapabilities().audiences, ['anyone', 'organisation', 'people']);
    assert.equal(driveShareCapabilities().expiry, false);
  });
});

// ── Nextcloud ─────────────────────────────────────────────────────────────────

describe('Nextcloud', () => {
  const connect = () => saveConnection({
    kind: 'webdav', account: 'andy', persist: false, connectedAt: 'now',
    config: { baseUrl: 'https://cloud.example.org/', username: 'andy', appPassword: 'pw', folder: 'Lolly' },
  });

  test('ocsShareBody: public link, read-only, optional password and expireDate', () => {
    const body = new URLSearchParams(ocsShareBody('Lolly/a b.png', { password: 's3cret', expiresInDays: 3 }, Date.parse('2026-03-01T10:00:00Z')));
    assert.equal(body.get('path'), '/Lolly/a b.png');
    assert.equal(body.get('shareType'), '3');
    assert.equal(body.get('permissions'), '1');
    assert.equal(body.get('password'), 's3cret');
    assert.equal(body.get('expireDate'), '2026-03-04');
    assert.equal(new URLSearchParams(ocsShareBody('x', {})).has('expireDate'), false);
  });

  test('create: OCS url, headers, Basic auth, and the server expiry is reported', async () => {
    await connect();
    const s = sim([json({ ocs: { meta: { statuscode: 200 }, data: { id: '42', url: 'https://cloud.example.org/s/abc', expiration: '2026-03-08 00:00:00' } } })]);
    const out = await nextcloudShare('Lolly/a.png', { audience: 'anyone', expiresInDays: 7 }, s.fetch);
    const c = s.calls[0]!;
    assert.equal(c.method, 'POST');
    assert.equal(c.url, 'https://cloud.example.org/ocs/v2.php/apps/files_sharing/api/v1/shares?format=json');
    assert.equal(c.headers['OCS-APIRequest'], 'true');
    assert.equal(c.headers.Authorization, `Basic ${Buffer.from('andy:pw').toString('base64')}`);
    assert.deepEqual([out.url, out.revokeRef, out.expiresAt], ['https://cloud.example.org/s/abc', '42', '2026-03-08T23:59:59.000Z']);
  });

  test('public links turned off by the admin are a refusal', async () => {
    await connect();
    const s = sim([json({ ocs: { meta: { statuscode: 403, message: 'Public upload disabled' } } }, 403)]);
    await assert.rejects(nextcloudShare('Lolly/a.png', { audience: 'anyone' }, s.fetch), ShareRefusedError);
  });

  test('revoke: DELETE on the share id; a bad id never reaches the network', async () => {
    await connect();
    const s = sim([new Response(null, { status: 200 })]);
    await nextcloudRevoke('42', s.fetch);
    assert.equal(s.calls[0]!.method, 'DELETE');
    assert.equal(s.calls[0]!.url, 'https://cloud.example.org/ocs/v2.php/apps/files_sharing/api/v1/shares/42?format=json');
    await assert.rejects(nextcloudRevoke('../x', s.fetch), /cannot be switched off/);
    assert.equal(s.calls.length, 1);
  });
});

// ── S3 ────────────────────────────────────────────────────────────────────────

describe('S3 presigned GET', () => {
  const cfg = { endpoint: 'https://s3.eu-central-1.amazonaws.com', bucket: 'my-bucket', region: 'eu-central-1', accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'shhh' };

  test('matches an independent node:crypto signer', async () => {
    const when = new Date('2026-08-19T12:00:00Z');
    const got = new URL(await presignGetUrl(cfg, 'lolly/chart 1.png', 3600, when));
    const [amzDate, date] = amzDates(when);
    const scope = `${date}/eu-central-1/s3/aws4_request`;
    const enc = (v: string) => encodeURIComponent(v);
    const q = [
      ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'], ['X-Amz-Credential', `AKIDEXAMPLE/${scope}`], ['X-Amz-Date', amzDate],
      ['X-Amz-Expires', '3600'], ['X-Amz-SignedHeaders', 'host'],
    ].map(([k, v]) => `${enc(k!)}=${enc(v!)}`).join('&');
    const canonical = ['GET', '/my-bucket/lolly/chart%201.png', q, 'host:s3.eu-central-1.amazonaws.com\n', 'host', 'UNSIGNED-PAYLOAD'].join('\n');
    const sts = ['AWS4-HMAC-SHA256', amzDate, scope, createHash('sha256').update(canonical).digest('hex')].join('\n');
    const h = (k: Buffer | string, d: string) => createHmac('sha256', k).update(d).digest();
    const sig = createHmac('sha256', h(h(h(h('AWS4shhh', date), 'eu-central-1'), 's3'), 'aws4_request')).update(sts).digest('hex');
    assert.equal(got.searchParams.get('X-Amz-Signature'), sig);
    assert.equal(got.pathname, '/my-bucket/lolly/chart%201.png');
    assert.equal(got.searchParams.get('X-Amz-Expires'), '3600');
  });

  test('refuses a lifetime over seven days or under one second', async () => {
    await assert.rejects(presignGetUrl(cfg, 'k', 604_801), /seven days/);
    await assert.rejects(presignGetUrl(cfg, 'k', 0), /seven days/);
    assert.ok(await presignGetUrl(cfg, 'k', 604_800));
  });

  test('capabilities: anyone only, expiry required, at most 7 days, not revocable', () => {
    assert.deepEqual(s3ShareCapabilities(), { audiences: ['anyone'], password: false, expiry: true, expiryRequired: true, maxExpiryDays: 7, revocable: false });
  });

  test('a share with no stored bucket says to set it up', async () => {
    await assert.rejects(s3Share('k', { audience: 'anyone', expiresInDays: 1 }), /Set up your bucket/);
  });
});

// ── Dropbox ───────────────────────────────────────────────────────────────────

describe('Dropbox', () => {
  const ready = async (scopes = 'files.content.write files.content.read account_info.read sharing.write') => {
    await saveConnection({ kind: 'dropbox', account: 'a@b.c', persist: false, scopes, connectedAt: 'now' });
    cacheToken('dropbox', 'dbx', Date.now() + 60_000);
  };

  test('create: public viewer link with a password and expiry', async () => {
    await ready();
    const s = sim([json({ url: 'https://www.dropbox.com/s/x/a.png?dl=0', expires: '2026-04-01T00:00:00Z' })]);
    const out = await dropboxShare('/a.png', { audience: 'anyone', password: 'pw', expiresInDays: 5 }, s.fetch);
    const c = s.calls[0]!;
    assert.equal(c.url, 'https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings');
    const body = JSON.parse(c.body);
    assert.equal(body.path, '/a.png');
    assert.deepEqual(body.settings.audience, { '.tag': 'public' });
    assert.deepEqual(body.settings.access, { '.tag': 'viewer' });
    assert.equal(body.settings.require_password, true);
    assert.equal(body.settings.link_password, 'pw');
    assert.match(body.settings.expires, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
    assert.equal(out.revokeRef, 'https://www.dropbox.com/s/x/a.png?dl=0');
  });

  test('organisation maps to the team audience', async () => {
    await ready();
    const s = sim([json({ url: 'https://u' })]);
    await dropboxShare('/a.png', { audience: 'organisation' }, s.fetch);
    assert.deepEqual(JSON.parse(s.calls[0]!.body).settings.audience, { '.tag': 'team' });
  });

  test('shared_link_already_exists reuses the link and says so', async () => {
    await ready();
    const s = sim([json({ error_summary: 'shared_link_already_exists/..', error: { '.tag': 'shared_link_already_exists', shared_link_already_exists: { metadata: { url: 'https://old' } } } }, 409)]);
    const out = await dropboxShare('/a.png', { audience: 'anyone' }, s.fetch);
    assert.equal(out.url, 'https://old');
    assert.match(out.notes![0]!, /already had a link/);
  });

  test('a Basic plan refusing an expiry retries without it and says so', async () => {
    await ready();
    const refuse = json({ error: { '.tag': 'settings_error', settings_error: { '.tag': 'not_authorized' } } }, 409);
    const s = sim([refuse, json({ url: 'https://plain' })]);
    const out = await dropboxShare('/a.png', { audience: 'anyone', expiresInDays: 3 }, s.fetch);
    assert.equal(JSON.parse(s.calls[1]!.body).settings.expires, undefined);
    assert.match(out.notes![0]!, /does not allow an expiry/);
  });

  test('a refused password is NOT dropped: no link is made', async () => {
    await ready();
    const s = sim([json({ error: { '.tag': 'settings_error', settings_error: { '.tag': 'not_authorized' } } }, 409)]);
    await assert.rejects(dropboxShare('/a.png', { audience: 'anyone', password: 'pw' }, s.fetch), ShareRefusedError);
    assert.equal(s.calls.length, 1);
  });

  test('named people are not offered', async () => {
    await assert.rejects(dropboxShare('/a.png', { audience: 'people', people: ['a@b.c'] }), ShareRefusedError);
  });

  test('revoke posts the link url; not-found counts as done', async () => {
    await ready();
    const s = sim([json({ error_summary: 'shared_link_not_found/' }, 409)]);
    await dropboxRevoke('https://u', s.fetch);
    assert.equal(s.calls[0]!.url, 'https://api.dropboxapi.com/2/sharing/revoke_shared_link');
    assert.deepEqual(JSON.parse(s.calls[0]!.body), { url: 'https://u' });
  });

  test('a token without sharing.write is not used for the call: the second consent runs first', async () => {
    await ready('files.content.write files.content.read account_info.read');
    const s = sim([]);
    // No browser here: the incremental grant needs a window, which proves it was asked for.
    await assert.rejects(dropboxShare('/a.png', { audience: 'anyone' }, s.fetch));
    assert.equal(s.calls.length, 0, 'no sharing request went out with the narrower token');
  });
});

// ── OneDrive ──────────────────────────────────────────────────────────────────

describe('OneDrive', () => {
  beforeEach(() => { cacheToken('o365', 'ms', Date.now() + 60_000); });

  test('create: createLink view/anonymous with an expiry', async () => {
    const s = sim([json({ id: 'perm9', link: { webUrl: 'https://1drv.ms/x' }, expirationDateTime: '2026-04-01T00:00:00Z' }, 201)]);
    const out = await oneDriveShare('item1', { audience: 'anyone', expiresInDays: 2 }, s.fetch);
    assert.equal(s.calls[0]!.url, 'https://graph.microsoft.com/v1.0/me/drive/items/item1/createLink');
    const body = JSON.parse(s.calls[0]!.body);
    assert.equal(body.type, 'view');
    assert.equal(body.scope, 'anonymous');
    assert.match(body.expirationDateTime, /Z$/);
    assert.deepEqual([out.url, out.revokeRef], ['https://1drv.ms/x', 'perm9']);
    assert.equal(out.notes, undefined);
  });

  test('organisation scope, and a 200 says the link already existed', async () => {
    const s = sim([json({ id: 'p', link: { webUrl: 'https://org' } }, 200)]);
    const out = await oneDriveShare('item1', { audience: 'organisation' }, s.fetch);
    assert.equal(JSON.parse(s.calls[0]!.body).scope, 'organization');
    assert.match(out.notes![0]!, /already had a link/);
  });

  test('app-folder token refused: marks sharing unavailable, hands off to webUrl, never widens', async () => {
    const s = sim([
      json({ error: { code: 'accessDenied', message: 'Access denied: permission scope' } }, 403),
      json({ webUrl: 'https://onedrive.live.com/item1' }),
    ]);
    await assert.rejects(oneDriveShare('item1', { audience: 'anyone' }, s.fetch), (e: Error) =>
      e instanceof ShareUnavailableError && e.handoffUrl === 'https://onedrive.live.com/item1');
    assert.ok(shareUnavailable('o365'));
    assert.deepEqual(oneDriveShareCapabilities().audiences, [], 'the UI now offers only the hand-off');
    assert.equal(s.calls.length, 2, 'only createLink and the webUrl read: no scope request');
  });

  test('a plain 403 on anyone is an admin policy refusal, not a broken connection', async () => {
    const s = sim([json({ error: { code: 'accessDenied', message: 'Anonymous links are disabled' } }, 403)]);
    await assert.rejects(oneDriveShare('item1', { audience: 'anyone' }, s.fetch), ShareRefusedError);
    assert.ok(!shareUnavailable('o365'));
  });

  test('revoke deletes the permission', async () => {
    const s = sim([new Response(null, { status: 204 })]);
    await oneDriveRevoke('item1', 'perm9', s.fetch);
    assert.equal(s.calls[0]!.method, 'DELETE');
    assert.equal(s.calls[0]!.url, 'https://graph.microsoft.com/v1.0/me/drive/items/item1/permissions/perm9');
  });
});
