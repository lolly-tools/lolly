// SPDX-License-Identifier: MPL-2.0
/**
 * lib/add-via-url.ts - the shell-aware image-URL fetcher shared by the asset
 * picker and the catalogue. The behaviour under test is WHICH path each shell
 * uses: a data: URI and a same-origin URL fetch directly; a deployed web PWA
 * routes an arbitrary remote image through the same-origin /api/fetch-image
 * proxy; a Tauri build fetches any origin directly. Plus the error surface -
 * non-image, a proxy {error} JSON, a bad scheme.
 *
 * Run directly:  node --test shells/web/src/lib/add-via-url.test.ts
 *
 * jsdom gives a real https://lolly.tools origin (so the default is the
 * deployed-web branch); fetch is a controllable stub, so nothing hits the wire.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'location', { value: dom.window.location, configurable: true });

const { fetchImageUrlAsFile, looksLikeImageUrl, AddViaUrlError, IMAGE_PROXY_PATH } = await import('./add-via-url.ts');

type Plan = (url: string) => Response;
let plan: Plan = () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'image/png' } });
const calls: string[] = [];
globalThis.fetch = (async (input: string | URL | Request) => { const u = String(input); calls.push(u); return plan(u); }) as typeof fetch;

function reset(nextPlan?: Plan): void { calls.length = 0; delete (globalThis.window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__; if (nextPlan) plan = nextPlan; }

test('looksLikeImageUrl accepts http(s) and data:image, rejects a plain search', () => {
  assert.equal(looksLikeImageUrl('https://x.example/a.png'), true);
  assert.equal(looksLikeImageUrl('  http://x.example/a.png'), true);
  assert.equal(looksLikeImageUrl('data:image/png;base64,AAAA'), true);
  assert.equal(looksLikeImageUrl('logo'), false);
  assert.equal(looksLikeImageUrl('ftp://x/a.png'), false);
});

test('a data: URI is fetched directly (never the proxy)', async () => {
  reset(() => new Response(new Uint8Array([1]), { status: 200, headers: { 'content-type': 'image/gif' } }));
  const f = await fetchImageUrlAsFile('data:image/gif;base64,AAAA');
  assert.ok(f instanceof File);
  assert.equal(calls.length, 1);
  assert.match(calls[0]!, /^data:image\/gif/);
});

test('deployed web: an arbitrary remote image routes through the same-origin proxy', async () => {
  reset(() => new Response(new Uint8Array([1, 2]), { status: 200, headers: { 'content-type': 'image/png' } }));
  const f = await fetchImageUrlAsFile('https://elsewhere.example/photo.png');
  assert.ok(f instanceof File);
  assert.equal(calls.length, 1);
  assert.ok(calls[0]!.startsWith(`${IMAGE_PROXY_PATH}?url=`), 'went through the proxy');
  assert.match(calls[0]!, /elsewhere\.example/);
  assert.equal(f.name, 'photo.png');
});

test('a same-origin URL is fetched directly, not proxied', async () => {
  reset(() => new Response(new Uint8Array([1]), { status: 200, headers: { 'content-type': 'image/webp' } }));
  await fetchImageUrlAsFile('https://lolly.tools/catalog/x.webp');
  assert.equal(calls.length, 1);
  assert.equal(calls[0], 'https://lolly.tools/catalog/x.webp');
});

test('Tauri fetches any origin directly (no proxy)', async () => {
  reset(() => new Response(new Uint8Array([1]), { status: 200, headers: { 'content-type': 'image/png' } }));
  (globalThis.window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
  await fetchImageUrlAsFile('https://elsewhere.example/a.png');
  assert.equal(calls.length, 1);
  assert.equal(calls[0], 'https://elsewhere.example/a.png');
});

test('a non-image response is a clear error', async () => {
  reset(() => new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } }));
  await assert.rejects(fetchImageUrlAsFile('https://elsewhere.example/login'), (e: unknown) => e instanceof AddViaUrlError && /not an image/i.test((e as Error).message));
});

test("a proxy {error} JSON is surfaced verbatim", async () => {
  reset(() => new Response(JSON.stringify({ error: 'That address is not reachable from here.' }), { status: 422, headers: { 'content-type': 'application/json' } }));
  await assert.rejects(fetchImageUrlAsFile('https://elsewhere.example/a.png'), (e: unknown) => e instanceof AddViaUrlError && /not reachable/i.test((e as Error).message));
});

test('a non-http(s) scheme is rejected before any fetch', async () => {
  reset();
  await assert.rejects(fetchImageUrlAsFile('ftp://x.example/a.png'), (e: unknown) => e instanceof AddViaUrlError);
  assert.equal(calls.length, 0);
});

test('anyType (Verify) accepts a non-image file where the shell fetches directly', async () => {
  reset(() => new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), { status: 200, headers: { 'content-type': 'application/pdf' } }));
  const f = await fetchImageUrlAsFile('https://lolly.tools/docs/report.pdf', { anyType: true });
  assert.equal(f.name, 'report.pdf');
  assert.equal(f.type, 'application/pdf');
  assert.equal(calls[0], 'https://lolly.tools/docs/report.pdf');
});

test('anyType still routes a remote address through the image proxy on the deployed web', async () => {
  reset(() => new Response(JSON.stringify({ error: 'Only images can be fetched.' }), { status: 415, headers: { 'content-type': 'application/json' } }));
  await assert.rejects(fetchImageUrlAsFile('https://elsewhere.example/a.pdf', { anyType: true }), (e: unknown) => e instanceof AddViaUrlError && /only images/i.test((e as Error).message));
  assert.ok(calls[0]!.startsWith(`${IMAGE_PROXY_PATH}?url=`));
});
