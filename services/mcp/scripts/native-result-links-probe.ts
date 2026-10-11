// SPDX-License-Identifier: MPL-2.0
/** Real HTTP qualification of optional authenticated, single-process downloads. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat, access } from 'node:fs/promises';
import { dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { setTimeout as delay } from 'node:timers/promises';
import { bearerPrincipal, ResultFiles } from '../src/result-files.ts';
import { privateFiles } from '../src/file-resources.ts';
import { ResultLinksFixture, heldFilePath, pdfByteFixture, type HttpResult } from './result-links-http-fixture.ts';

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const route = (uri: string) => { const url = new URL(uri); return url.pathname + url.search; };
function privateResponse(response: HttpResult, status: number): void {
  assert.equal(response.status, status);
  assert.equal(response.headers['cache-control'], 'private, no-store, max-age=0, no-transform');
  assert.equal(response.headers['cdn-cache-control'], 'no-store');
  assert.equal(response.headers['referrer-policy'], 'no-referrer');
  assert.equal(response.headers.age, undefined); assert.equal(response.headers['set-cookie'], undefined);
  if (status !== 200) assert.equal(response.headers.etag, undefined);
}
async function listed(fixture: ResultLinksFixture, bearer = fixture.bearer): Promise<string[]> {
  const response = await fixture.http('/api/mcp', bearer, 'POST', { 'content-type': 'application/json' }, JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }));
  assert.equal(response.status, 200);
  const json = JSON.parse(response.bytes.toString()) as { result: { tools: { name: string }[] } };
  return json.result.tools.map(tool => tool.name);
}
function link(response: HttpResult): string {
  assert.equal(response.status, 200);
  const json = JSON.parse(response.bytes.toString()) as { result: { content: { type: string; uri?: string }[] } };
  assert.equal(json.result.content.length, 1); const block = json.result.content[0]!;
  assert.equal(block.type, 'resource_link'); assert.equal(typeof block.uri, 'string'); return block.uri!;
}
async function authenticationAndBytes(): Promise<number> {
  const fixture = await new ResultLinksFixture().start();
  try {
    assert.ok((await listed(fixture)).includes('files_download'));
    assert.equal((await fixture.http('/api/mcp', '', 'POST', { 'content-type': 'application/json' }, '{"jsonrpc":"2.0","id":1,"method":"tools/list"}')).status, 401);
    const bob = await fixture.oauthBearer(); assert.notEqual(bob, fixture.bearer);
    assert.ok((await listed(fixture, bob)).includes('files_download'), 'The other principal is genuinely authorized.');
    const bytes = Buffer.from('name,value\nprobe,' + 'x'.repeat(1024 * 1024 + 16) + '\n');
    const imported = await fixture.rpc('files_import', { name: 'probe.csv', mime: 'text/csv', base64: bytes.toString('base64') });
    assert.equal(imported.status, 200);
    const content = JSON.parse(imported.bytes.toString()) as { result: { content: { text: string }[] } };
    const id = (JSON.parse(content.result.content[0]!.text) as { file: { id: string } }).file.id;
    const before = fixture.budget.records.length;
    const minted = await fixture.rpc('files_download', { id }); const uri = link(minted);
    assert.equal(new URL(uri).origin, fixture.origin);
    assert.deepEqual(fixture.budget.records.slice(before), [bytes.length, minted.bytes.length], 'Hold and JSON response both debit decoded bytes.');
    const exp = Number(new URL(uri).searchParams.get('dt')!.split('.')[2]);
    assert.ok(exp - Math.floor(Date.now() / 1000) >= 298 && exp - Math.floor(Date.now() / 1000) <= 300);
    const path = await heldFilePath(uri); assert.equal((await stat(path)).mode & 0o777, 0o600);
    assert.equal((await stat(dirname(path))).mode & 0o777, 0o700); assert.equal(digest(await readFile(path)), digest(bytes));
    const got = await fixture.http(route(uri), fixture.bearer, 'GET', { host: 'attacker.invalid' });
    privateResponse(got, 200); assert.equal(digest(got.bytes), digest(bytes)); assert.equal(got.headers.etag, `"${digest(bytes)}"`);
    assert.equal(got.headers['content-encoding'], undefined); assert.match(String(got.headers['content-disposition']), /^attachment;/);
    assert.equal(fixture.budget.records.at(-1), bytes.length);
    const gzip = await fixture.http(route(uri), fixture.bearer, 'GET', { 'accept-encoding': 'gzip' }); privateResponse(gzip, 200);
    assert.equal(gzip.headers['content-encoding'], 'gzip'); assert.equal(digest(gunzipSync(gzip.bytes)), digest(bytes));
    assert.equal(gzip.headers.etag, `W/${got.headers.etag}`); assert.ok(gzip.bytes.length < bytes.length);
    assert.equal(fixture.budget.records.at(-1), bytes.length, 'Metering counts decoded identity bytes, not smaller wire bytes.');
    const head = await fixture.http(route(uri), fixture.bearer, 'HEAD'); privateResponse(head, 200);
    assert.equal(head.bytes.length, 0); assert.equal(head.headers.etag, got.headers.etag); assert.equal(fixture.budget.records.at(-1), 0);
    // This route deliberately returns full bytes: it does not advertise resumable ranges or conditional GETs.
    const fullResponseRequests: Record<string, string>[] = [{ range: 'bytes=0-15' }, { 'if-none-match': got.headers.etag as string }];
    for (const headers of fullResponseRequests) {
      const full = await fixture.http(route(uri), fixture.bearer, 'GET', headers); privateResponse(full, 200);
      assert.equal(digest(full.bytes), digest(bytes)); assert.equal(full.headers['content-range'], undefined); assert.equal(full.headers['accept-ranges'], undefined);
    }
    const url = new URL(uri); const token = url.searchParams.get('dt')!;
    for (const invalid of [route(uri), `${route(uri)}&dt=${token}`, `${route(uri)}&extra=1`, `${url.pathname}/extra${url.search}`,
      `${url.pathname.replace('/files/', '/files/%2e/')}${url.search}`, `${url.pathname}?dt=${encodeURIComponent(token.slice(0, -1) + '!')}`]) {
      privateResponse(await fixture.http(invalid, invalid === route(uri) ? bob : fixture.bearer), 404);
    }
    privateResponse(await fixture.http(route(uri), ''), 404);
    const otherHost = await fixture.files.hold(bearerPrincipal(`Bearer ${fixture.bearer}`)!, bytes, 'text/csv', 'host.csv', 'https://other.invalid', fixture.env.LOLLY_MCP_SIGNING_SECRET!);
    assert.equal(otherHost.type, 'resource_link'); if (otherHost.type === 'resource_link') privateResponse(await fixture.http(route(otherHost.uri)), 404);
    await fixture.rpc('files_delete', { id }); return bytes.length;
  } finally { await fixture.close(); await privateFiles.close(); }
}
async function largePdfAndQuota(): Promise<number> {
  const fixture = await new ResultLinksFixture().start();
  try {
    const owner = bearerPrincipal(`Bearer ${fixture.bearer}`)!; const secret = fixture.env.LOLLY_MCP_SIGNING_SECRET!;
    const pdf = pdfByteFixture(30 * 1024 * 1024); const held = await fixture.files.hold(owner, pdf, 'application/pdf', 'deck.pdf', fixture.origin, secret);
    assert.equal(held.type, 'resource_link'); assert.ok(held.type === 'resource_link');
    const got = await fixture.http(route(held.uri)); privateResponse(got, 200); assert.equal(digest(got.bytes), digest(pdf));
    const path = await heldFilePath(held.uri); await fixture.files.close();
    privateResponse(await fixture.http(route(held.uri)), 404); await assert.rejects(access(path), { code: 'ENOENT' });
    return pdf.length;
  } finally { await fixture.close(); }
}
async function quotaAndExpiry(): Promise<number> {
  const quota = await new ResultLinksFixture().start();
  try {
    const owner = bearerPrincipal(`Bearer ${quota.bearer}`)!; const bytes = Buffer.alloc(34 * 1024 * 1024, 32);
    const results = await Promise.allSettled(['a', 'b'].map(name => quota.files.hold(owner, bytes, 'application/octet-stream', name, quota.origin, quota.env.LOLLY_MCP_SIGNING_SECRET!)));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const refused = results.find(result => result.status === 'rejected'); assert.ok(refused?.status === 'rejected'); assert.match(String(refused.reason), /quota reached/);
    const accepted = results.find(result => result.status === 'fulfilled'); assert.ok(accepted?.status === 'fulfilled' && accepted.value.type === 'resource_link');
    if (accepted.value.type === 'resource_link') privateResponse(await quota.http(route(accepted.value.uri)), 200);
  } finally { await quota.close(); }
  const expiring = await new ResultLinksFixture(2).start(); const started = Date.now();
  try {
    const held = await expiring.files.hold(bearerPrincipal(`Bearer ${expiring.bearer}`)!, Buffer.from('expires'), 'text/plain', 'short.txt', expiring.origin, expiring.env.LOLLY_MCP_SIGNING_SECRET!);
    assert.ok(held.type === 'resource_link'); const path = await heldFilePath(held.uri);
    privateResponse(await expiring.http(route(held.uri)), 200);
    const exp = Number(new URL(held.uri).searchParams.get('dt')!.split('.')[2]); assert.ok(exp * 1000 - started <= 2000);
    await delay(Math.max(0, exp * 1000 - Date.now()) + 50);
    privateResponse(await expiring.http(route(held.uri)), 404); await assert.rejects(access(path), { code: 'ENOENT' });
    return Date.now() - started;
  } finally { await expiring.close(); }
}
async function unavailableTopologies(): Promise<void> {
  for (const override of [{ LOLLY_MCP_ALLOW_ANONYMOUS: '1', LOLLY_MCP_TOKEN: '' }, { LOLLY_MCP_REPLICAS: '2' }]) {
    const fixture = await new ResultLinksFixture(300, override).start();
    try {
      assert.ok(!(await listed(fixture)).some(name => name.startsWith('files_')));
      privateResponse(await fixture.http('/api/mcp/files/00000000-0000-4000-8000-000000000000?dt=unavailable'), 404);
      const denied = await fixture.rpc('files_download', { id: 'unavailable' }); assert.equal(denied.status, 200);
      const parsed = JSON.parse(denied.bytes.toString()) as { error?: unknown }; assert.ok(parsed.error);
    } finally { await fixture.close(); }
  }
}
export async function probeResultLinks(): Promise<Record<string, unknown>> {
  for (const ttl of [0, -1, 301, 1.5, NaN, true]) assert.throws(() => new ResultFiles(Date.now, ttl as number), /integer from 1 to 300/);
  const importedBytes = await authenticationAndBytes(); const pdfFixtureBytes = await largePdfAndQuota();
  const realExpiryElapsedMs = await quotaAndExpiry(); await unavailableTopologies();
  return { actualHttpQualified: true, defaultLifetimeSeconds: 300, realExpiryElapsedMs, importedBytes, pdfFixtureBytes,
    distinctAuthorizedOwnerRefused: true, exactBytesAndDecodedMetering: true, anonymousAndMultipleReplicasDisabled: true,
    concurrentOwnerQuotaEnforced: true, physicalExpiryAndCloseCleanup: true, rangeAndConditionalSupport: false,
    fullResponseFallbackVerified: true, admission: 'isolated-memory-fixture; durable production admission is qualified separately',
    pdfScope: 'valid PDF byte-storage/download fixture; rendered PDF qualification remains in the native image probe' };
}
