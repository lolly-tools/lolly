// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { fetchPublicBytes, isPublicAddress, PUBLIC_IMAGE_TYPES, requestPinned, type PublicHttpRequest } from '../src/public-http.ts';

const url = 'https://assets.example.test/image';
const resolver = async (): Promise<string[]> => ['1.1.1.1'];
const image = (): Response => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } });

test('public addresses exclude special-purpose IPv4 and IPv6 ranges', () => {
  for (const address of [
    '0.1.2.3', '10.1.2.3', '100.64.1.2', '127.1.2.3', '169.254.1.2',
    '172.17.1.2', '192.0.0.1', '192.0.2.1', '192.88.99.1', '192.168.1.2',
    '198.18.1.2', '198.51.100.1', '203.0.113.1', '224.1.2.3', '240.1.2.3',
    '::', '::1', '::ffff:1.1.1.1', '64:ff9b::101:101', '100:0:0:1::1',
    '2001::1', '2001:db8::1', '2002::1', '3fff::1', '5f00::1', 'fc00::1', 'fe80::1', 'ff02::1',
  ]) assert.equal(isPublicAddress(address), false, address);
  for (const address of ['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111']) assert.equal(isPublicAddress(address), true, address);
  for (const address of ['', 'invalid', '999.1.1.1']) assert.equal(isPublicAddress(address), false, address);
});

test('the transport receives the exact validated DNS answer', async () => {
  let resolutions = 0;
  const request: PublicHttpRequest = async (target, options) => {
    assert.equal(target.toString(), url);
    assert.equal(options.address, '1.1.1.1');
    assert.equal(resolutions, 1);
    return image();
  };
  const result = await fetchPublicBytes(url, {
    resolver: async () => { resolutions++; return resolutions === 1 ? ['1.1.1.1'] : ['192.0.2.1']; },
    request, allowedTypes: PUBLIC_IMAGE_TYPES,
  });
  assert.deepEqual(result.bytes, new Uint8Array([1, 2, 3]));
  assert.equal(resolutions, 1);
});

test('empty and mixed DNS answers are refused before transport', async () => {
  let calls = 0;
  for (const addresses of [[], ['192.0.2.1'], ['1.1.1.1', '192.0.2.1']]) {
    await assert.rejects(fetchPublicBytes(url, {
      resolver: async () => addresses, request: async () => { calls++; return image(); },
    }), /not reachable/);
  }
  assert.equal(calls, 0);
});

test('each redirect resolves again and must retain public admission', async () => {
  let calls = 0;
  let resolutions = 0;
  await assert.rejects(fetchPublicBytes(url, {
    resolver: async () => ++resolutions === 1 ? ['1.1.1.1'] : ['192.0.2.1'],
    request: async () => { calls++; return new Response(null, { status: 302, headers: { location: '/next' } }); },
  }), /not reachable/);
  assert.equal(resolutions, 2);
  assert.equal(calls, 1);
});

test('redirect count and allowlist bounds apply before another transport call', async () => {
  let calls = 0;
  const request: PublicHttpRequest = async () => { calls++; return new Response(null, { status: 302, headers: { location: '/next' } }); };
  await assert.rejects(fetchPublicBytes(url, { resolver, request, maxRedirects: 1 }), /too many/);
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(fetchPublicBytes(url, { resolver, request, allowUrl: next => next.pathname === '/image' }), /not allowed/);
  assert.equal(calls, 1);
});

test('image admission requires response MIME regardless of URL name', async () => {
  for (const type of ['text/plain', 'text/html', 'application/octet-stream', '']) {
    await assert.rejects(fetchPublicBytes(`${url}.png`, {
      resolver, allowedTypes: PUBLIC_IMAGE_TYPES,
      request: async () => new Response('fixture', { headers: { 'content-type': type } }),
    }), /content type/);
  }
});

test('declared and streamed bodies share a counting byte cap and cancellation', async () => {
  let cancelled = 0;
  for (const declared of [undefined, '20']) {
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) { controller.enqueue(new Uint8Array(4)); },
      cancel() { cancelled++; },
    });
    await assert.rejects(fetchPublicBytes(url, {
      resolver, maxBytes: 8,
      request: async () => new Response(stream, { headers: declared ? { 'content-length': declared } : {} }),
    }), /byte limit/);
  }
  assert.equal(cancelled, 2);
});

test('one deadline bounds unresolved DNS and an unfinished body', async () => {
  await assert.rejects(fetchPublicBytes(url, { timeoutMs: 20, resolver: () => new Promise(() => {}) }), /too long/);
  let cancelled = false;
  await assert.rejects(fetchPublicBytes(url, {
    resolver, timeoutMs: 20,
    request: async () => new Response(new ReadableStream({ cancel() { cancelled = true; } })),
  }), /too long/);
  assert.equal(cancelled, true);
});

test('transport errors and caller cancellation finish within the request budget', async () => {
  await assert.rejects(fetchPublicBytes(url, { resolver, request: async () => { throw new Error('fixture failure'); } }), /fixture failure/);
  const controller = new AbortController();
  controller.abort(new Error('fixture cancellation'));
  await assert.rejects(fetchPublicBytes(url, { resolver, signal: controller.signal, request: async () => image() }), /fixture cancellation/);
});

test('native HTTP connects to the supplied address with the original Host', async () => {
  const server = createServer((req, res) => {
    assert.equal(req.headers.host, `unresolvable.example.test:${(server.address() as { port: number }).port}`);
    assert.equal(req.url, '/image?size=small');
    assert.equal(req.headers['accept-encoding'], 'identity');
    res.setHeader('content-type', 'image/png');
    res.end(new Uint8Array([1, 2, 3]));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = (server.address() as { port: number }).port;
    const response = await requestPinned(new URL(`http://unresolvable.example.test:${port}/image?size=small`), {
      address: '127.0.0.1', signal: AbortSignal.timeout(1000), headers: new Headers(),
    });
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array([1, 2, 3]));
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
