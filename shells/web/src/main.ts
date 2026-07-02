// SPDX-License-Identifier: MPL-2.0
/**
 * Web shell entry.
 *
 * Responsibilities:
 * 1. Construct the capability bridge (web implementations of each API).
 * 2. Sync the tool & asset catalogs (or load from cache when offline).
 * 3. Route between gallery / tool / profile / saved views.
 * 4. Hand the engine runtime a mounted node to render into.
 */

import { createBridge } from './bridge/index.ts';
import type { WebHost } from './bridge/index.ts';
import { DbOpenError } from './bridge/db.ts';
import { syncCatalog, syncCorePrefetch, isToolIndex } from './catalog/sync.ts';
import type { ToolIndex } from './catalog/sync.ts';
import { mountGallery } from './views/gallery.ts';
import { mountTool, type ToolViewElement } from './views/tool/index.ts';
import { initTheme, applyTheme } from './theme.ts';
import { recordTool, recordBatch, bumpMetric, recordFormat } from './metrics.ts';
import { announce } from './a11y.ts';
import type { BatchFile } from './pro/batch.ts';

// Apply the localStorage theme immediately — before the profile loads — so
// there's no visible flash between the inline FOUC script and full JS boot.
initTheme();

type RouteName = 'tool' | 'profile' | 'platform' | 'capabilities' | 'pro' | 'projects' | 'gallery';

type Route =
  | { name: 'tool'; toolId: string; params: string }
  | { name: 'profile'; params: string }
  | { name: 'platform'; params?: string }
  | { name: 'capabilities'; params?: string }
  | { name: 'pro'; params?: string }
  | { name: 'projects'; folderId: string | null; params?: string }
  | { name: 'gallery' };

let _lastRouteName: RouteName | null = null;

/** Required by index.html; thrown if the shell markup is ever missing it. */
function getViewEl(): ToolViewElement {
  const el = document.getElementById('view');
  if (!el) throw new Error('#view element missing from index.html');
  return el;
}

// Announce client-side route changes (the view swaps via innerHTML, which
// assistive tech wouldn't otherwise notice).
function announceRoute(name: RouteName): void {
  const labels: Record<RouteName, string> = { gallery: 'Tools gallery', tool: 'Tool', profile: 'Profile', platform: 'Platform', capabilities: 'Capabilities', pro: 'Batch mode', projects: 'Projects' };
  announce(`${labels[name] ?? 'Page'} loaded`);
}

