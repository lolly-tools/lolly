// SPDX-License-Identifier: MPL-2.0
/**
 * The `#/open?lolly=<source>` route (plan 291 W8): open a `.lolly` this site already
 * serves, with no drop and no file picker. An agent, a test or a docs capture hands
 * the app a file this way; a person still uses Open or a drop.
 *
 * The source is one of these two:
 *  - a same-origin path that starts with a single `/` (the rule `#/verify?src=` keeps),
 *    so a link can never make the browser fetch from a third-party host;
 *  - a `blob:` URL minted by this origin.
 * `data:`, `javascript:`, `//host` and every other origin are refused before any fetch.
 *
 * The route is a hand-off. It replaces its own address with a bare `#/open` before it
 * fetches, so a reload never imports the file twice, then gives the file to the one
 * intake (openLollyFile) in unattended mode. That skips the chooser only for a plain
 * shared design; a file that carries a tool, a design system, templates, a renovation
 * or a project still asks the person, and nothing in the URL grants trust. The route
 * is hash-only: it is not an app path word, so a `lolly://open` link never opens the route.
 */
import { t, tRaw } from '../i18n.ts';
import type { openLollyFile } from './drop-router.ts';

/** The query parameter that carries the source. */
export const OPEN_ROUTE_PARAM = 'lolly';

/** The intake's host, as declared by openLollyFile. */
export type OpenRouteHost = Parameters<typeof openLollyFile>[1];

/**
 * Whether the router's host carries the web store the intake writes the session into.
 * The web bridge always does; the check states it for the type system without a cast.
 */
function isIntakeHost(host: object): host is OpenRouteHost {
  const state = 'state' in host ? host.state : null;
  return typeof state === 'object' && state !== null
    && 'sizes' in state && typeof state.sizes === 'function' && '_getAssetRefs' in state;
}

/** A source the route may fetch, or why it may not. */
export type OpenRouteSource =
  | { ok: true; kind: 'path' | 'blob'; url: string; name: string }
  | { ok: false; reason: 'missing' | 'refused' };

/** A control character, or the backslash that a browser reads as `/`. No source may carry one. */
function unsafeChar(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return code < 0x20 || code === 0x7f || ch === '\\';
}

/** The file name the intake shows: the last path segment, or a plain default. */
function sourceName(pathname: string): string {
  const last = pathname.slice(pathname.lastIndexOf('/') + 1);
  let name = last;
  try { name = decodeURIComponent(last); } catch { /* keep the raw segment */ }
  name = [...name].filter((ch) => ch !== '/' && !unsafeChar(ch)).join('').slice(0, 200);
  return name || 'shared.lolly';
}

/**
 * Classify a `?lolly=` value against the page's origin. Pure, so the rule is tested
 * without a browser. A path is returned as a same-origin path (with its query), a blob
 * as the full `blob:` URL.
 */
export function openRouteSource(raw: string | null | undefined, origin: string): OpenRouteSource {
  if (raw === null || raw === undefined || raw.trim() === '') return { ok: false, reason: 'missing' };
  if ([...raw].some(unsafeChar)) return { ok: false, reason: 'refused' };
  if (raw.startsWith('blob:')) {
    let inner: URL;
    try { inner = new URL(raw.slice('blob:'.length)); } catch { return { ok: false, reason: 'refused' }; }
    if (inner.origin === 'null' || inner.origin !== origin) return { ok: false, reason: 'refused' };
    return { ok: true, kind: 'blob', url: raw, name: 'shared.lolly' };
  }
  // A single leading slash: `//host/x` is protocol-relative and leaves this origin.
  if (!/^\/[^/]/.test(raw)) return { ok: false, reason: 'refused' };
  let url: URL;
  try { url = new URL(raw, origin); } catch { return { ok: false, reason: 'refused' }; }
  if (url.origin !== origin) return { ok: false, reason: 'refused' };
  // Dot segments are resolved by the parse, so `/.//host/x` or `/a/..//host/x` comes out
  // as the path `//host/x`, which a fetch would read as protocol-relative: refused.
  if (url.pathname.startsWith('//')) return { ok: false, reason: 'refused' };
  return { ok: true, kind: 'path', url: url.pathname + url.search, name: sourceName(url.pathname) };
}

