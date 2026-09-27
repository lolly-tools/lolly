// SPDX-License-Identifier: MPL-2.0
/**
 * Root discovery files on lolly.tools (plan 277, decision D2), held without a network.
 *
 *   - shells/web/public/robots-lolly-tools.txt allows every crawler and points at the
 *     /info sitemap, with no Disallow line. Blocking /tool/, /api/ or /t/ would stop a
 *     crawler from ever reading the noindex header that docs/privacy.md promises.
 *   - No shells/web/public/robots.txt exists: the same dist ships in Docker, the RPM,
 *     YunoHost and Tauri, and a self-hosted build must not advertise the lolly.tools
 *     sitemap at its own root. vercel.json alone serves the file as /robots.txt.
 *   - That rewrite, and the permanent /sitemap.xml redirect, sit where Vercel reaches
 *     them before the SPA catch-all.
 *   - scripts/check-discovery-routes.ts classifies a 200 text/html answer (the app
 *     shell) as a failure and accepts the real files.
 *
 * Run directly: node --test tests/discovery-routes.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BODY_LIMIT, DISCOVERY_ROUTES, ROBOTS_SITEMAP_LINE, classifyDiscoveryResponse, probeDiscoveryRoutes,
  type DiscoveryKind, type DiscoveryRoute,
} from '../scripts/check-discovery-routes.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROBOTS_FILE = 'shells/web/public/robots-lolly-tools.txt';
const ROBOTS_TEXT = readFileSync(resolve(ROOT, ROBOTS_FILE), 'utf8');
const APP_SHELL = '<!DOCTYPE html>\n<html lang="en" data-theme="light">\n<head>\n  <meta charset="UTF-8" />\n';
const SITEMAP_HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n';

interface Rule { source: string; destination: string; permanent?: boolean; has?: unknown }
const vercel = JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf8')) as { rewrites: Rule[]; redirects: Rule[] };

function route(kind: DiscoveryKind): DiscoveryRoute {
  const r = DISCOVERY_ROUTES.find((x) => x.kind === kind);
  assert.ok(r, `no ${kind} route`);
  return r;
}

// The robots file

test('the lolly.tools robots file is exactly allow-all plus the /info sitemap', () => {
  assert.equal(ROBOTS_TEXT, 'User-agent: *\nAllow: /\n\nSitemap: https://lolly.tools/info/sitemap.xml\n');
  assert.doesNotMatch(ROBOTS_TEXT, /^\s*disallow\s*:/im, 'no Disallow line of any kind');
  assert.ok(ROBOTS_TEXT.split('\n').includes(ROBOTS_SITEMAP_LINE), 'the probe expects the Sitemap line the file carries');
});

test('no root robots.txt ships in the shared dist', () => {
  assert.equal(existsSync(resolve(ROOT, 'shells/web/public/robots.txt')), false,
    'shells/web/public/robots.txt would be served by every self-hosted build; serve robots only through the vercel.json rewrite');
});

test('the service worker precache skips the robots file', () => {
  const vite = readFileSync(resolve(ROOT, 'shells/web/vite.config.js'), 'utf8');
  const skip = vite.match(/const SKIP = new Set\(\[([^\]]*)\]\)/);
  assert.ok(skip, 'precacheManifest SKIP set not found in shells/web/vite.config.js');
  assert.match(skip[1]!, /'robots-lolly-tools\.txt'/);
});

// vercel.json

test('vercel.json rewrites /robots.txt to the robots file before the catch-all', () => {
  const catchAll = vercel.rewrites.findIndex((r) => r.destination === '/index.html');
  assert.ok(catchAll >= 0, 'the SPA catch-all rewrite exists');
  const i = vercel.rewrites.findIndex((r) => r.source === '/robots.txt');
  assert.ok(i >= 0, 'vercel.json has no /robots.txt rewrite');
  assert.equal(vercel.rewrites[i]!.destination, '/robots-lolly-tools.txt');
  assert.equal(vercel.rewrites[i]!.has, undefined, 'unconditional, so the preview the ship probe checks answers it too');
  assert.ok(i < catchAll, '/robots.txt must precede the catch-all or the app shell answers it');
  assert.ok(existsSync(resolve(ROOT, 'shells/web/public', vercel.rewrites[i]!.destination.slice(1))), 'the rewrite target exists in public/');
});

test('vercel.json redirects the root /sitemap.xml permanently to the /info sitemap', () => {
  const matches = vercel.redirects.filter((r) => r.source === '/sitemap.xml');
  assert.equal(matches.length, 1, 'exactly one /sitemap.xml redirect');
  const r = matches[0]!;
  assert.equal(r.destination, '/info/sitemap.xml');
  assert.equal(r.permanent, true);
  assert.equal(r.has, undefined);
});

// The probe's classifier

test('the probe covers every discovery route', () => {
  assert.deepEqual(DISCOVERY_ROUTES.map((r) => r.path).sort(), [
    '/info/sitemap.xml', '/info/start/quickstart.md', '/llms.txt', '/robots.txt', '/sitemap.xml',
  ]);
});

test('a 200 text/html answer is the app shell and fails on every route', () => {
  for (const r of DISCOVERY_ROUTES) {
    for (const body of [undefined, APP_SHELL]) {
      const problems = classifyDiscoveryResponse(r, { status: 200, contentType: 'text/html; charset=utf-8', body });
      assert.equal(problems.length, 1, `${r.path} (${body ? 'GET' : 'HEAD'})`);
      assert.match(problems[0]!, /app shell/);
    }
  }
});

test('an HTML body under a plain-text type still fails', () => {
  const problems = classifyDiscoveryResponse(route('text'), { status: 200, contentType: 'text/plain', body: APP_SHELL });
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /HTML page/);
});

test('deployment protection fails with the bypass hint', () => {
  const problems = classifyDiscoveryResponse(route('robots'), { status: 401, contentType: 'text/html' });
  assert.match(problems.join('\n'), /VERCEL_AUTOMATION_BYPASS_SECRET/);
});

test('robots: accepts the real file, refuses a missing Sitemap or User-agent line', () => {
  const r = route('robots');
  assert.deepEqual(classifyDiscoveryResponse(r, { status: 200, contentType: 'text/plain; charset=utf-8' }), []);
  assert.deepEqual(classifyDiscoveryResponse(r, { status: 200, contentType: 'text/plain; charset=utf-8', body: ROBOTS_TEXT }), []);
  assert.match(classifyDiscoveryResponse(r, { status: 200, contentType: 'text/plain', body: 'User-agent: *\nAllow: /\n' }).join('\n'), /Sitemap/);
  assert.match(classifyDiscoveryResponse(r, { status: 200, contentType: 'text/plain', body: `${ROBOTS_SITEMAP_LINE}\n` }).join('\n'), /User-agent/);
  assert.match(classifyDiscoveryResponse(r, { status: 404, contentType: 'text/plain', body: 'The page could not be found' }).join('\n'), /HTTP 404/);
});

test('sitemap: accepts XML that opens with <?xml and a <urlset, refuses the wrong type or shape', () => {
  const r = route('sitemap');
  assert.deepEqual(classifyDiscoveryResponse(r, { status: 200, contentType: 'application/xml', body: SITEMAP_HEAD }), []);
  assert.deepEqual(classifyDiscoveryResponse(r, { status: 200, contentType: 'text/xml; charset=utf-8', body: SITEMAP_HEAD }), []);
  assert.match(classifyDiscoveryResponse(r, { status: 200, contentType: 'text/plain', body: SITEMAP_HEAD }).join('\n'), /Content-Type/);
  assert.match(classifyDiscoveryResponse(r, { status: 200, contentType: 'application/xml', body: `\n${SITEMAP_HEAD}` }).join('\n'), /<\?xml/);
  assert.match(classifyDiscoveryResponse(r, { status: 200, contentType: 'application/xml', body: '<?xml version="1.0"?>\n<sitemapindex>' }).join('\n'), /<urlset/);
});

test('llms.txt and the Markdown twin: accept their own types only', () => {
  assert.deepEqual(classifyDiscoveryResponse(route('text'), { status: 200, contentType: 'text/plain; charset=utf-8', body: '# Lolly\n' }), []);
  assert.deepEqual(classifyDiscoveryResponse(route('markdown'), { status: 200, contentType: 'text/markdown; charset=utf-8', body: '# Quickstart\n' }), []);
  assert.match(classifyDiscoveryResponse(route('markdown'), { status: 200, contentType: 'text/plain', body: '# Quickstart\n' }).join('\n'), /text\/markdown/);
  assert.match(classifyDiscoveryResponse(route('text'), { status: 200, contentType: 'application/octet-stream' }).join('\n'), /text\/plain/);
});

test('root sitemap: accepts a permanent redirect to /info/sitemap.xml only', () => {
  const r = route('redirect');
  assert.deepEqual(classifyDiscoveryResponse(r, { status: 308, contentType: '', location: '/info/sitemap.xml' }), []);
  assert.deepEqual(classifyDiscoveryResponse(r, { status: 301, contentType: '', location: 'https://lolly.tools/info/sitemap.xml' }), []);
  assert.match(classifyDiscoveryResponse(r, { status: 302, contentType: '', location: '/info/sitemap.xml' }).join('\n'), /permanent/);
  assert.match(classifyDiscoveryResponse(r, { status: 308, contentType: '', location: '/' }).join('\n'), /Location/);
});

// The probe loop, over an injected fetch (no sockets)

test('the probe sends HEAD then a bounded GET, with the bypass header and no redirect following', async () => {
  const calls: Array<{ path: string; method: string; redirect: string | undefined; bypass: string | undefined }> = [];
  let sitemapPulls = 0;
  const bigSitemap = (): ReadableStream<Uint8Array> => {
    const enc = new TextEncoder();
    let first = true;
    return new ReadableStream<Uint8Array>({
      pull(controller) {
        sitemapPulls++;
        controller.enqueue(enc.encode(first ? SITEMAP_HEAD : '  <url><loc>https://lolly.tools/info/x.html</loc></url>\n'.repeat(64)));
        first = false;
      },
    });
  };
  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    const method = init?.method ?? 'GET';
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ path, method, redirect: init?.redirect, bypass: headers['x-vercel-protection-bypass'] });
    const body = (text: string) => (method === 'HEAD' ? null : text);
    switch (path) {
      case '/robots.txt': return new Response(body(ROBOTS_TEXT), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
      case '/info/sitemap.xml': return new Response(method === 'HEAD' ? null : bigSitemap(), { headers: { 'content-type': 'application/xml' } });
      case '/sitemap.xml': return new Response(null, { status: 308, headers: { location: '/info/sitemap.xml' } });
      case '/llms.txt': return new Response(body('# Lolly\n'), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
      case '/info/start/quickstart.md': return new Response(body('# Quickstart\n'), { headers: { 'content-type': 'text/markdown; charset=utf-8' } });
      default: return new Response(body(APP_SHELL), { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
  }) as typeof fetch;

  const results = await probeDiscoveryRoutes('https://preview.example', { bypass: ' secret ', fetchImpl: fakeFetch });
  assert.deepEqual(results.filter((r) => r.problems.length), [], 'every route passes');
  assert.ok(calls.every((c) => c.redirect === 'manual'), 'redirects are never followed');
  assert.ok(calls.every((c) => c.bypass === 'secret'), 'the bypass header goes on every request');
  assert.deepEqual(calls.filter((c) => c.path === '/sitemap.xml').map((c) => c.method), ['HEAD'], 'the redirect gets a HEAD only');
  assert.deepEqual(calls.filter((c) => c.path === '/robots.txt').map((c) => c.method), ['HEAD', 'GET']);
  // The fake sitemap never ends, so an unbounded read would hang here. Each pull after
  // the first is about 3.6 KB, so BODY_LIMIT is reached within a handful of pulls.
  assert.ok(sitemapPulls <= Math.ceil(BODY_LIMIT / 3600) + 3, `read ${sitemapPulls} chunks of an endless sitemap`);

  const broken = (async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (path === '/robots.txt') return new Response(init?.method === 'HEAD' ? null : APP_SHELL, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    return fakeFetch(input, init);
  }) as typeof fetch;
  const bad = await probeDiscoveryRoutes('https://preview.example', { fetchImpl: broken });
  assert.deepEqual(bad.filter((r) => r.problems.length).map((r) => r.path), ['/robots.txt']);
  assert.ok(bad[0]!.problems.every((p) => /app shell/.test(p)));
});
