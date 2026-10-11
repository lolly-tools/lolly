// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { contentCoding, deliveryResponse, deliveryHeaders } from '../src/delivery-http.ts';

function write(status: number, body: string | undefined, accept?: string, method = 'GET', etag?: string, requestTag?: string) {
  const out = { status: 0, headers: {} as Record<string, string>, bytes: undefined as Buffer | undefined };
  const raw = { writeHead(code: number, headers: Record<string, string>) { out.status = code; out.headers = headers; return this; }, end(bytes?: Uint8Array) { out.bytes = bytes === undefined ? undefined : Buffer.from(bytes); return this; } } as unknown as ServerResponse;
  const req = { method, headers: { 'accept-encoding': accept, 'if-none-match': requestTag } } as unknown as IncomingMessage;
  const res = deliveryResponse(req, raw);
  res.writeHead(status, { 'content-type': 'application/json', ...(etag ? { etag } : {}) }); res.end(body);
  return out;
}

test('origin content-coding negotiation respects explicit refusal and quality', () => {
  assert.equal(contentCoding(undefined), 'identity');
  assert.equal(contentCoding('br, gzip'), 'br');
  assert.equal(contentCoding('gzip;q=1, br;q=0.5'), 'gzip');
  assert.equal(contentCoding('identity;q=1, br;q=.5'), 'identity');
  assert.equal(contentCoding('br;q=0, gzip;q=0'), 'identity');
  assert.equal(contentCoding('*;q=0'), null);
  assert.equal(contentCoding('br;q=broken, identity;q=0'), null);
});
test('gzip and Brotli decode to exact original bytes and weaken representation validators', () => {
  const source = JSON.stringify({ payload: 'Lolly signed bytes stay intact. '.repeat(200) });
  for (const encoding of ['gzip', 'br']) {
    const out = write(200, source, encoding, 'GET', '"decoded-digest"');
    assert.equal(out.headers['content-encoding'], encoding);
    assert.equal(out.headers.vary, 'Accept-Encoding');
    assert.equal(out.headers.etag, 'W/"decoded-digest"');
    assert.equal(out.headers['content-length'], String(out.bytes!.byteLength));
    assert.equal((encoding === 'gzip' ? gunzipSync(out.bytes!) : brotliDecompressSync(out.bytes!)).toString(), source);
    assert.equal(out.headers['cache-control'], 'private, no-store, max-age=0, no-transform');
    assert.equal(out.headers['cdn-cache-control'], 'no-store');
    assert.equal(out.headers['referrer-policy'], 'no-referrer');
  }
});
test('HEAD, 204 and 304 have no body or coding; weak revalidation remains weak', () => {
  for (const [status, method] of [[200, 'HEAD'], [204, 'GET'], [304, 'GET']] as const) {
    const out = write(status, 'x'.repeat(2048), 'gzip', method, '"digest"', 'W/"digest"');
    assert.equal(out.bytes, undefined); assert.equal(out.headers['content-encoding'], undefined);
    assert.equal(out.headers['content-length'], undefined);
    if (status === 304) assert.equal(out.headers.etag, 'W/"digest"');
  }
});
test('small bodies stay identity unless identity is forbidden; error policy overrides public rules', () => {
  assert.equal(write(200, '{}', 'gzip').headers['content-encoding'], undefined);
  assert.equal(write(200, '{}', 'gzip, identity;q=0').headers['content-encoding'], 'gzip');
  assert.equal(write(200, '{}', '*;q=0').status, 406);
  const out = { headers: {} as Record<string, string> };
  const target = { writeHead(_status: number, headers: Record<string, string>) { out.headers = headers; return this; }, end() {} } as unknown as ServerResponse;
  const res = deliveryResponse({ headers: {} } as IncomingMessage, target);
  res.writeHead(404, deliveryHeaders('public-immutable')); res.end('missing');
  assert.equal(out.headers['cache-control'], 'private, no-store, max-age=0, no-transform');
  assert.equal(out.headers['cdn-cache-control'], 'no-store');
});