async function navigate(host: WebHost): Promise<void> {
  const view = getViewEl();
  view._cleanup?.();
  delete view._cleanup;
  const route = parseRoute();

  // Projects "+ New tool" / resume flow arms one-shot sessionStorage markers
  // (lolly:fileInto, lolly:returnTo) that the tool view READS on mount (it can't
  // remove them — a single hash navigation may mount the tool twice, and the second
  // mount owns the live Save button). Clear them the moment we land on any NON-tool
  // view so the marker can't leak into the next, unrelated tool the user opens.
  if (route.name !== 'tool') {
    sessionStorage.removeItem('lolly:fileInto');
    sessionStorage.removeItem('lolly:returnTo');
  }

  document.querySelectorAll('.nav-btn[data-route]').forEach(btn => {
    if (btn instanceof HTMLElement) btn.classList.toggle('nav-btn--active', btn.dataset.route === route.name);
  });

  // Track returns from tool → gallery so the card-in animation doesn't replay.
  const prevRouteName = _lastRouteName;
  const returning = _lastRouteName === 'tool' && route.name === 'gallery';
  _lastRouteName = route.name;

  view.classList.toggle('tool-view', route.name === 'tool');
  view.classList.toggle('gallery-view', route.name === 'gallery');
  view.classList.toggle('profile-view', route.name === 'profile');
  view.classList.toggle('platform-view', route.name === 'platform');
  view.classList.toggle('capabilities-view', route.name === 'capabilities');
  view.classList.toggle('pro-view', route.name === 'pro');
  view.classList.toggle('projects-view', route.name === 'projects');
  view.classList.toggle('is-returning', returning);

  // When the route NAME changes, the view-scoping class above changes with it
  // (e.g. .profile-view → .gallery-view). But the outgoing view's markup is still
  // in `view` and won't be replaced until the incoming mount writes its innerHTML
  // — which happens AFTER the mount's first await (e.g. gallery reads IndexedDB before
  // it paints). In that gap the old markup is styled by a class it no longer has,
  // so it flashes UNSTYLED (e.g. a bare profile form). Drop the stale markup now so
  // the flash can't show; the incoming mount fills the empty container. Same-name
  // updates (the gallery's post-sync refresh) keep their content so it's never
  // blank, and first boot keeps its "Loading…" skeleton until the gallery lands.
  if (prevRouteName && route.name !== prevRouteName) view.replaceChildren();

  // The platform/capabilities dashboards lean on SUSE Mono (hex/CMYK rows, code,
  // device user-agent). It isn't preloaded globally — it would tax the
  // mono-light gallery cold-load — so warm it here, before the view chunk imports
  // and paints, to head off a post-paint reflow when the woff2 lands late.
  if (route.name === 'platform' || route.name === 'capabilities') ensureMonoPreload();

  switch (route.name) {
    case 'tool':
      recordTool(route.toolId); // local usage metric (profile page)
      await mountTool(view, host, route.toolId, route.params);
      break;
    // Profile / Platform / Capabilities pull in their own (sometimes heavy, e.g.
    // fflate) deps; lazy-load keeps them out of the cold-load bundle that
    // every gallery visitor would otherwise pay for. Same dynamic-import pattern
    // used for /pro below.
    case 'profile': {
      const { mountProfile } = await import('./views/profile/index.ts');
      await mountProfile(view, host, route.params);
      break;
    }
    case 'platform': {
      const { mountPlatform } = await import('./views/platform.ts');
      await mountPlatform(view, host);
      break;
    }
    case 'capabilities': {
      const { mountCapabilities } = await import('./views/capabilities.ts');
      await mountCapabilities(view, host);
      break;
    }
    // --- /pro batch mode: isolated, lazy-loaded feature. Safe to remove by
    // deleting src/pro/ and this case + the parseRoute branch below. ---
    case 'pro': {
      const { mountPro } = await import('./pro/index.ts');
      // folder overlay is pro-free; inject it (like onBatchRendered) so /pro
      // keeps its "imports only engine/host/siblings" isolation intact.
      const { openFolderOverlay } = await import('./folder-overlay.ts');
      const sessionSlot = new URLSearchParams(route.params || '').get('session');
      // Inject a metrics hook rather than letting /pro import metrics.js — keeps
      // the folder's "imports only engine/host/siblings" isolation intact.
      const onBatchRendered = (files: BatchFile[]) => {
        recordBatch(files.length);
        bumpMetric('filesRendered', files.length);
        for (const f of files) recordFormat(String(f.name).split('.').pop());
      };
      // Bind the real host into the overlay opener here: the overlay needs a wider
      // host slice than /pro models, so the shell (which owns the full host) closes
      // over it and hands /pro a host-free opener — keeping /pro isolated.
      await mountPro(view, host, {
        sessionSlot: sessionSlot ?? undefined,
        onBatchRendered,
        openFolderOverlay: (opts) => openFolderOverlay(host, opts),
      });
      break;
    }
    // --- Projects: a gallery-style view of folders of saved sessions. Shares the
    // pro-free folder store + folder-export (gated import); safe to keep even if /pro
    // is removed. ---
    case 'projects': {
      const { mountProjects } = await import('./views/projects.ts');
      const onBatchRendered = (files: BatchFile[]) => {
        recordBatch(files.length);
        bumpMetric('filesRendered', files.length);
        for (const f of files) recordFormat(String(f.name).split('.').pop());
      };
      await mountProjects(view, host, route.folderId, { onBatchRendered });
      break;
    }
    case 'gallery':
    default:
      await mountGallery(view, host);
  }

  // After the view swaps, tell assistive tech and move focus into the new view
  // so keyboard/SR users aren't stranded on the now-removed element. (Within a
  // view, state changes use replaceState — no navigate — so focus isn't stolen.)
  // BUT if the view's own mount already placed focus on something meaningful
  // (e.g. /pro focuses its template search, which lives in a body-mounted
  // popover), don't yank it back to the container.
  // Land a newly-entered view at the top. A route-NAME change swaps the whole
  // view via innerHTML, so inheriting the previous page's scroll offset would
  // drop you mid-content (e.g. a scrolled gallery → capabilities). Skip the
  // tool→gallery "return" so that path keeps its current feel, and skip same-name
  // updates (those go through replaceState, not navigate, so they never reach here).
  if (route.name !== prevRouteName && !returning) {
    window.scrollTo(0, 0);
    view.scrollTop = 0;
  }

  announceRoute(route.name);
  const af = document.activeElement;
  if (!af || af === document.body || af === view) {
    view.setAttribute('tabindex', '-1');
    view.focus({ preventScroll: true });
  }
}

