// SPDX-License-Identifier: MPL-2.0
/**
 * "Allow pages from any site" (plan 288 D2 option c): the server probe, the paths, the
 * reload address and the index.html gate that enforces the device's choice.
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/any-site.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { ANY_SITE_KEY, anySiteTarget, appPathname, onAnySitePath, probeAnySite } from './any-site.ts';

const hosted = JSON.parse(readFileSync(new URL('../../../../vercel.json', import.meta.url), 'utf8')) as {
  headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
};
const cspOf = (i: number): string => hosted.headers[i]!.headers.find((h) => h.key === 'Content-Security-Policy')!.value;

function fakeFetch(status: number, headers: Record<string, string>): typeof fetch {
  return (async (url: string, init?: RequestInit) => {
    assert.equal(url, '/any-site/');
    assert.equal(init?.method, 'HEAD');
    return new Response(null, { status, headers });
  }) as unknown as typeof fetch;
}

test('the probe reads the server\'s own policy for /any-site/', async () => {
  assert.equal(await probeAnySite(fakeFetch(200, { 'content-type': 'text/html', 'content-security-policy': cspOf(1) })), 'offered');
  assert.equal(await probeAnySite(fakeFetch(200, { 'content-type': 'text/html', 'content-security-policy': cspOf(0) })), 'not-offered',
    'a deployment serving the hosted policy there has not added the path');
  assert.equal(await probeAnySite(fakeFetch(200, { 'content-type': 'text/html' })), 'offered', 'no policy restricts no frames');
  assert.equal(await probeAnySite(fakeFetch(404, { 'content-type': 'text/html' })), 'not-offered');
  assert.equal(await probeAnySite(fakeFetch(200, { 'content-type': 'application/json' })), 'not-offered');
  assert.equal(await probeAnySite(fakeFetch(200, { 'content-type': 'text/html', 'content-security-policy': "default-src 'self' https:" })), 'offered',
    'without frame-src, default-src decides');
  const offline = (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
  assert.equal(await probeAnySite(offline), 'unreachable');
});

test('the /any-site prefix is the shell, and never part of a route or a shared link', () => {
  assert.equal(onAnySitePath('/any-site/'), true);
  assert.equal(onAnySitePath('/any-site'), true);
  assert.equal(onAnySitePath('/any-sitex'), false);
  assert.equal(onAnySitePath('/'), false);
  assert.equal(appPathname('/any-site/'), '/');
  assert.equal(appPathname('/any-site'), '/');
  assert.equal(appPathname('/t/design'), '/t/design');
  assert.equal(appPathname('/any-sitex'), '/any-sitex');
});

test('the reload address keeps the view, turns a /t/ tool path into its hash route, and adds present once', () => {
  assert.equal(anySiteTarget({ pathname: '/', search: '', hash: '#/profile' }), '/any-site/#/profile');
  assert.equal(anySiteTarget({ pathname: '/t/design', search: '?z=1abc', hash: '' }), '/any-site/#/tool/design?z=1abc');
  assert.equal(anySiteTarget({ pathname: '/design', search: '', hash: '' }), '/any-site/#/tool/design');
  assert.equal(anySiteTarget({ pathname: '/t/design', search: '?z=1abc', hash: '' }, 'present'), '/any-site/#/tool/design?z=1abc&present');
  assert.equal(anySiteTarget({ pathname: '/', search: '', hash: '#/tool/design?present' }, 'present'), '/any-site/#/tool/design?present');
  assert.equal(anySiteTarget({ pathname: '/', search: '', hash: '' }, 'present'), '/any-site/#/?present');
});

/** Run the first inline script of index.html against a fake location and storage. */
function runGate(pathname: string, opts: { chosen?: boolean; storageThrows?: boolean; search?: string; hash?: string; framed?: boolean } = {}): string | null {
  return runGateFull(pathname, opts).replaced;
}
function runGateFull(pathname: string, opts: { chosen?: boolean; storageThrows?: boolean; search?: string; hash?: string; framed?: boolean } = {}): { replaced: string | null; stamped: boolean } {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const first = /<script>([\s\S]*?)<\/script>/.exec(html)![1]!;
  let replaced: string | null = null;
  const location = { hostname: 'lolly.tools', pathname, search: opts.search ?? '', hash: opts.hash ?? '', replace: (u: string) => { replaced = u; } };
  const localStorage = {
    getItem: (k: string) => {
      if (opts.storageThrows) throw new Error('blocked');
      return k === ANY_SITE_KEY && opts.chosen ? '1' : null;
    },
  };
  const window: Record<string, unknown> = {};
  window.parent = opts.framed ? {} : window;
  const attrs = new Set<string>();
  const document = { documentElement: { setAttribute: (name: string) => { attrs.add(name); } } };
  runInNewContext(first, { location, localStorage, window, document });
  return { replaced, stamped: attrs.has('data-lolly-any-site') };
}

test('index.html enforces the choice before anything else runs', () => {
  assert.equal(runGate('/any-site/', { hash: '#/tool/design' }), '/#/tool/design', 'a link alone cannot opt anyone in');
  assert.equal(runGate('/any-site/', { storageThrows: true }), '/', 'unreadable storage fails closed');
  assert.equal(runGate('/any-site/', { chosen: true }), null, 'with the choice, the wider shell stays');
  assert.equal(runGate('/', { chosen: true, hash: '#/profile' }), '/any-site/#/profile', 'with the choice, the root moves there');
  assert.equal(runGate('/design', { chosen: true, search: '?z=1a' }), '/any-site/design?z=1a', 'and so does any app path, which routes without the prefix');
  assert.equal(runGate('/any-site/design', { search: '?z=1a' }), '/design?z=1a', 'without the choice the prefix comes off and the route stays');
  assert.equal(runGate('/', { chosen: true, hash: '#/tool/sandbox?html=x&iframe' }), null, 'a framed tool stays under the hosted policy');
  assert.equal(runGate('/', { chosen: true, framed: true }), null);
  assert.equal(runGate('/', {}), null);
  assert.equal(runGateFull('/any-site/', { chosen: true }).stamped, true, 'the app reads the stamp, not the address bar');
  assert.equal(runGateFull('/any-site/', {}).stamped, false);
  assert.equal(runGateFull('/', { chosen: true }).stamped, false);
});
