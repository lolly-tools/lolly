// SPDX-License-Identifier: MPL-2.0
/** What the connected instance offers a brand page, and the one publish request. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { connectedInstanceFrom } from './brand-page-publish.ts';

const CAPABILITY = { maxBundleBytes: 1024, partBytes: 4, approval: false };

function stubFetch(answer: (url: string, init: RequestInit) => { status: number; body: unknown }): { calls: Array<{ url: string; init: RequestInit }>; restore: () => void } {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    const { status, body } = answer(url, init);
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

test('no instance, nothing to report', () => {
  assert.equal(connectedInstanceFrom(null, false), null);
});

test('a connected instance always gives an agent its address, and never a token', () => {
  const instance = connectedInstanceFrom({}, true)!;
  assert.match(instance.mcpUrl, /\/api\/v1\/mcp$/);
  assert.equal(instance.brandPages, null, 'no capability, no Publish');
  assert.doesNotMatch(JSON.stringify(instance), /token|Bearer/i);
});

test('publishing sends the parts in the brand-page scope, then names the upload and its checksum', async () => {
  const stub = stubFetch((url, init) => {
    if (url.endsWith('/api/v1/uploads') && init.method === 'POST') return { status: 201, body: { upload: { id: 'upl_1' } } };
    if (url.includes('/parts/')) return { status: 200, body: {} };
    if (url.endsWith('/finalize')) return { status: 200, body: {} };
    if (url.endsWith('/api/v1/brand-pages')) return { status: 201, body: { page: { slug: 'acme', url: 'https://work.example.com/brand/acme/' } } };
    return { status: 404, body: {} };
  });
  try {
    const hosting = connectedInstanceFrom({ brandPages: CAPABILITY }, true)!.brandPages!;
    const result = await hosting.publish({ bundle: new Uint8Array([1, 2, 3, 4, 5, 6]) });
    assert.equal(result.state, 'live');
    assert.equal(result.url, 'https://work.example.com/brand/acme/', 'the instance\'s own address');
    const begun = JSON.parse(String(stub.calls[0]!.init.body));
    assert.equal(begun.scope, 'brand-page');
    assert.equal(begun.parts.length, 2, 'split at partBytes');
    const last = stub.calls.at(-1)!;
    assert.match(last.url, /\/api\/v1\/brand-pages$/);
    const sent = JSON.parse(String(last.init.body));
    assert.equal(sent.uploadId, 'upl_1');
    assert.equal(sent.checksum, begun.checksum);
    assert.match(sent.checksum, /^[a-f0-9]{64}$/);
  } finally { stub.restore(); }
});

test('an approval chain holds it: the sheet must not say it is live', async () => {
  const stub = stubFetch((url) => url.endsWith('/api/v1/brand-pages')
    ? { status: 202, body: { page: { slug: 'acme' }, approvalId: 'apr_1' } }
    : { status: 200, body: { upload: { id: 'upl_1' } } });
  try {
    const result = await connectedInstanceFrom({ brandPages: { ...CAPABILITY, approval: true } }, true)!.brandPages!.publish({ bundle: new Uint8Array([1]) });
    assert.equal(result.state, 'pending');
  } finally { stub.restore(); }
});

test('the same digest again reads as unchanged, and a refusal keeps the instance\'s own words', async () => {
  let refuse = false;
  const stub = stubFetch((url) => {
    if (!url.endsWith('/api/v1/brand-pages')) return { status: 200, body: { upload: { id: 'upl_1' } } };
    return refuse ? { status: 409, body: { error: { code: 'BRAND_PAGE_PENDING', message: 'A revision of this page is waiting for approval.' } } } : { status: 200, body: { page: { slug: 'acme' }, unchanged: true } };
  });
  try {
    const hosting = connectedInstanceFrom({ brandPages: CAPABILITY }, true)!.brandPages!;
    assert.equal((await hosting.publish({ bundle: new Uint8Array([1]) })).state, 'unchanged');
    refuse = true;
    await assert.rejects(hosting.publish({ bundle: new Uint8Array([1]) }), /waiting for approval/);
  } finally { stub.restore(); }
});