// Route-scoped font preload for the mono-heavy dashboards (see navigate). Added
// once; the browser dedupes against the @font-face request that follows.
function ensureMonoPreload(): void {
  if (document.getElementById('preload-suse-mono')) return;
  const l = document.createElement('link');
  l.id = 'preload-suse-mono';
  l.rel = 'preload';
  l.as = 'font';
  l.type = 'font/woff2';
  l.crossOrigin = 'anonymous';
  l.href = '/catalog/fonts/webfonts/SUSEMono[wght].woff2';
  document.head.appendChild(l);
}

// Update a dashboard's "N tools" stat in place after a cold fast-path paint, once
// the synced catalog carries a (newer) count. Patching beats re-navigating, which
// would replay the whole entrance cascade just to change a number. The view marks
// the stat with [data-tool-count] and hides it while the count is unknown.
function patchDashboardToolCount(): void {
  const w: Window & { __toolIndex?: ToolIndex } = window;
  const n = w.__toolIndex?.tools?.length;
  if (n == null) return;
  document.querySelectorAll('[data-tool-count]').forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const strong = el.querySelector('strong');
    if (strong) strong.textContent = String(n);
    el.hidden = false;
  });
}

// Publish the visual viewport's offset (how far the zoomed/panned visible area
// sits from the layout viewport) as CSS vars. position:fixed pins to the LAYOUT
// viewport, so without this the mobile controls sheet drifts off-screen while
// the page is pinch-zoomed; the mobile sheet rules add --vv-top/--vv-left back.
// Fixed-cost, polite (rAF-throttled), and a no-op when not zoomed (offsets = 0).
function trackVisualViewport(): void {
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement;
  let raf = 0;
  // Last values written, to skip redundant setProperty calls. The common case —
  // ordinary momentum scroll at scale 1, where the mobile URL bar fires
  // visualViewport scroll/resize — recomputes the same `0px` every frame;
  // re-writing inherited root custom props each time invalidates style document-
  // wide and shows up as micro-stutter on long pages. Memoising makes it a no-op.
  let lastTop: number | undefined, lastLeft: number | undefined, lastRight: number | undefined, lastBottom: number | undefined;
  const apply = () => {
    raf = 0;
    // Only re-pin while genuinely pinch-zoomed (scale > 1). At scale 1 the visual
    // and layout viewports can still differ — a mobile browser's retractable
    // toolbar (URL bar) shrinks the visual viewport as it shows/hides on scroll —
    // but there position:fixed already tracks the layout-viewport edges, so a
    // computed inset would wrongly float a bottom-pinned bar up above where the
    // (often hidden) controls sit, and have it drift as you scroll. Zeroing the
    // offsets at scale 1 hands the un-zoomed case back to native bottom:0.
    const zoomed = vv.scale > 1.01;
    const top = zoomed ? Math.max(0, vv.offsetTop) : 0;
    const left = zoomed ? Math.max(0, vv.offsetLeft) : 0;
    const right = zoomed ? Math.max(0, root.clientWidth - left - vv.width) : 0;
    const bottom = zoomed ? Math.max(0, root.clientHeight - top - vv.height) : 0;
    if (top === lastTop && left === lastLeft && right === lastRight && bottom === lastBottom) return;
    lastTop = top; lastLeft = left; lastRight = right; lastBottom = bottom;
    root.style.setProperty('--vv-top', `${top}px`);
    root.style.setProperty('--vv-left', `${left}px`);
    root.style.setProperty('--vv-right', `${right}px`);
    root.style.setProperty('--vv-bottom', `${bottom}px`);
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(apply); };
  vv.addEventListener('resize', schedule);
  vv.addEventListener('scroll', schedule);
  apply();
}

