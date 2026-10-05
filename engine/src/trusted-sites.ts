// SPDX-License-Identifier: MPL-2.0
/**
 * Trusted sites (plan 288 section 5.3): the entries a person, a brand or an organisation
 * lists as "may be contacted without asking", and the one matcher every consumer shares
 * (the Sandbox's fetch-and-inline, a Design web page box, an organisation's block list).
 * Pure: no network, no clock, no storage.
 *
 * Three grammars:
 *   example.com                 that host only, on https
 *   *.example.com               the host and every subdomain, on https
 *   https://example.com/docs/   a URL prefix: that origin, at or under that path
 *
 * Only https, except http://localhost and http://127.0.0.1 on any port. No credentials,
 * no query or fragment, no wildcard except one leading `*.` over a name with a dot in
 * it, and hosts go through URL so an internationalised name matches its punycode form.
 *
 * Trust removes a question. It never widens a security header: a trusted site that the
 * app's Content-Security-Policy refuses stays refused.
 */

/** The most entries one list keeps. A longer list is truncated, not refused. */
export const TRUSTED_SITES_MAX = 500;

/** Reference sources offered by default. Personal removals and organisation blocks win. */
export const DEFAULT_REFERENCE_SITES = [
  '*.wikipedia.org', 'commons.wikimedia.org', 'upload.wikimedia.org',
  'www.wikidata.org', 'www.mediawiki.org', 'www.openstreetmap.org',
] as const;

const MAX_ENTRY = 2048;
const LOOPBACK = new Set(['localhost', '127.0.0.1']);
const HOST_RE = /^(?=.{1,253}$)[a-z0-9-]+(\.[a-z0-9-]+)*$/;

function isLoopbackHost(host: string): boolean {
  return LOOPBACK.has(host);
}

/** Whether a URL is one trust can apply to: https, or http on the loopback. */
function contactable(url: URL): boolean {
  if (url.username || url.password) return false;
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && isLoopbackHost(url.hostname);
}

function parse(text: string): URL | null {
  try { return new URL(text); } catch { return null; }
}

/** A bare host that is not a single label (`com`), except the loopback names. */
function plausibleHost(host: string): boolean {
  if (!HOST_RE.test(host)) return false;
  return host.includes('.') || isLoopbackHost(host);
}

/**
 * The stored form of one entry, or null when it is not one of the three grammars.
 * `Example.COM`, `https://example.com` and `https://example.com/` all store as
 * `example.com`; a path, a port or the loopback's http keep the prefix form.
 */
export function normaliseTrustedSite(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const text = input.trim();
  if (!text || text.length > MAX_ENTRY || /\s/.test(text)) return null;

  if (text.startsWith('*.')) {
    // A wildcard is one host and its subdomains, nothing else: no port (the URL parser drops `:443`),
    // no path, no credentials.
    if (/[/:?#@\\]/.test(text.slice(2).replace(/\/$/, ''))) return null;
    const url = parse(`https://${text.slice(2)}`);
    if (url?.pathname !== '/' || url.port || url.search || url.hash || url.username) return null;
    const host = url.hostname;
    if (!plausibleHost(host) || isLoopbackHost(host) || /^[\d.]+$/.test(host)) return null;
    return `*.${host}`;
  }

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text);
  if (!hasScheme && /^[a-z][a-z0-9+.-]*:/i.test(text) && !/^[^:/]+:\d/.test(text)) return null; // mailto:, javascript:
  const bareHost = hasScheme ? '' : (text.split(/[/:?#]/)[0] ?? '').toLowerCase();
  const url = parse(hasScheme ? text : `${isLoopbackHost(bareHost) ? 'http' : 'https'}://${text}`);
  if (!url || !contactable(url) || !plausibleHost(url.hostname)) return null;
  if (url.search || url.hash) return null;
  const pathOnly = url.pathname === '/';
  if (url.protocol === 'https:' && !url.port && pathOnly) return url.hostname;
  if (!hasScheme && isLoopbackHost(url.hostname) && !url.port && pathOnly) return url.hostname;
  return `${url.origin}${url.pathname}`;
}

/** Normalise a list: invalid entries dropped, duplicates kept once, order kept, capped. */
export function normaliseTrustedSites(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const entry = normaliseTrustedSite(item);
    if (!entry || seen.has(entry)) continue;
    seen.add(entry);
    out.push(entry);
    if (out.length >= TRUSTED_SITES_MAX) break;
  }
  return out;
}

function entryMatches(url: URL, entry: string): boolean {
  if (entry.startsWith('*.')) {
    const base = entry.slice(2);
    return url.protocol === 'https:' && (url.hostname === base || url.hostname.endsWith(`.${base}`));
  }
  if (entry.includes('://')) {
    const prefix = parse(entry);
    if (!prefix || prefix.origin !== url.origin) return false;
    const path = prefix.pathname;
    if (url.pathname === path) return true;
    // `/docs` covers `/docs/…` and not `/docs-private`.
    return url.pathname.startsWith(path.endsWith('/') ? path : `${path}/`);
  }
  if (isLoopbackHost(entry)) return url.hostname === entry;
  return url.protocol === 'https:' && url.hostname === entry;
}

/**
 * The first entry that covers `url`, or null. Returning the entry (not a boolean) lets
 * the UI say which rule decided. Entries are normalised here too, so a list read from a
 * profile or a policy that was never cleaned still matches only what its grammar means.
 */
export function matchTrustedSite(url: string, entries: readonly unknown[]): string | null {
  const target = parse(url);
  if (!target || !contactable(target)) return null;
  for (const raw of entries) {
    const entry = normaliseTrustedSite(raw);
    if (entry && entryMatches(target, entry)) return entry;
  }
  return null;
}

/** The host an entry is about, for display and for grouping rows: `*.example.com`
 *  and `https://example.com/docs/` both read as `example.com`. */
export function trustedSiteHost(entry: string): string {
  if (entry.startsWith('*.')) return entry.slice(2);
  if (entry.includes('://')) return parse(entry)?.host ?? entry;
  return entry;
}
