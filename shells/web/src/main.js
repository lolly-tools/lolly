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
import { mountProfile } from './views/profile.js';
import { mountPlatform } from './views/platform.js';
import { mountCapabilities } from './views/capabilities.js';
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
  const returning = _lastRouteName === 'tool' && route.name === 'gallery';
  _lastRouteName = route.name;

  view.classList.toggle('tool-view', route.name === 'tool');
  view.classList.toggle('gallery-view', route.name === 'gallery');
  view.classList.toggle('profile-view', route.name === 'profile');
  view.classList.toggle('platform-view', route.name === 'platform');
  view.classList.toggle('capabilities-view', route.name === 'capabilities');
  view.classList.toggle('pro-view', route.name === 'pro');
  view.classList.toggle('is-returning', returning);

  switch (route.name) {
    case 'tool':
      recordTool(route.toolId); // local usage metric (profile page)
      await mountTool(view, host, route.toolId, route.params);
      break;
    case 'profile':
      await mountProfile(view, host, route.params);
      break;
    case 'platform':
      await mountPlatform(view, host);
      break;
    case 'capabilities':
      await mountCapabilities(view, host);
      break;
    // --- /pro batch mode: isolated, lazy-loaded feature. Safe to remove by
    // deleting src/pro/ and this case + the parseRoute branch below. ---
    case 'pro': {
      const { mountPro } = await import('./pro/index.js');
      const sessionSlot = new URLSearchParams(route.params || '').get('session');
      // Inject a metrics hook rather than letting /pro import metrics.js — keeps
      // the folder's "imports only engine/host/siblings" isolation intact.
      const onBatchRendered = (files) => {
        recordBatch(files.length);
        bumpMetric('filesRendered', files.length);
        for (const f of files) recordFormat(String(f.name).split('.').pop());
      };
      await mountPro(view, host, { sessionSlot, onBatchRendered });
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
  announceRoute(route.name);
  const af = document.activeElement;
  if (!af || af === document.body || af === view) {
    view.setAttribute('tabindex', '-1');
    view.focus({ preventScroll: true });
  }
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
  const apply = () => {
    raf = 0;
    // Inset of the visible (zoomed/panned) area from each LAYOUT-viewport edge,
    // so top/left-anchored AND right/bottom-anchored fixed elements can re-pin.
    const top = Math.max(0, vv.offsetTop);
    const left = Math.max(0, vv.offsetLeft);
    root.style.setProperty('--vv-top', `${top}px`);
    root.style.setProperty('--vv-left', `${left}px`);
    root.style.setProperty('--vv-right', `${Math.max(0, root.clientWidth - left - vv.width)}px`);
    root.style.setProperty('--vv-bottom', `${Math.max(0, root.clientHeight - top - vv.height)}px`);
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

  await syncCatalog(host);
  await navigate(host);
  syncCorePrefetch(host); // fire-and-forget; blobs cached after first paint

  window.addEventListener('hashchange', () => navigate(host).catch(console.error));

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

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

boot().catch(err => {
  console.error('Boot failed:', err);
  document.getElementById('view').innerHTML =
    `<div class="error">Boot failed: ${err.message}</div>`;
});