async function boot(): Promise<void> {
  const w: Window & { __toolIndex?: ToolIndex } = window;
  const host = await createBridge();
  trackVisualViewport();

  // Profile is the canonical theme store. Apply it now so the theme is correct
  // before the first view renders. Also keeps localStorage in sync for FOUC.
  const profile = await host.profile.get();
  if (profile.theme) applyTheme(profile.theme, false);

  // Prime the in-memory tool index from the last cached copy so the gallery can
  // paint immediately, before the network catalog sync resolves. syncCatalog
  // overwrites window.__toolIndex with fresh data when it lands. (Mirrors the
  // 'sbt-tool-index' fallback key written by catalog/sync.js.)
  if (!w.__toolIndex) {
    try {
      const cached = localStorage.getItem('sbt-tool-index');
      const parsed: unknown = cached ? JSON.parse(cached) : null;
      if (isToolIndex(parsed)) w.__toolIndex = parsed;
    } catch { /* ignore corrupt/oversized cache */ }
  }

  const catalogReady = syncCatalog(host);
  catalogReady.then(() => syncCorePrefetch(host)); // fire-and-forget after sync

  // The gallery can paint instantly from a CACHED index, then silently refresh
  // when the network sync lands. But a brand-new user has no cache, and painting
  // { tools: [] } would flash the gallery's *failure* empty-state ("couldn't
  // load the tools — check your connection") during a sync that's actually
  // succeeding. So only take the fast path when we already have an index;
  // otherwise wait for the sync (it resolves even offline, falling back to cache)
  // so the first paint is real data, not a false error. Deep links to a
  // tool/profile/etc. need the synced catalog (asset metadata) before their first
  // render, so those keep the original "sync, then navigate" ordering.
  // Paint instantly from cache instead of blocking on the full catalog network
  // sync, then reconcile when it lands. The gallery and platform need a CACHED
  // index (gallery would otherwise flash its load-failure empty state mid-sync;
  // platform would briefly show "none loaded" for its catalogue breakdown).
  // Capabilities tolerates a missing index — its one live value is a tool count
  // that's gracefully hidden when absent and patched in place once synced — so it
  // fast-paths even on a cold first visit. Deep-linked /tool and /profile keep the
  // sync-then-navigate ordering: they genuinely need synced asset metadata first.
  const routeName = parseRoute().name;
  const fastPath =
    ((routeName === 'gallery' || routeName === 'platform') && w.__toolIndex) ||
    routeName === 'capabilities';

  if (fastPath) {
    const before = JSON.stringify(w.__toolIndex ?? null);
    await navigate(host);
    catalogReady.then(() => {
      const now = parseRoute().name;
      if (JSON.stringify(w.__toolIndex ?? null) === before) return; // no-op sync
      if (now === 'gallery') {
        // Re-render from fresh data — the gallery's cascade only replays because
        // the data actually changed (guarded above), not on every sync.
        navigate(host).catch(console.error);
      } else if (now === 'capabilities') {
        // Patch the tool count in place. Re-navigating would replay the entrance
        // cascade just to update a number — the exact jitter we're removing.
        patchDashboardToolCount();
      }
      // platform: its catalogue breakdown refreshes on the next visit (no cascade
      // replay), and it only fast-paths with a cached index anyway.
    });
  } else {
    await catalogReady;
    await navigate(host);
  }

  // Warm the likely-next view chunks once idle so the first tap to Platform /
  // Capabilities doesn't pay a cold dynamic-import fetch. Scheduled after first
  // paint so it never contends with the catalog network work. import() promises
  // are cached, so the later route reuses these.
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => {
      import('./views/platform.ts').catch(() => {});
      import('./views/capabilities.ts').catch(() => {});
      import('./views/projects.ts').catch(() => {});
    });
  }

  // Re-render on any route change. hashchange covers legacy #/… links and external
  // deep links; popstate covers History-API back/forward across /t/<id> tool entries;
  // 'lolly:navigate' is fired by navigateTo() for in-app links that leave a tool.
  // Collapse a same-tick burst — back across a hash change fires popstate AND
  // hashchange — into a single navigate so a tool isn't re-mounted (and its state
  // lost) twice. Explicit navigate(host) calls elsewhere (boot, gallery refresh)
  // bypass this and still run.
  let navQueued = false;
  const onRouteChange = () => {
    if (navQueued) return;
    navQueued = true;
    Promise.resolve().then(() => { navQueued = false; navigate(host).catch(console.error); });
  };
  window.addEventListener('hashchange', onRouteChange);
  window.addEventListener('popstate', onRouteChange);
  window.addEventListener('lolly:navigate', onRouteChange);

  document.querySelectorAll('[data-route]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!(btn instanceof HTMLElement)) return;
      const r = btn.dataset.route;
      window.location.hash = r === 'gallery' ? '' : `#/${r}`;
    });
  });
}

