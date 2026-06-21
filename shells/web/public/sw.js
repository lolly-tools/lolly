/**
 * Service worker — network-first (with timeout) for tool files.
 *
 * Tool files under /tools/ (template.html, styles.css, hooks.js, tool-local
 * assets) are fetched fresh from the network so a deploy propagates immediately
 * — no stale design pinned to the cache until a hard refresh. The network is
 * raced against NETWORK_TIMEOUT_MS: whoever resolves first wins. If the network
 * is slow, fails, or returns non-ok, we fall back to the cached copy, so the app
 * still works offline (for tools opened at least once while online). Successful
 * responses refresh the cache. The catalog index files under /catalog/ need
 * fresh data, so they bypass the service worker entirely.
 *
 * Bump CACHE on any change to this file to evict the previous generation's
 * entries on activate (a one-time clear of anything already gone stale).
 */

const CACHE = 'lolly-v3';

// How long a tool-file fetch may run before we give up and serve cache instead.
// Long enough that a healthy connection always wins (fresh); short enough that a
// dead/flaky one fails over to cache without a painful stall.
const NETWORK_TIMEOUT_MS = 2500;

// Assets pre-cached on install so map tools work offline / after session restore.
const PRECACHE_URLS = [
  '/tools/meeting-planner/lib/d3.min.js',
  '/tools/meeting-planner/lib/topojson.min.js',
  '/tools/meeting-planner/lib/countries-110m.json',
];

// Cache tool assets; let catalog + API requests pass through to network.
const CACHE_PATTERNS = [
  /^\/tools\//,
];

const BYPASS_PATTERNS = [
  /^\/catalog\//,
  /^\/api\//,
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  // Remove caches from previous versions.
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (BYPASS_PATTERNS.some(p => p.test(url.pathname))) return;
  if (!CACHE_PATTERNS.some(p => p.test(url.pathname))) return;

  event.respondWith(networkFirst(event));
});

// Race the network against NETWORK_TIMEOUT_MS. A fresh, ok response wins and
// refreshes the cache. A timeout / network error / non-ok response falls back to
// the cached copy (keeping the in-flight fetch alive via waitUntil so the cache
// still freshens for next time). With nothing cached, return whatever the
// network ultimately gives, or a 503 if it never arrives.
async function networkFirst(event) {
  const { request } = event;
  const cache = await caches.open(CACHE);

  let timer;
  const timeout = new Promise(resolve => {
    timer = setTimeout(() => resolve(null), NETWORK_TIMEOUT_MS);
  });
  const network = fetch(request)
    .then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  const winner = await Promise.race([network, timeout]);
  clearTimeout(timer);
  if (winner && winner.ok) return winner;

  // Network lost the race (slow), failed, or returned non-ok → try cache.
  const cached = await cache.match(request);
  if (cached) {
    event.waitUntil(network); // let the slow fetch finish and update the cache
    return cached;
  }
  return (await network) || new Response('Offline', { status: 503 });
}