/** The route's one card. `data-open-route` says which state it shows, for automation. */
function card(view: HTMLElement, state: 'opening' | 'failed', message: string, link?: { label: string; href: string }): void {
  const wrap = document.createElement('section');
  wrap.className = 'open-route';
  wrap.dataset.openRoute = state;
  wrap.style.cssText = 'min-height:60vh;display:flex;align-items:center;justify-content:center;padding:40px 16px';
  const box = document.createElement('div');
  box.style.cssText = 'width:100%;max-width:26rem;text-align:center;background:hsl(var(--card));color:hsl(var(--card-foreground));border:1px solid hsl(var(--border));border-radius:var(--radius);padding:1.75rem 1.5rem';
  const heading = document.createElement('h1');
  heading.style.cssText = 'margin:0 0 .5rem;font-size:1.25rem;font-weight:750';
  heading.textContent = t('Shared design');
  const p = document.createElement('p');
  p.setAttribute('role', state === 'failed' ? 'alert' : 'status');
  p.style.cssText = 'margin:0;color:hsl(var(--muted-foreground));font-size:.95rem;line-height:1.55;overflow-wrap:anywhere';
  p.textContent = message;
  box.append(heading, p);
  if (link) {
    const a = document.createElement('a');
    a.className = 'btn btn--primary';
    a.href = link.href;
    a.textContent = link.label;
    a.style.cssText = 'display:inline-flex;margin-top:1.25rem';
    box.append(a);
  }
  wrap.append(box);
  view.replaceChildren(wrap);
}

interface OpenRouteView extends HTMLElement { _cleanup?: () => void }

/**
 * Mount the route. Resolves as soon as the card is up; the fetch and the open carry on
 * in `runOpenRoute`, so the router is never asked to mount the tool while it is still
 * mounting this route.
 */
export async function mountOpenRoute(view: HTMLElement, host: object, params: string): Promise<void> {
  void runOpenRoute(view, host, params);
}

/**
 * The whole route, start to finish. Resolves once the file has opened, or once the card
 * says why it did not. Leaving the route before the fetch returns cancels the open.
 */
export async function runOpenRoute(view: HTMLElement, host: object, params: string): Promise<void> {
  document.title = `${t('Shared design')} - Lolly`;
  let cancelled = false;
  (view as OpenRouteView)._cleanup = () => { cancelled = true; };
  const raw = new URLSearchParams(params).get(OPEN_ROUTE_PARAM);
  // Leave the source address before anything is fetched: a reload of `#/open` finds
  // no source and opens nothing.
  if (raw !== null) {
    history.replaceState(history.state, '', '#/open');
    // A duplicate navigation event must not remount the consumed hand-off.
    window.dispatchEvent(new window.Event('lolly:url-state'));
  }
  const projects = { label: t('Go to Projects'), href: '#/p' };
  const source = openRouteSource(raw, window.location.origin);
  if (!source.ok) {
    card(view, 'failed', source.reason === 'missing'
      ? t('This link does not name a file to open.')
      : t('Only files served by this site can be opened from a link.'), projects);
    return;
  }
  card(view, 'opening', tRaw('Opening {name}…', { name: source.name }));
  let blob: Blob;
  try {
    // The address actually fetched, made absolute and checked once more: whatever the
    // classifier returned, the request may only go to this origin.
    const target = new URL(source.url, window.location.href);
    if (target.origin !== window.location.origin) throw new Error('cross-origin');
    // No redirects: a same-origin path that redirects elsewhere would leave this origin.
    const response = await fetch(target.href, { credentials: 'same-origin', cache: 'no-store', redirect: 'error' });
    if (!response.ok) throw new Error(String(response.status));
    blob = await response.blob();
  } catch {
    if (!cancelled) card(view, 'failed', tRaw('Could not read {src} from this site.', { src: source.name }), projects);
    return;
  }
  if (cancelled || !view.isConnected) return;
  if (!isIntakeHost(host)) {
    card(view, 'failed', t('Nothing was opened.'), projects);
    return;
  }
  const file = new File([blob], source.name, { type: 'application/vnd.lolly+zip' });
  const { openLollyFile: open } = await import('./drop-router.ts');
  let failure: string | null = null;
  await open(file, host, { preferred: 'session', unattended: true, onFailure: (message) => { failure = message; } });
  // A successful open has moved to the tool's address. Anything else left this card up.
  if (cancelled || !/^#\/open(?:$|\?)/.test(window.location.hash)) return;
  card(view, 'failed', failure ?? t('Nothing was opened.'), projects);
}
