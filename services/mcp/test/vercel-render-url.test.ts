// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { vercelRenderUrl } from '../src/vercel-render-url.ts';
import { renderGet } from '../src/render-get.ts';

test('rewrite capture is removed without changing unrelated requests or file values', () => {
  const untouched = [
    '/tool/qr-code.svg?url=a%20b', '/tool/qr-code.svg?file=other.svg',
    '/api/mcp?file=qr-code.svg', '/api/mcp/token?file=qr-code.svg',
  ];
  for (const url of untouched) assert.equal(vercelRenderUrl(url), url);
  assert.equal(vercelRenderUrl('/tool/qr-code.svg?file=qr-code.svg&url=hello'), '/tool/qr-code.svg?url=hello');
  assert.equal(vercelRenderUrl('/api/mcp/tool/qr-code.svg?file=qr-code.svg&url=hello'), '/api/mcp/tool/qr-code.svg?url=hello');
  assert.equal(vercelRenderUrl('/tool/qr-code.svg?file=other.svg&file=qr-code.svg'), '/tool/qr-code.svg?file=other.svg');
});

test('a cache-busting redirect terminates after Vercel adds the capture again', async () => {
  const initial = new URL(vercelRenderUrl('/tool/qr-code.svg?url=https%3A%2F%2Fexample.com&file=qr-code.svg&cachebust=1'), 'http://internal');
  const first = await renderGet(initial.pathname, initial.search.slice(1), { ip: '10.98.1.1', env: {} });
  assert.equal(first.status, 308);
  assert.equal(first.headers.location, '/tool/qr-code.svg?url=https%3A%2F%2Fexample.com');
  const rewritten = new URL(first.headers.location!, 'http://internal');
  rewritten.searchParams.append('file', 'qr-code.svg');
  const next = new URL(vercelRenderUrl(`${rewritten.pathname}${rewritten.search}`), 'http://internal');
  const rendered = await renderGet(next.pathname, next.search.slice(1), { ip: '10.98.1.2', env: {} });
  assert.equal(rendered.status, 200);
  assert.match(rendered.headers['content-type']!, /image\/svg\+xml/);
});
