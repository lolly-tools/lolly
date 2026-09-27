#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Discovery route probe: after a deploy, check that the files crawlers and agents
 * ask for by name come back as those files and not as the app.
 *
 * WHY THIS EXISTS
 * vercel.json ends with a catch-all rewrite that sends every path without a static
 * file to /index.html. A missing /robots.txt therefore does not 404: it answers
 * 200 text/html with the 34 KB app shell, and a crawler reads that page as its
 * robots file. That was the live state of lolly.tools until plan 277 (decision D2)
 * added a rewrite to shells/web/public/robots-lolly-tools.txt. Nothing looked at
 * responses, so this probe runs between the preview deploy and the promote in
 * scripts/ship.ts, beside the first-load check.
 *
 * Usage: node scripts/check-discovery-routes.ts <base-url>
 *
 * VERCEL_AUTOMATION_BYPASS_SECRET, when set, goes out as the
 * x-vercel-protection-bypass header on every request, as scripts/check-deployment-live.ts
 * sends it, so a preview behind deployment protection can be probed. Redirects are
 * never followed: a sign-in redirect must fail here, and the root /sitemap.xml check
 * needs to see the redirect itself.
 *
 * Each route gets a HEAD, then (except the redirect) a GET that reads at most
 * BODY_LIMIT bytes and cancels the rest. /info/sitemap.xml is over 16 MB, and its
 * first line is all this needs.
 */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

/** The Sitemap line shells/web/public/robots-lolly-tools.txt carries (plan 277 D2). */
export const ROBOTS_SITEMAP_LINE = 'Sitemap: https://lolly.tools/info/sitemap.xml';

/** How much of each body the GET reads before it cancels. */
export const BODY_LIMIT = 8192;

export type DiscoveryKind = 'robots' | 'sitemap' | 'text' | 'markdown' | 'redirect';

export interface DiscoveryRoute {
  path: string;
  kind: DiscoveryKind;
}

export const DISCOVERY_ROUTES: readonly DiscoveryRoute[] = [
  { path: '/robots.txt', kind: 'robots' },
  { path: '/info/sitemap.xml', kind: 'sitemap' },
  { path: '/sitemap.xml', kind: 'redirect' },
  { path: '/llms.txt', kind: 'text' },
  { path: '/info/start/quickstart.md', kind: 'markdown' },
];

/** Where the root /sitemap.xml must point (a permanent redirect in vercel.json). */
export const SITEMAP_REDIRECT_PATH = '/info/sitemap.xml';

/** What the classifier needs from one response. `body` is absent for a HEAD. */
export interface ProbeResponse {
  status: number;
  contentType: string;
  location?: string | null;
  body?: string | null;
}

const MIME: Record<Exclude<DiscoveryKind, 'redirect'>, { test: RegExp; want: string }> = {
  robots: { test: /^text\/plain\b/i, want: 'text/plain' },
  sitemap: { test: /^(?:application|text)\/xml\b/i, want: 'application/xml' },
  text: { test: /^text\/plain\b/i, want: 'text/plain' },
  markdown: { test: /^text\/markdown\b/i, want: 'text/markdown' },
};

function looksLikeHtml(body: string): boolean {
  return /^\s*(?:<!doctype html|<html[\s>])/i.test(body);
}

/**
 * Every problem with one response to one route; an empty list means it passed.
 * Pure, so tests/discovery-routes.test.ts can hold it without a network.
 */
