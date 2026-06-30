// SPDX-License-Identifier: MPL-2.0
/**
 * Web shell entry.
 *
 * Responsibilities:
 *   1. Construct the capability bridge (web implementations of each API).
 *   2. Sync the tool & asset catalogs (or load from cache when offline).
 *   3. Route between gallery / tool / profile / saved views.
 *   4. Hand the engine runtime a mounted node to render into.
 */

import { createBridge } from './bridge/index.js';
import { syncCatalog, syncCorePrefetch } from './catalog/sync.js';
import { mountGallery } from './views/gallery.js';
import { mountTool } from './views/tool.js';
import { initTheme, applyTheme } from './theme.js';
import { recordTool, recordBatch, bumpMetric, recordFormat } from './metrics.js';
import { announce } from './a11y.js';

// Apply localStorage theme immediately — before the profile loads — so there
// is no visible flash between the inline FOUC script and full JS boot.
initTheme();

let _lastRouteName = null;

// Announce client-side route changes (the view swaps via innerHTML, which
// assistive tech wouldn't otherwise notice).
function announceRoute(name) {
  const labels = { gallery: 'Tools gallery', tool: 'Tool', profile: 'Profile', platform: 'Platform', capabilities: 'Capabilities', pro: 'Batch mode' };
  announce(`${labels[name] ?? 'Page'} loaded`);
}

async function navigate(host) {
  const view = document.getElementById('view');
  view._cleanup?.();
  delete view._cleanup;
  const route = parseRoute();

  document.querySelectorAll('.nav-btn[data-route]').forEach(btn => {
    btn.classList.toggle('nav-btn--active', btn.dataset.route === route.name);
  });

  // Track returns from tool → gallery so card-in animation doesn't replay.
  const prevRouteName = _lastRouteName;
  const returning = _lastRouteName === 'tool' && route.name === 'gallery';
  _lastRouteName = route.name;

  view.classList.toggle('tool-view', route.name === 'tool');
  view.classList.toggle('gallery-view', route.name === 'gallery');
  view.classList.toggle('profile-view', route.name === 'profile');
  view.classList.toggle('platform-view', route.name === 'platform');
  view.classList.toggle('capabilities-view', route.name === 'capabilities');
  view.classList.toggle('pro-view', route.name === 'pro');
  view.classList.toggle('is-returning', returning);

  // The platform/capabilities dashboards lean on SUSE Mono (hex/CMYK rows, code,
  // the device user-agent). It isn't preloaded globally — that would tax the
  // mono-light gallery cold-load — so warm it here, before the view chunk imports
  // and paints, to head off a post-paint reflow when the woff2 lands late. Idempotent.
  if (route.name === 'platform' || route.name === 'capabilities') ensureMonoPreload();

  switch (route.name) {
    case 'tool':
      recordTool(route.toolId); // local usage metric (profile page)
      await mountTool(view, host, route.toolId, route.params);
      break;
    // Profile / Platform / Capabilities pull in their own (sometimes heavy, e.g.
    // fflate) deps; lazy-load them so they stay out of the cold-load bundle that
    // every gallery visitor pays for. Same dynamic-import pattern as /pro below.
    case 'profile': {
      const { mountProfile } = await import('./views/profile.js');
      await mountProfile(view, host, route.params);
      break;
    }
    case 'platform': {
      const { mountPlatform } = await import('./views/platform.js');
      await mountPlatform(view, host);
      break;
    }
    case 'capabilities': {
      const { mountCapabilities } = await import('./views/capabilities.js');
      await mountCapabilities(view, host);
      break;
    }
    // --- /pro batch mode: isolated, lazy-loaded feature. Safe to remove by
    // deleting src/pro/ and this case + the parseRoute branch below. ---
    case 'pro': {
      const { mountPro } = await import('./pro/index.js');
      // The folder overlay is pro-free; inject it (like onBatchRendered) so /pro
      // keeps its "imports only engine/host/siblings" isolation intact.
      const { openFolderOverlay } = await import('./folder-overlay.js');
      const sessionSlot = new URLSearchParams(route.params || '').get('session');
      // Inject a metrics hook rather than letting /pro import metrics.js — keeps
      // the folder's "imports only engine/host/siblings" isolation intact.
      const onBatchRendered = (files) => {
        recordBatch(files.length);
        bumpMetric('filesRendered', files.length);
        for (const f of files) recordFormat(String(f.name).split('.').pop());
      };
      await mountPro(view, host, { sessionSlot, onBatchRendered, openFolderOverlay });
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
function ensureMonoPreload() {
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
function patchDashboardToolCount() {
  const n = window.__toolIndex?.tools?.length;
  if (n == null) return;
  document.querySelectorAll('[data-tool-count]').forEach((el) => {
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
function trackVisualViewport() {
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement;
  let raf = 0;
  // Last values written, to skip redundant setProperty calls. The common case —
  // ordinary momentum scroll at scale 1, where the mobile URL bar fires
  // visualViewport scroll/resize — recomputes the same `0px` every frame;
  // re-writing inherited root custom props each time invalidates style document-
  // wide and shows up as micro-stutter on long pages. Memoising makes it a no-op.
  let lastTop, lastLeft, lastRight, lastBottom;
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

async function boot() {
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
  if (!window.__toolIndex) {
    try {
      const cached = localStorage.getItem('sbt-tool-index');
      if (cached) window.__toolIndex = JSON.parse(cached);
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
    ((routeName === 'gallery' || routeName === 'platform') && window.__toolIndex) ||
    routeName === 'capabilities';

  if (fastPath) {
    const before = JSON.stringify(window.__toolIndex ?? null);
    await navigate(host);
    catalogReady.then(() => {
      const now = parseRoute().name;
      if (JSON.stringify(window.__toolIndex ?? null) === before) return; // no-op sync
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
      import('./views/platform.js').catch(() => {});
      import('./views/capabilities.js').catch(() => {});
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
      const r = btn.dataset.route;
      window.location.hash = r === 'gallery' ? '' : `#/${r}`;
    });
  });
}

function parseRoute() {
  const hash = window.location.hash.slice(1);

  if (hash && hash !== '/') {
    const [path, query] = hash.split('?');
    const parts = path.split('/').filter(Boolean);
    if (parts[0] === 'tool' && parts[1]) {
      return { name: 'tool', toolId: parts[1], params: query || '' };
    }
    if (parts[0] === 'profile') return { name: 'profile', params: query || '' };
    if (parts[0] === 'platform') return { name: 'platform', params: query || '' };
    if (parts[0] === 'capabilities') return { name: 'capabilities', params: query || '' };
    if (parts[0] === 'pro') return { name: 'pro', params: query || '' }; // /pro batch mode
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
  if (pathParts.length === 2 && pathParts[0] === 't') {
    return { name: 'tool', toolId: pathParts[1], params: window.location.search.slice(1) };
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
  view.textContent = '';
  const div = document.createElement('div');
  div.className = 'error';
  const msg = document.createElement('p');
  msg.style.margin = '0';
  msg.textContent = `Boot failed: ${err.message}`;
  div.appendChild(msg);

  // A locked/wedged database is recoverable: once the offending tab (or a page
  // frozen in the bfcache) closes, a reload boots cleanly. The common trigger is
  // a DB version upgrade blocked by an older tab. Rather than dead-ending here,
  // offer a Reload button AND auto-reload once when this page next regains
  // visibility — i.e. the moment the user switches back after closing the other
  // tab — so recovery doesn't depend on them knowing to reload manually.
  if (err && (err.code === 'DB_BLOCKED' || err.code === 'DB_OPEN_TIMEOUT')) {
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