function parseRoute(): Route {
  const hash = window.location.hash.slice(1);

  if (hash && hash !== '/') {
    const [path, query] = hash.split('?');
    const parts = (path ?? '').split('/').filter(Boolean);
    if (parts[0] === 'tool' && parts[1]) {
      return { name: 'tool', toolId: parts[1], params: query || '' };
    }
    if (parts[0] === 'profile') return { name: 'profile', params: query || '' };
    if (parts[0] === 'platform') return { name: 'platform', params: query || '' };
    if (parts[0] === 'capabilities') return { name: 'capabilities', params: query || '' };
    if (parts[0] === 'pro') return { name: 'pro', params: query || '' }; // /pro batch mode
    if (parts[0] === 'p') return { name: 'projects', folderId: parts[1] || null, params: query || '' };
    return { name: 'gallery' };
  }

  const pathParts = window.location.pathname.split('/').filter(Boolean);
  // /t/<id> is a tool's canonical address-bar URL (path form, so a copied link
  // carries the per-tool OG preview — see scripts/build-tool-og.js); params ride in
  // the query string. Returned as a first-class tool route — NOT redirected to the
  // hash — so History-API back/forward to a /t/<id> entry re-mounts correctly. In
  // production the server serves the static OG stub at this exact path and the stub
  // bounces a human into #/tool/<id>, which mounts and then syncUrl rewrites the bar
  // back to /t/<id>; this branch is what re-mounts on client-side popstate to it.
  if (pathParts.length === 2 && pathParts[0] === 't' && pathParts[1]) {
    return { name: 'tool', toolId: pathParts[1], params: window.location.search.slice(1) };
  }
  // /p (Projects root) and /p/<folderId> deep links → redirect into the canonical
  // hash form so all in-app projects navigation stays hash-based (folders are private
  // profile data — no OG stub / first-class path needed, unlike /t/). Same redirect
  // style as /pro|/platform|/capabilities. Must precede the length===1 tool-shortcut
  // block so a bare /p isn't treated as a tool id.
  if (pathParts[0] === 'p') {
    window.location.replace(`/#/p${pathParts[1] ? '/' + pathParts[1] : ''}${window.location.search}`);
    return { name: 'projects', folderId: pathParts[1] || null };
  }
  if (pathParts.length === 1) {
    // /pro, /platform and /capabilities are real routes; everything else is a tool shortcut.
    if (pathParts[0] === 'pro') { window.location.replace('/#/pro'); return { name: 'pro' }; }
    if (pathParts[0] === 'platform') { window.location.replace('/#/platform'); return { name: 'platform' }; }
    if (pathParts[0] === 'capabilities') { window.location.replace('/#/capabilities'); return { name: 'capabilities' }; }
    window.location.replace(`/#/tool/${pathParts[0]}${window.location.search}`);
    return { name: 'gallery' };
  }

  return { name: 'gallery' };
}

// Only register the service worker in production builds. In dev it would cache
// /tools/ files, so a slow reload could serve a stale edit instead of the file
// just changed on disk.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

boot().catch(err => {
  console.error('Boot failed:', err);
  // Build the error node with textContent — never interpolate err.message into
  // innerHTML (it can carry attacker-influenced strings).
  const view = document.getElementById('view');
  if (!view) return;
  view.textContent = '';
  const div = document.createElement('div');
  div.className = 'error';
  const msg = document.createElement('p');
  msg.style.margin = '0';
  msg.textContent = `Boot failed: ${err instanceof Error ? err.message : String(err)}`;
  div.appendChild(msg);

  // A locked/wedged database is recoverable: once the offending tab (or a page
  // frozen in the bfcache) closes, a reload boots cleanly. The common trigger is
  // a DB version upgrade blocked by an older tab. Rather than dead-ending here,
  // offer a Reload button AND auto-reload once when this page next regains
  // visibility — i.e. the moment the user switches back after closing the other
  // tab — so recovery doesn't depend on them knowing to reload manually.
  if (err instanceof DbOpenError) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.textContent = 'Reload';
    btn.style.marginTop = '10px';
    btn.addEventListener('click', () => window.location.reload());
    div.appendChild(btn);

    let retried = false;
    const retry = () => {
      if (retried || document.visibilityState !== 'visible') return;
      retried = true; // one automatic attempt, then leave it to the button
      window.location.reload();
    };
    document.addEventListener('visibilitychange', retry);
    window.addEventListener('focus', retry);
  }

  view.appendChild(div);
});