export function classifyDiscoveryResponse(route: DiscoveryRoute, res: ProbeResponse): string[] {
  const problems: string[] = [];
  const type = (res.contentType || '').trim();
  const body = res.body ?? null;

  if (res.status === 401 || res.status === 403) {
    return [`HTTP ${res.status}: deployment protection answered, not the site. Set VERCEL_AUTOMATION_BYPASS_SECRET.`];
  }
  if (res.status === 200 && /^text\/html\b/i.test(type)) {
    return [`200 ${type}: the app shell answered ${route.path} (a soft 404)`];
  }
  if (body !== null && looksLikeHtml(body)) {
    return [`the body is an HTML page (the app shell or an error page), not ${route.kind === 'markdown' ? 'Markdown' : route.kind}`];
  }

  if (route.kind === 'redirect') {
    if (res.status !== 301 && res.status !== 308) {
      problems.push(`HTTP ${res.status}: expected a permanent redirect (301 or 308)`);
    }
    let target = '';
    try { target = res.location ? new URL(res.location, 'https://probe.invalid').pathname : ''; } catch { target = ''; }
    if (target !== SITEMAP_REDIRECT_PATH) {
      problems.push(`Location ${res.location ? JSON.stringify(res.location) : '(none)'}: expected ${SITEMAP_REDIRECT_PATH}`);
    }
    return problems;
  }

  if (res.status !== 200) problems.push(`HTTP ${res.status}: expected 200`);
  const mime = MIME[route.kind];
  if (!mime.test.test(type)) problems.push(`Content-Type ${type ? JSON.stringify(type) : '(none)'}: expected ${mime.want}`);
  if (body === null) return problems;

  if (route.kind === 'robots') {
    const lines = body.split(/\r?\n/).map((l) => l.trim());
    if (!lines.some((l) => /^user-agent\s*:\s*\S/i.test(l))) problems.push('no User-agent line');
    if (!lines.includes(ROBOTS_SITEMAP_LINE)) problems.push(`no "${ROBOTS_SITEMAP_LINE}" line`);
  } else if (route.kind === 'sitemap') {
    if (!body.replace(/^﻿/, '').startsWith('<?xml')) problems.push('the body does not start with <?xml');
    if (!body.includes('<urlset')) problems.push(`no <urlset in the first ${BODY_LIMIT} bytes`);
  }
  return problems;
}

/** Read at most `limit` bytes of a body, then cancel the rest of the stream. */
async function readHead(res: Response, limit: number): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (size < limit) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { all.set(c, at); at += c.byteLength; }
  return new TextDecoder().decode(all.subarray(0, limit));
}

export interface RouteResult {
  path: string;
  problems: string[];
}

export interface ProbeOptions {
  bypass?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** Probe every discovery route under `base`. Never throws: a network error is a problem. */
export async function probeDiscoveryRoutes(base: string, opts: ProbeOptions = {}): Promise<RouteResult[]> {
  const doFetch = opts.fetchImpl ?? fetch;
  const headers: Record<string, string> = {};
  if (opts.bypass?.trim()) headers['x-vercel-protection-bypass'] = opts.bypass.trim();
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const results: RouteResult[] = [];

  for (const route of DISCOVERY_ROUTES) {
    const url = new URL(route.path, base).href;
    const problems: string[] = [];
    try {
      const head = await doFetch(url, { method: 'HEAD', redirect: 'manual', headers, signal: AbortSignal.timeout(timeoutMs) });
      for (const p of classifyDiscoveryResponse(route, {
        status: head.status, contentType: head.headers.get('content-type') ?? '', location: head.headers.get('location'),
      })) problems.push(`HEAD ${p}`);

      if (route.kind !== 'redirect') {
        const get = await doFetch(url, { method: 'GET', redirect: 'manual', headers, signal: AbortSignal.timeout(timeoutMs) });
        const body = await readHead(get, BODY_LIMIT);
        for (const p of classifyDiscoveryResponse(route, {
          status: get.status, contentType: get.headers.get('content-type') ?? '', location: get.headers.get('location'), body,
        })) problems.push(`GET ${p}`);
      }
    } catch (e) {
      problems.push(`could not fetch: ${(e as Error).message}`);
    }
    results.push({ path: route.path, problems });
  }
  return results;
}

async function main(): Promise<void> {
  const arg = process.argv[2] ?? '';
  let base: URL;
  try {
    base = new URL(arg);
    if (base.protocol !== 'https:' && base.protocol !== 'http:') throw new Error('not http(s)');
  } catch {
    console.error('usage: node scripts/check-discovery-routes.ts <base-url>');
    process.exitCode = 2;
    return;
  }
  const results = await probeDiscoveryRoutes(base.origin, { bypass: process.env.VERCEL_AUTOMATION_BYPASS_SECRET });
  let failed = 0;
  for (const r of results) {
    if (!r.problems.length) { console.log(`  ok    ${r.path}`); continue; }
    failed++;
    console.error(`  FAIL  ${r.path}`);
    for (const p of r.problems) console.error(`          ${p}`);
  }
  if (failed) {
    console.error(`${failed} of ${results.length} discovery routes on ${base.origin} did not answer as themselves`);
    process.exitCode = 1;
  } else {
    console.log(`all ${results.length} discovery routes on ${base.origin} answered as themselves`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
