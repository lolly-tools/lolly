// SPDX-License-Identifier: MPL-2.0
/**
 * "Allow pages from any site" (plan 288, decision D2 option c): the web version's opt-in to
 * a wider frame policy.
 *
 * The hosted app's Content-Security-Policy lets a Design web page box frame only a few
 * video and map players, because a frame is also a way out: injected script could send
 * data anywhere through one. A person who needs other sites on their slides can opt in on
 * this device. The app then runs from `/any-site/`, a path every deployment that offers
 * this serves with the same policy except `frame-src`, which admits any https page and the
 * loopback (tests/security-headers.test.ts pins that). Nothing else loosens: `connect-src`
 * still stops a fetch to another site, and Lolly still asks before loading a site nobody
 * has trusted.
 *
 * The choice is a device preference (`lolly:any-site` in localStorage), never synced and
 * never readable by a tool: it decides which security policy this browser runs the app
 * under. The first inline script in index.html enforces it before anything else runs. A
 * visit under `/any-site` without the choice loses the prefix, so a link cannot opt
 * anyone in, and with the choice any app path gains the prefix (`/design` becomes
 * `/any-site/design`, which routes as `/design`). A framed instance stays where it is. When it lets the wider shell run, the gate stamps `data-lolly-any-site` on
 * <html>, which is what the app reads from then on. The service worker never stores the `/any-site/` document as the offline
 * shell, so turning the choice off really returns the narrower policy.
 */

import { sitePolicy } from './site-policy.ts';

export const ANY_SITE_PATH = '/any-site/';
export const ANY_SITE_KEY = 'lolly:any-site';

const ON_PATH = /^\/any-site(?=\/|$)/;

/** Whether a path is the `/any-site/` shell. */
export function onAnySitePath(pathname: string = location.pathname): boolean {
  return ON_PATH.test(pathname);
}

/** Whether this device chose to allow pages from any site. */
export function anySiteChosen(): boolean {
  try { return localStorage.getItem(ANY_SITE_KEY) === '1'; } catch { return false; }
}

/**
 * Whether the setting can mean anything here: the web app only (the desktop app frames
 * any https page already), and not under an organisation's `none` mode, where no outside
 * site loads at all. Under `allowlist-only` it stays: the wider frame policy is what lets
 * the organisation's own allowed sites show on the web version.
 */
export function anySiteApplies(): boolean {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) return false;
  return sitePolicy()?.mode !== 'none';
}

/**
 * Whether this document runs under the wider frame policy. Read from the attribute the
 * index.html gate stamps on <html> when it lets the `/any-site/` shell run, not from the
 * address bar: a tool view rewrites the bar to its own `/t/<id>` or `/design` link after
 * it mounts, while the document keeps the policy it was served with.
 */
export function anySiteActive(): boolean {
  return typeof document !== 'undefined' && document.documentElement.hasAttribute('data-lolly-any-site');
}

/** The address-bar path without the `/any-site` prefix: what routing reads, and what a
 *  link meant for someone else carries. */
export function appPathname(pathname: string = location.pathname): string {
  return pathname.replace(ON_PATH, '') || '/';
}

export type AnySiteOffer = 'offered' | 'not-offered' | 'unreachable';

/**
 * Whether this server serves `/any-site/` with a frame policy that admits any https page.
 * Read from the response's own Content-Security-Policy, so a deployment that has not
 * added the path (or an operator who removed it) is never sent there. A server that sends
 * no policy at all restricts no frames, so the path is offered.
 */
export async function probeAnySite(fetchImpl: typeof fetch = fetch): Promise<AnySiteOffer> {
  let res: Response;
  try {
    res = await fetchImpl(ANY_SITE_PATH, { method: 'HEAD', cache: 'no-store', credentials: 'same-origin' });
  } catch {
    return 'unreachable';
  }
  if (!res.ok || !/text\/html/i.test(res.headers.get('content-type') ?? 'text/html')) return 'not-offered';
  const csp = res.headers.get('content-security-policy');
  if (!csp) return 'offered';
  const frameSrc = csp.split(';').map((d) => d.trim().split(/\s+/)).find((d) => d[0] === 'frame-src');
  // A policy with no frame-src falls back to child-src, then default-src.
  const governing = frameSrc
    ?? csp.split(';').map((d) => d.trim().split(/\s+/)).find((d) => d[0] === 'child-src')
    ?? csp.split(';').map((d) => d.trim().split(/\s+/)).find((d) => d[0] === 'default-src');
  return governing?.slice(1).includes('https:') ? 'offered' : 'not-offered';
}

/**
 * The address to reload at under the wider policy: the same view, and for a tool shown at
 * its `/t/<id>` path, the same tool and query as a hash route (the shell is a single page
 * at `/any-site/`). `extraParam` joins the route's own query, for "present once loaded".
 */
export function anySiteTarget(loc: Pick<Location, 'pathname' | 'search' | 'hash'> = location, extraParam?: string): string {
  const path = appPathname(loc.pathname);
  const tool = /^\/t\/([^/?]+)$/.exec(path)?.[1] ?? (/^\/design\/?$/.test(path) ? 'design' : null);
  let search = loc.search;
  let hash = loc.hash;
  if (tool) {
    hash = `#/tool/${tool}${search ? `?${search.slice(1)}` : ''}`;
    search = '';
  }
  if (extraParam) {
    const q = hash.indexOf('?');
    const has = q >= 0 && new URLSearchParams(hash.slice(q + 1)).has(extraParam);
    if (!has) hash = hash ? (q >= 0 ? `${hash}&${extraParam}` : `${hash}?${extraParam}`) : `#/?${extraParam}`;
  }
  return `${ANY_SITE_PATH}${search}${hash}`;
}

/**
 * Navigate away to `url` and stay gone. A tool view keeps its address bar in step with
 * `history.replaceState`, and a same-document history write made before the new
 * document commits cancels the navigation, so the page's history writers stop first.
 */
function leaveFor(url: string): void {
  try {
    history.replaceState = () => {};
    history.pushState = () => {};
  } catch { /* a locked-down History: the navigation may still win */ }
  location.replace(url);
}

/** Turn the setting on and reload under the wider policy. */
export function enterAnySite(extraParam?: string): boolean {
  try { localStorage.setItem(ANY_SITE_KEY, '1'); } catch { return false; }
  leaveFor(anySiteTarget(location, extraParam));
  return true;
}

/** Turn the setting off and reload under the hosted policy. */
export function leaveAnySite(): void {
  try { localStorage.removeItem(ANY_SITE_KEY); } catch { /* the gate in index.html fails closed anyway */ }
  if (anySiteActive()) leaveFor(`${appPathname()}${location.search}${location.hash}`);
}
