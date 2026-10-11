// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ResultFiles, bearerPrincipal, privateFileScopeEnabled, linkLargeResults } from '../src/result-files.ts';
import { createGateway } from '../src/gateway.ts';
const origin = 'https://mcp.example.test';
const secret = 'test-only-result-key';
const owner = bearerPrincipal('Bearer alice')!;

test('30 MiB PDF result needs the same bearer, exact host/path/token, and expires at 300 seconds', async () => {
  let now = Date.UTC(2026, 9, 11);
  const files = new ResultFiles(() => now);
  try {
    const pdf = Buffer.alloc(30 * 1024 * 1024, 32); pdf.write('%PDF-1.7\n'); pdf.write('\n%%EOF', pdf.length - 6);
    const link = await files.hold(owner, pdf, 'application/pdf', '../deck.pdf', origin, secret);
    assert.equal(link.type, 'resource_link'); if (link.type !== 'resource_link') return;
    const url = new URL(link.uri); const dt = url.searchParams.get('dt')!;
    const got = await files.fetch(owner, url.pathname, dt, origin, secret);
    assert.deepEqual(got?.bytes, pdf); assert.equal(got?.etag, `"${createHash('sha256').update(pdf).digest('hex')}"`);
    assert.equal(await files.fetch(bearerPrincipal('Bearer bob')!, url.pathname, dt, origin, secret), null);
    assert.equal(await files.fetch(owner, url.pathname, `${dt.slice(0, -1)}!`, origin, secret), null);
    assert.equal(await files.fetch(owner, `${url.pathname}/extra`, dt, origin, secret), null);
    assert.equal(await files.fetch(owner, url.pathname, dt, 'https://other.example.test', secret), null);
    assert.equal(await files.fetch(owner, url.pathname.replace('/files/', '/files/%2e/'), dt, origin, secret), null);
    now += 299_000; assert.ok(await files.fetch(owner, url.pathname, dt, origin, secret));
    now += 1_000; assert.equal(await files.fetch(owner, url.pathname, dt, origin, secret), null);
  } finally { await files.close(); }
});
test('concurrent holds reserve their owner quota before filesystem awaits; restart clears results', async () => {
  const files = new ResultFiles();
  try {
    const bytes = Buffer.alloc(34 * 1024 * 1024);
    const results = await Promise.allSettled([files.hold(owner, bytes, 'application/pdf', 'a.pdf', origin, secret), files.hold(owner, bytes, 'application/pdf', 'b.pdf', origin, secret)]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected').length, 1);
    const successful = results.find(result => result.status === 'fulfilled');
    assert.ok(successful && successful.status === 'fulfilled' && successful.value.type === 'resource_link');
    if (successful?.status === 'fulfilled' && successful.value.type === 'resource_link') {
      const url = new URL(successful.value.uri); await files.close();
      assert.equal(await files.fetch(owner, url.pathname, url.searchParams.get('dt')!, origin, secret), null);
    }
  } finally { await files.close(); }
});
test('links are unavailable to anonymous, Vercel or multiple-replica gateways', () => {
  const env = { LOLLY_MCP_PRIVATE_FILES: '1', LOLLY_MCP_TOKEN: 'alice' };
  assert.equal(privateFileScopeEnabled(env), true);
  for (const extra of [{ VERCEL: '1' }, { LOLLY_MCP_TOKEN: '' }, { LOLLY_MCP_REPLICAS: '2' }, { LOLLY_MCP_PRIVATE_FILES: '0' }]) assert.equal(privateFileScopeEnabled({ ...env, ...extra }), false);
  assert.equal(bearerPrincipal('bearer   alice'), owner);
  assert.equal(bearerPrincipal(undefined), null);
});
test('generic oversized resources become links only with a delivery callback; small/text guidance stays inline', async () => {
  const source = { content: [{ type: 'text' as const, text: 'Review your document.' }, { type: 'resource' as const, resource: { uri: 'lolly://render/deck.pdf', mimeType: 'application/pdf', blob: Buffer.alloc(1024 * 1024 + 1).toString('base64') } }] };
  assert.equal(await linkLargeResults(source), source);
  const held: number[] = [];
  const result = await linkLargeResults(source, async (bytes, mime, name) => { held.push(bytes.byteLength); return { type: 'resource_link', uri: 'https://mcp.example.test/private', name, mimeType: mime }; });
  assert.deepEqual(held, [1024 * 1024 + 1]); assert.equal(result.content[0], source.content[0]); assert.equal(result.content[1]?.type, 'resource_link');
});
test('HTTP download rechecks current bearer, rejects alternate paths, meters bytes and returns no-store', async () => {
  const files = new ResultFiles(); const recorded: number[] = [];
  const env = { LOLLY_MCP_PRIVATE_FILES: '1', LOLLY_MCP_TOKEN: 'alice', LOLLY_MCP_PUBLIC_ORIGIN: origin };
  const budget = { async check() { return { ok: true, retryAfter: 0 }; }, async record(bytes: number) { recorded.push(bytes); } };
  const gateway = createGateway(env, { resultFiles: files, budget });
  const drive = async (path: string, auth = 'Bearer alice', method = 'GET') => {
    const out = { status: 0, headers: {} as Record<string, string>, bytes: undefined as Buffer | undefined };
    const req = { method, url: path, headers: { authorization: auth, host: 'attacker.invalid' }, socket: { remoteAddress: '127.0.0.1' } } as unknown as IncomingMessage;
    const res = { writeHead(status: number, headers: Record<string, string>) { out.status = status; out.headers = headers; return this; }, end(bytes?: Uint8Array) { out.bytes = bytes === undefined ? undefined : Buffer.from(bytes); return this; } } as unknown as ServerResponse;
    await gateway(req, res); return out;
  };
  try {
    const bytes = Buffer.from('%PDF-1.7\n exact signed result \n%%EOF');
    const link = await files.hold(owner, bytes, 'application/pdf', 'deck.pdf', origin, secret);
    assert.equal(link.type, 'resource_link'); if (link.type !== 'resource_link') return;
    // The gateway key is derived from its configured secret, never an unrelated key.
    const bound = await files.hold(owner, bytes, 'application/pdf', 'deck.pdf', origin, 'alice');
    assert.equal(bound.type, 'resource_link'); if (bound.type !== 'resource_link') return;
    const url = new URL(bound.uri); const route = url.pathname + url.search;
    const got = await drive(route); assert.equal(got.status, 200); assert.deepEqual(got.bytes, bytes);
    assert.equal(got.headers['cache-control'], 'private, no-store, max-age=0, no-transform'); assert.equal(got.headers['cdn-cache-control'], 'no-store'); assert.equal(got.headers['referrer-policy'], 'no-referrer');
    assert.deepEqual(recorded, [bytes.length]);
    assert.equal((await drive(route, 'Bearer bob')).status, 404);
    assert.equal((await drive(route, '')).status, 404);
    assert.equal((await drive(route.replace('/files/', '/files/%2e/'))).status, 404);
    const head = await drive(route, 'Bearer alice', 'HEAD'); assert.equal(head.status, 200); assert.equal(head.bytes, undefined);
    const revoked = createGateway({ ...env, LOLLY_MCP_TOKEN: 'replacement' }, { resultFiles: files, budget });
    let status = 0; await revoked({ method: 'GET', url: route, headers: { authorization: 'Bearer alice' }, socket: {} } as IncomingMessage, { writeHead(code: number) { status = code; return this; }, end() {} } as unknown as ServerResponse);
    assert.equal(status, 404);
  } finally { await files.close(); }
});
