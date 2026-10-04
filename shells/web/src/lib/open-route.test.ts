// SPDX-License-Identifier: MPL-2.0
/**
 * lib/open-route.ts - which `#/open?lolly=` sources the route will fetch (plan 291 W8).
 * A same-origin path and a blob: URL of this origin are allowed; data:, javascript:,
 * protocol-relative `//host`, a backslash form a browser reads as `//`, and every other
 * origin are refused before any request is made. The mount is checked against a stub
 * fetch: a refused source never reaches the network, and the address is replaced first.
 *
 * Run directly:  node --test shells/web/src/lib/open-route.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const ORIGIN = 'https://lolly.tools';
const dom = new JSDOM('<!doctype html><html><body><div id="view"></div></body></html>', { url: `${ORIGIN}/#/open` });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'location', { value: dom.window.location, configurable: true });
Object.defineProperty(globalThis, 'history', { value: dom.window.history, configurable: true });

const { openRouteSource, runOpenRoute, OPEN_ROUTE_PARAM } = await import('./open-route.ts');

test('a same-origin path is allowed, with its file name', () => {
  const got = openRouteSource('/files/My%20deck.lolly?v=2', ORIGIN);
  assert.deepEqual(got, { ok: true, kind: 'path', url: '/files/My%20deck.lolly?v=2', name: 'My deck.lolly' });
});

test('a path with no file name opens under a plain default name', () => {
  const got = openRouteSource('/share/', ORIGIN);
  assert.equal(got.ok && got.name, 'shared.lolly');
});

test('a blob: URL minted by this origin is allowed', () => {
  const raw = `blob:${ORIGIN}/6f1c2c1e-2a9e-4b8e-9d1f-0c1d2e3f4a5b`;
  assert.deepEqual(openRouteSource(raw, ORIGIN), { ok: true, kind: 'blob', url: raw, name: 'shared.lolly' });
});

test('every source that leaves this origin is refused', () => {
  for (const raw of [
    'data:application/zip;base64,UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==',
    'javascript:alert(1)',
    '//evil.example/x.lolly',
    '/\\evil.example/x.lolly',
    '\\\\evil.example\\x.lolly',
    'https://evil.example/x.lolly',
    `${ORIGIN}/x.lolly`,
    'x.lolly',
    '../x.lolly',
    'blob:https://evil.example/6f1c2c1e-2a9e-4b8e-9d1f-0c1d2e3f4a5b',
    'blob:null/6f1c2c1e',
    'blob:not a url',
    '/x.lolly\n',
    '/x\u0000.lolly',
    // Dot segments the parser resolves into a protocol-relative `//host` path.
    '/.//evil.example/x.lolly',
    '/a/..//evil.example/x.lolly',
    '/%2e//evil.example/x.lolly',
    '/%2E%2E//evil.example/x.lolly',
    '/a/b/../..//evil.example/x.lolly',
  ]) {
    assert.deepEqual(openRouteSource(raw, ORIGIN), { ok: false, reason: 'refused' }, raw);
  }
});

test('no source is missing, not refused', () => {
  for (const raw of [null, undefined, '', '   ']) {
    assert.deepEqual(openRouteSource(raw, ORIGIN), { ok: false, reason: 'missing' });
  }
});

test('a refused source is never fetched, and the address is replaced first', async () => {
  const calls: string[] = [];
  globalThis.fetch = (async (input: string) => { calls.push(String(input)); throw new Error('no network'); }) as typeof fetch;
  dom.window.location.hash = `#/open?${OPEN_ROUTE_PARAM}=${encodeURIComponent('//evil.example/x.lolly')}`;
  const view = document.getElementById('view')!;
  await runOpenRoute(view, {}, `${OPEN_ROUTE_PARAM}=${encodeURIComponent('//evil.example/x.lolly')}`);
  assert.deepEqual(calls, []);
  assert.equal(dom.window.location.hash, '#/open');
  assert.equal(view.querySelector('[data-open-route]')?.getAttribute('data-open-route'), 'failed');
});

test('a same-origin source that cannot be read says so and opens nothing', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: string, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new dom.window.Response('', { status: 404 }) as unknown as Response;
  }) as typeof fetch;
  const view = document.getElementById('view')!;
  await runOpenRoute(view, {}, `${OPEN_ROUTE_PARAM}=${encodeURIComponent('/missing.lolly')}`);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, `${ORIGIN}/missing.lolly`);
  assert.equal(calls[0]!.init?.redirect, 'error');
  assert.equal(calls[0]!.init?.credentials, 'same-origin');
  assert.equal(view.querySelector('[data-open-route]')?.getAttribute('data-open-route'), 'failed');
});

test('a dot-segment source that collapses to //host is never fetched', async () => {
  const calls: string[] = [];
  globalThis.fetch = (async (input: string) => { calls.push(String(input)); throw new Error('no network'); }) as typeof fetch;
  const view = document.getElementById('view')!;
  for (const raw of ['/.//evil.example/x.lolly', '/a/..//evil.example/x.lolly', '/%2e//evil.example/x.lolly']) {
    await runOpenRoute(view, {}, `${OPEN_ROUTE_PARAM}=${encodeURIComponent(raw)}`);
    assert.equal(view.querySelector('[data-open-route]')?.getAttribute('data-open-route'), 'failed', raw);
  }
  assert.deepEqual(calls, []);
});

test('a dot segment that stays on this origin is fetched as an absolute same-origin URL', async () => {
  const calls: string[] = [];
  globalThis.fetch = (async (input: string) => {
    calls.push(String(input));
    return new dom.window.Response('', { status: 404 }) as unknown as Response;
  }) as typeof fetch;
  const view = document.getElementById('view')!;
  await runOpenRoute(view, {}, `${OPEN_ROUTE_PARAM}=${encodeURIComponent('/a/../files/./x.lolly')}`);
  assert.deepEqual(calls, [`${ORIGIN}/files/x.lolly`]);
  assert.equal(new URL(calls[0]!).origin, ORIGIN);
});
