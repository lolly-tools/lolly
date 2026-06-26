/**
 * Service worker — three strategies, chosen per request:
 *
 *   1. Navigations (the app shell document) → NETWORK-FIRST with a cached-shell
 *      fallback. A healthy network always serves the current deploy's HTML, so a
 *      new deploy is picked up on the next load. When the network fails (offline
 *      cold load), we serve the last cached shell instead, so the app still boots.
 *
 *   2. Immutable, content-hashed build assets (/assets/index-*.js, *.css) and the
 *      bundled variable fonts → CACHE-FIRST. Vite content-hashes these filenames,
 *      so a cached copy can never be stale: a new deploy emits new filenames that
 *      simply miss the cache and fetch fresh. This is what makes the offline cold
 *      load actually serve the app's JS/CSS — without the stale-chunk risk a
 *      precache-everything approach would create. (Fonts keep the same filename;
 *      a font swap propagates on the next CACHE bump.)
 *
 *   3. Tool files under /tools/ (template.html, styles.css, hooks.js, tool-local
 *      assets) → NETWORK-FIRST with a timeout race, so a deploy propagates
 *      immediately and a slow/dead connection still falls back to cache.
 *
 * The catalog index files under /catalog/ need fresh data, so they bypass the
 * service worker entirely.
 *
 * Because hashed assets are immutable, the new SW claiming clients mid-session is
 * safe (it can't swap a running page's chunks), so no skipWaiting update-prompt
 * flow is needed.
 *
 * Bump CACHE on any change to this file to evict the previous generation's
 * entries on activate (a one-time clear of anything already gone stale).
 */

const CACHE = 'lolly-v4';

// Stable key the app-shell document is cached under for the offline fallback.
// Every navigation (/, /pro, /tool/...) resolves to the same SPA index.html, so
// one canonical entry serves them all.
const SHELL_URL = '/';

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

// Cache-first: content-hashed Vite build output, plus the bundled variable fonts
// (stable filenames, effectively immutable — refreshed by a CACHE bump). Checked
// before CACHE_PATTERNS so fonts under /tools/ take this path, not network-first.
const IMMUTABLE_PATTERNS = [
  /^\/assets\//,
  /^\/tools\/lockup\/src\/fonts\//,
];

// Network-first tool assets; let catalog + API requests pass through to network.
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

  // Navigations: network-first so a new deploy is picked up, with the cached
  // shell as the offline fallback (this is what enables the offline cold load).
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstDocument(event));
    return;
  }

  if (BYPASS_PATTERNS.some(p => p.test(url.pathname))) return;

  // Immutable hashed build assets + bundled fonts: cache-first (safe — filenames
  // are content-hashed, so a cached copy is never stale).
  if (IMMUTABLE_PATTERNS.some(p => p.test(url.pathname))) {
    event.respondWith(cacheFirst(event));
    return;
  }

  if (!CACHE_PATTERNS.some(p => p.test(url.pathname))) return;

  event.respondWith(networkFirst(event));
});

// Cache-first for immutable resources: serve the cached copy if present;
// otherwise fetch, cache an ok response, and return it.
async function cacheFirst(event) {
  const { request } = event;
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

// Network-first for the app-shell document: a healthy network serves (and
// re-caches) the current deploy's HTML; a network failure falls back to the last
// cached shell so the app still boots offline. We never serve cache while the
// network is reachable, so there's no mid-deploy stale-shell risk.
async function networkFirstDocument(event) {
  const { request } = event;
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(SHELL_URL, response.clone());
    return response;
  } catch {
    const cached = await cache.match(SHELL_URL);
    if (cached) return cached;
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

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
