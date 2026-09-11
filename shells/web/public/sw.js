/**
 * Service worker - three strategies, chosen per request:
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
 *      load actually serve the app's JS/CSS - without the stale-chunk risk a
 *      precache-everything approach would create. (Fonts keep the same filename;
 *      a font swap propagates on the next CACHE bump.)
 *
 *   3. Tool files under /tools/ (template.html, styles.css, hooks.js, tool-local
 *      assets) → NETWORK-FIRST with a timeout race, so a deploy propagates
 *      immediately and a slow/dead connection still falls back to cache - first
 *      this generation's cache, then the separate PIN_CACHE bucket that holds
 *      tools the user pinned "available offline" (lib/offline-pins.ts).
 *
 *   4. Preview images + the preview-look manifest under /catalog/previews/ →
 *      STALE-WHILE-REVALIDATE: serve the cached copy instantly (no blocking
 *      network on repeat loads, and they work offline) while a background fetch
 *      freshens the cache for next time. Previews are regenerable, non-critical
 *      art (a one-load-stale thumbnail is harmless, and a stale look self-heals -
 *      preview-bundle.ts rejects a sig mismatch and live-renders), so unlike the
 *      catalog INDEX they don't need to be fetch-fresh. This is the repeat-visit
 *      request cut: dozens of preview + manifest requests become cache hits. It
 *      is also the ONLY thing that caches bundle.json - nothing precaches it, so
 *      a cold load fetches it exactly once, from the page.
 *
 *   5. The /info docs site → NETWORK-FIRST per URL out of its own persistent
 *      bucket (INFO_CACHE, filled by the offline download manager) - real
 *      static HTML that is NOT the SPA shell and must never be cached as it
 *      (see networkFirstInfo and isShellNavigation). /ort/ (the ONNX runtime)
 *      is CACHE-FIRST out of its own bucket the same way (ORT_CACHE).
 *
 *   6. The PWA share target (POST /share-target) → the ONE non-GET branch here.
 *      An installed app is a share destination, and the OS delivers the shared
 *      files as a form POST that no page can see. So the worker takes the
 *      FormData, parks each file in SHARE_CACHE, and answers with a redirect to
 *      the app; the page drains the stash on boot (drop-router.ts's
 *      initShareTargetFileIntake) and sends the files through the same drop
 *      chooser a dropped file gets. See receiveShare.
 *
 * The catalog INDEX files (/catalog/tools|assets/index.json) need fresh data, so
 * they still bypass the service worker entirely (checked after the previews path).
 *
 * Because hashed assets are immutable, the new SW claiming clients mid-session is
 * safe (it can't swap a running page's chunks), so no skipWaiting update-prompt
 * flow is needed.
 *
 * Bump CACHE on any change to this file to evict the previous generation's
 * entries on activate (a one-time clear of anything already gone stale).
 */

// v16: the PWA share target ships (plan 202 WP4.3) - one POST branch in fetch,
// plus SHARE_CACHE on the activate keep-list.
// v15: /catalog/previews/bundle.json changed FORMAT (plans/155 Task 2.4) - it went from
// a 2.64 MB payload with each look's SVG inlined to a 29 KB manifest of look URLs, and
// left PRECACHE_URLS with it. A format change is exactly what a generation bump is for:
// this SWR route caches the manifest in THIS bucket, so without the bump a returning
// visitor is served the old inlined file first (stale-while-revalidate answers from
// cache), and lib/preview-bundle.ts - which now reads only `src` - sees entries that
// carry `svg` alone, returns null for every one of them, and the whole gallery falls
// back to live engine renders for a load. It self-heals on the NEXT visit; the bump
// means there is no first one to pay for it.
// v14: the Kokoro speech buckets ('transformers-cache', 'lolly-speech') join
// the activate keep-list - before this, every SW update deleted the ~92 MB
// model and the voice bins.
// v13: the "Available offline" download manager (profile view) ships - /fonts/
// gains a cache-first rule, and three page-owned unversioned buckets join
// lolly-pins: lolly-app (pre-downloaded build assets), lolly-ort (the ONNX
// runtime for /verify's deep scan), lolly-info (the /info docs site).
const CACHE = 'lolly-v16';

// Tools pinned "available offline": the page writes /tools/<id>/* copies into
// this SEPARATE, unversioned bucket (shells/web/src/lib/offline-pins.ts - keep
// the two literals in sync). Deliberately NOT tied to the CACHE generation:
// activate below never deletes it, so pins survive service-worker updates. The
// page owns its lifecycle (pin writes, unpin deletes); the fetch path only
// READS it, as the last-resort fallback for /tools/ requests.
const PIN_CACHE = 'lolly-pins';

// Tools SIDELOADED from a .lolly share file (shells/web/src/lib/installed-tools.ts -
// keep the two literals in sync). The page writes /tools/<id>/* copies here; unlike a
// catalog tool these have no network home, so this bucket is served CACHE-FIRST for
// /tools/ (below) rather than as a last-resort fallback. Same persistence contract as
// PIN_CACHE: activate never deletes it, the page owns writes/evictions.
const INSTALLED_CACHE = 'lolly-installed';

// The other three page-owned, unversioned buckets, written by the profile
// view's "Available offline" download manager (shells/web/src/lib/
// offline-manager.ts - keep the literals in sync). Same lifecycle contract as
// PIN_CACHE: activate never deletes them, the page owns writes/evictions.
//
//   APP_CACHE  - the full build payload enumerated by dist/precache.json
//                (hashed /assets/ chunks, /fonts/, icons, share stubs). Read as
//                the fallback when the versioned CACHE misses on an immutable
//                path, so a pre-downloaded app boots fully offline even across
//                a CACHE-generation bump (hashed filenames can't go stale; the
//                manager re-syncs the bucket against each deploy's manifest).
//   ORT_CACHE  - /ort/ + /ort-hf/ (two onnxruntime-web wasm runtimes: the 1.27
//                build the watermark scanners use, and the build transformers.js
//                pins for Kokoro speech - different versions, both same-origin,
//                ~95 MB + ~22 MB). Cache-first
//                HERE TOO (not just on explicit download): the runtime imports
//                these via dynamic import()/fetch at scan time, and re-pulling
//                tens of MB per session helps nobody. Opt-in bulk download
//                fills it; a normal deep scan tops it up organically.
//   INFO_CACHE - the /info docs site, keyed PER URL (never SHELL_URL - see the
//                /info hazard note in BYPASS_PATTERNS). Network-first so docs
//                stay current; the bucket only answers when the network can't.
const APP_CACHE = 'lolly-app';
const ORT_CACHE = 'lolly-ort';
// The transformers.js speech runtime (/ort-hf/<version>/ort-wasm-*), OWNED by the
// speech offline part so pre-downloading Speech is offline-complete. It used to live
// in ORT_CACHE (downloaded by the verify part); /ort-hf/ now serves from HERE and
// falls back to ORT_CACHE for users who pre-downloaded it via Verify before the split.
const ORT_HF_CACHE = 'lolly-ort-hf';
const INFO_CACHE = 'lolly-info';

// The Kokoro speech buckets. 'transformers-cache' is transformers.js's OWN
// Cache Storage bucket name (hard-coded in the library's hub.js) - it holds
// the ~92 MB model + tokenizer the speech worker loads; keep the literal in
// sync with the library. 'lolly-speech' is ours: the voice style vectors,
// written by shells/web/src/lib/speech-kokoro-worker.ts. Neither is written
// by this worker, but both MUST survive activate - before v14 the generation
// sweep deleted them on every SW update, re-downloading the model each time.
const TRANSFORMERS_CACHE = 'transformers-cache';
const SPEECH_CACHE = 'lolly-speech';

// The share-target inbox: files an OS share sheet posted to this app, waiting for
// the page to pick them up (shells/web/src/lib/drop-router.ts SHARE_CACHE - keep
// the two literals in sync). Written HERE (the only bucket this worker owns that
// the page does not fill) and emptied by the page on the next boot. It joins the
// keep-list because a share can arrive across a worker update, and losing the
// handoff would drop the user's file with nothing to show for it.
const SHARE_CACHE = 'lolly-share-inbox';

// The path the manifest's share_target posts to, and the address the browser is
// sent to afterwards (keep both in step with manifest.webmanifest).
const SHARE_TARGET_PATH = '/share-target';
const SHARE_REDIRECT = '/?share-target=1';

// Every bucket that survives a CACHE-generation bump (activate's keep-list).
const PERSISTENT_CACHES = [PIN_CACHE, INSTALLED_CACHE, APP_CACHE, ORT_CACHE, ORT_HF_CACHE, INFO_CACHE, TRANSFORMERS_CACHE, SPEECH_CACHE, SHARE_CACHE];

// Stable key the app-shell document is cached under for the offline fallback.
// Every SPA navigation (/, /pro, /tool/...) resolves to the same index.html, so
// one canonical entry serves them all - but ONLY navigations the SPA actually
// owns may be stored under it. See isShellNavigation.
const SHELL_URL = '/';

// How long a tool-file fetch may run before we give up and serve cache instead.
// Long enough that a healthy connection always wins (fresh); short enough that a
// dead/flaky one fails over to cache without a painful stall.
const NETWORK_TIMEOUT_MS = 2500;

// Offline-first: precache the app SHELL at install - and ONLY the shell - so a cold
// offline load works immediately (even before the first successful navigation caches
// it). Nothing else belongs here. We do NOT precache tool-specific libs: the old ~395 KB
// meeting-planner map bundle (d3 + countries-110m) was paid by every visitor on install
// regardless of ever opening that tool; it now caches network-first under /tools/ on
// first actual use, so meeting-planner still works offline for anyone who's opened it
// once online. The preview-look manifest was here too, on the same reasoning, and cost
// the same way: it made every cold load fetch /catalog/previews/bundle.json TWICE (once
// here, once from the page), for a file the /catalog/previews/ stale-while-revalidate
// route below already caches on its first real use.
const PRECACHE_URLS = [
  SHELL_URL,
];

// Preview images + the look manifest (bundle.json): stale-while-revalidate (see strategy
// #4). Matched BEFORE the /catalog/ bypass, exactly like /catalog/fonts/ above.
const PREVIEW_PATTERN = /^\/catalog\/previews\//;

// Cache-first: content-hashed Vite build output, plus the bundled variable fonts
// (stable filenames, effectively immutable - refreshed by a CACHE bump). Checked
// before CACHE_PATTERNS so fonts under /tools/ take this path, not network-first.
const IMMUTABLE_PATTERNS = [
  /^\/assets\//,
  // The bundled app UI fonts (SUSE + SUSE Mono variable woff2, and the legacy
  // Outfit face, all under /fonts/) -
  // stable filenames, preloaded on every page. Before v13 these had NO rule at
  // all, so an HTTP-cache eviction meant system-ui offline.
  /^\/fonts\//,
  // The brand webfonts (variable woff2) live under /catalog/fonts/ and are
  // preloaded on every page. Stable filenames → cache-first (refreshed by a CACHE
  // bump). Must be matched BEFORE the /catalog/ bypass below, so this list is
  // checked first in the fetch handler.
  /^\/catalog\/fonts\//,
];

// The onnxruntime-web runtimes, cache-first out of their OWN persistent buckets so
// each offline part is self-complete. /ort/ (verify's deep scan) → ORT_CACHE. The
// Kokoro/Whisper speech worker's pinned build at /ort-hf/<version>/ (the release-
// versioned subdir scripts/copy-transformers-ort.ts emits, so cache-first can never
// pin a stale wasm across a transformers.js upgrade) → ORT_HF_CACHE, falling back to
// ORT_CACHE for users who pre-downloaded it via Verify before the split. Prefix
// matches, so each versioned subdir is covered.
const ORT_PATTERN = /^\/ort\//;
const ORT_HF_PATTERN = /^\/ort-hf\//;

// The /info docs site: network-first per URL with INFO_CACHE as the offline
// fallback - see INFO_CACHE above and the /info note in BYPASS_PATTERNS.
const INFO_PATTERN = /^\/info(\/|$)/;

// Network-first tool assets; let catalog + API requests pass through to network.
const CACHE_PATTERNS = [
  /^\/tools\//,
];

// TrustMark ONNX watermark-decoder models (/verify's "Deep scan for
// watermarks", tens of MB each) bypass the SW's own Cache Storage entirely -
// shells/web/src/lib/trustmark.ts fetches and caches the bytes itself in
// IndexedDB (mirroring the Google-Fonts fetch-once pattern), so letting the
// SW ALSO cache them here would just double the on-device copies for no
// benefit. Listed explicitly (rather than relying on falling through
// unmatched) so a future edit to CACHE_PATTERNS can't accidentally catch it.
const BYPASS_PATTERNS = [
  /^\/catalog\//,
  /^\/api\//,
  /^\/models\//,
  // /.well-known/ (security.txt, the MCP OAuth metadata routes) is plain-text /
  // JSON policy data: a NAVIGATION to it must not run through the document
  // branch below, which would cache a non-HTML body as the app shell.
  /^\/\.well-known\//,
  // NOTE /info is no longer in this list. It used to be bypassed outright - a
  // navigation there is REAL static HTML, and storing one under SHELL_URL once
  // poisoned the offline boot (reading the privacy policy replaced the cached
  // app shell). It now has its own handler (networkFirstInfo, matched BEFORE
  // this list) which keys strictly PER URL in its own INFO_CACHE bucket and
  // never touches SHELL_URL, so the docs can be downloaded for offline without
  // reintroducing that hazard.
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(async cache => {
      await cache.addAll(PRECACHE_URLS);                    // shell - atomic, must succeed
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  // Remove caches from previous versions - never the page-owned persistent
  // buckets (pins, pre-downloaded app/ort/info - see PERSISTENT_CACHES).
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && !PERSISTENT_CACHES.includes(k)).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // The share target: the ONE non-GET request this worker answers. Checked before
  // the GET gate below, and before every routing rule, because no other branch can
  // ever match a POST.
  if (request.method === 'POST' && url.pathname === SHARE_TARGET_PATH) {
    event.respondWith(receiveShare(event));
    return;
  }
  if (request.method !== 'GET') return;

  // Immutable hashed build assets + fonts: cache-first (safe - filenames are
  // content-hashed or stable). Checked BEFORE the bypass so /catalog/fonts/ is
  // cached rather than passed straight to network like the rest of /catalog/.
  if (IMMUTABLE_PATTERNS.some(p => p.test(url.pathname))) {
    event.respondWith(cacheFirst(event));
    return;
  }

  // Preview images + the look manifest under /catalog/previews/: stale-while-revalidate.
  // Checked BEFORE the /catalog/ bypass so they're cached (repeat loads = cache hits, and
  // offline), while the catalog INDEX just below still bypasses to stay fetch-fresh.
  if (PREVIEW_PATTERN.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event));
    return;
  }

  // The speech runtime (/ort-hf/): cache-first from the speech-owned bucket, falling
  // back to ORT_CACHE for users who pre-downloaded it via the Verify part before the
  // split, then the network (filling ORT_HF_CACHE). Checked before /ort/ (disjoint).
  if (ORT_HF_PATTERN.test(url.pathname)) {
    event.respondWith(cacheFirstInEither(ORT_HF_CACHE, ORT_CACHE, event));
    return;
  }
  // The ONNX runtime: cache-first from its own persistent bucket (see ORT_CACHE).
  if (ORT_PATTERN.test(url.pathname)) {
    event.respondWith(cacheFirstIn(ORT_CACHE, event));
    return;
  }

  // The /info docs site: network-first per URL, offline fallback from the
  // downloaded-docs bucket. Handles navigations too (checked BEFORE the
  // navigate branch), and never writes SHELL_URL - see networkFirstInfo.
  if (INFO_PATTERN.test(url.pathname)) {
    event.respondWith(networkFirstInfo(event));
    return;
  }

  // Same-origin /api/ + /catalog/: always straight to the network - even for a
  // navigation. The CA OAuth popup NAVIGATES to /api/ca/auth/<provider>, which
  // must 302 to the provider; serving it the cached SPA shell (as the navigate
  // branch below would) lands the popup on the gallery and enrollment can never
  // start. Checked BEFORE the navigate branch for exactly that reason.
  if (BYPASS_PATTERNS.some(p => p.test(url.pathname))) return;

  // Navigations: network-first so a new deploy is picked up, with the cached
  // shell as the offline fallback (this is what enables the offline cold load).
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstDocument(event));
    return;
  }

  if (CACHE_PATTERNS.some(p => p.test(url.pathname))) {
    event.respondWith(networkFirst(event));
    return;
  }

  // Everything else same-origin (/viz-presets/, /voice/, /icons/, the share
  // stubs under /t/ and /view/, manifest.webmanifest, …): pass straight to the
  // network as before, but fall back to the pre-downloaded APP_CACHE when the
  // network fails. Without this, most of what "download the app" stores could
  // never be SERVED - the download filled the bucket and only /assets/ +
  // fonts ever read it back. Online behaviour is byte-identical (network
  // response wins; nothing is written).
  event.respondWith(networkThenAppCache(event));
});

/**
 * The share target. An OS share sheet POSTs the shared files as multipart form
 * data to SHARE_TARGET_PATH; that request never reaches a page, so the worker is
 * the only place that can read it. Each file is parked in SHARE_CACHE under a
 * synthetic key, carrying its name in a header (percent-encoded, so a non-ASCII
 * filename stays a legal header value), and the browser is redirected into the
 * app - where drop-router.ts's initShareTargetFileIntake drains the stash and
 * opens the ordinary drop chooser over it.
 *
 * A new share clears whatever an earlier one left: the stash is a handoff, not a
 * queue, and the page always takes the whole of it. Any failure still redirects,
 * because leaving the user on a blank POST response would be the worst outcome
 * available - they arrive in the app with nothing imported instead.
 */
async function receiveShare(event) {
  try {
    const form = await event.request.formData();
    const files = form.getAll('files').filter(f => f && typeof f.name === 'string' && typeof f.size === 'number');
    const cache = await caches.open(SHARE_CACHE);
    for (const key of await cache.keys()) await cache.delete(key);
    let i = 0;
    for (const file of files) {
      await cache.put(`${SHARE_TARGET_PATH}/stash/${i++}`, new Response(file, {
        headers: {
          'content-type': file.type || 'application/octet-stream',
          'x-lolly-share-name': encodeURIComponent(file.name || 'shared-file'),
        },
      }));
    }
  } catch { /* unreadable share - still open the app for them */ }
  return Response.redirect(SHARE_REDIRECT, 303);
}

// Cache-first for immutable resources: serve the cached copy if present;
// otherwise fetch, cache an ok response, and return it. The versioned CACHE is
// consulted first (organic runtime caching), then the page-owned APP_CACHE
// bucket the offline download manager fills - so a pre-downloaded install
// serves every chunk/font offline even when this CACHE generation is fresh
// and empty (immutable content-hashed filenames make the fallback safe).
async function cacheFirst(event) {
  const { request } = event;
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const downloaded = await caches.match(request, { cacheName: APP_CACHE }).catch(() => undefined);
  if (downloaded) {
    // Serve the pre-downloaded copy, but freshen the generation cache in the
    // background: /fonts/ names are stable, so without this a CACHE bump
    // could pin a downloaded font forever (hashed /assets/ names make the
    // revalidate a cheap no-op-equivalent there - same bytes come back).
    event.waitUntil(
      fetch(request).then(r => { if (r && r.ok) return cache.put(request, r.clone()); }).catch(() => {})
    );
    return downloaded;
  }
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

// Network-first with the pre-downloaded app bucket as the offline fallback -
// the read path for everything in the `app` download group that no earlier
// rule owns. Never caches online responses itself: the page-owned download
// (and its resync) is the sole writer of APP_CACHE.
async function networkThenAppCache(event) {
  const { request } = event;
  try {
    return await fetch(request);
  } catch {
    const cached = await caches.match(request, { cacheName: APP_CACHE }).catch(() => undefined);
    return cached || new Response('Offline', { status: 503 });
  }
}

// Cache-first in a NAMED persistent bucket (the /ort/ runtime): a miss fetches
// and fills that same bucket, so organic use and the explicit bulk download
// land in one place and never hold double copies.
// A cached RUNTIME file (the ORT loader .mjs and its .wasm) is only servable if it
// carries the cross-origin-embedder-policy header the page now runs under. The
// threaded runtime starts its pthread helpers as nested workers from that loader
// URL, and a worker script whose response has no COEP is refused by a
// cross-origin-isolated document - silently: the session waits for helpers that
// never start, so TTS, speech-to-text and the image models sat at 100% forever.
// The persistent buckets pinned responses stored BEFORE the isolation headers
// shipped (their bytes matched the network exactly; only the headers were stale),
// and cache-first served them for good (measured 2026-09-02 on lolly.tools).
// A stale hit is dropped and refetched; if the network is down the stale copy
// is still better than a 503 (an offline user keeps whatever worked for them).
function isolationCompatible(response) {
  return response.headers.has('cross-origin-embedder-policy');
}

async function refreshRuntime(cache, request, stale) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await cache.put(request, response.clone());
      return response;
    }
    return stale || response;
  } catch {
    return stale || new Response('Offline', { status: 503 });
  }
}

async function cacheFirstIn(cacheName, event) {
  const { request } = event;
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached && isolationCompatible(cached)) return cached;
  if (cached) await cache.delete(request);
  return refreshRuntime(cache, request, cached);
}

// Like cacheFirstIn, but checks a SECOND (legacy) bucket on a miss before the network -
// the migration path for /ort-hf/. New downloads land in the PRIMARY bucket (ORT_HF_CACHE,
// speech-owned); a user who pre-downloaded the runtime via the Verify part still has it in
// the fallback (ORT_CACHE), so serve that before giving up to the network. A network fetch
// fills the PRIMARY bucket so future hits consolidate there and one copy is held.
async function cacheFirstInEither(primaryCache, fallbackCache, event) {
  const { request } = event;
  const primary = await caches.open(primaryCache);
  const hit = await primary.match(request);
  if (hit && isolationCompatible(hit)) return hit;
  if (hit) await primary.delete(request);
  const fallback = await caches.open(fallbackCache);
  const legacy = await fallback.match(request);
  if (legacy && isolationCompatible(legacy)) return legacy;
  if (legacy) await fallback.delete(request);
  return refreshRuntime(primary, request, hit || legacy);
}

// Network-first for the /info docs site, keyed strictly PER URL in INFO_CACHE.
// Online: serve the network copy, and if the docs bucket already holds this
// URL (the user downloaded the docs), refresh that copy in passing so a
// downloaded docs set tracks the live site instead of freezing at download
// time. Offline: serve the bucket copy. A directory URL (/info/, /info/de/)
// normalises to its index.html, matching how the manager stores the manifest's
// file paths. NEVER touches SHELL_URL - that hazard is documented at
// BYPASS_PATTERNS.
async function networkFirstInfo(event) {
  const { request } = event;
  const url = new URL(request.url);
  // The candidate cache keys for this URL, canonical first. A trailing slash
  // (or bare /info) is a directory index; an extensionless last segment
  // (/info/de - how a typed locale URL usually arrives) resolves to that
  // directory's index.html on the server, so it must here too.
  const p = url.pathname;
  const last = p.slice(p.lastIndexOf('/') + 1);
  const keys = p.endsWith('/') ? [p + 'index.html']
    : p === '/info' ? ['/info/index.html']
    : last.includes('.') ? [p]
    : [p + '/index.html', p];
  const cache = await caches.open(INFO_CACHE);
  const match = async () => {
    for (const k of keys) {
      const held = await cache.match(k);
      if (held) return held;
    }
    return undefined;
  };
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      const held = await cache.match(keys[0]);
      if (held) event.waitUntil(cache.put(keys[0], fresh.clone()));
      return fresh;
    }
    return (await match()) || fresh;
  } catch {
    return (await match()) || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

// Stale-while-revalidate for preview art: serve the cached copy immediately (fast, offline-
// capable) and kick off a background fetch that refreshes the cache for next time. With
// nothing cached yet, wait on the network. Only ok responses are cached, so a transient 404/
// 5xx never poisons the cache. Used for /catalog/previews/ (thumbnails + the look manifest) -
// regenerable art where one-load staleness is harmless, unlike the fetch-fresh catalog index.
async function staleWhileRevalidate(event) {
  const { request } = event;
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(response => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  if (cached) {
    event.waitUntil(network); // freshen in the background; don't block the response
    return cached;
  }
  return (await network) || new Response('Offline', { status: 503 });
}

// Network-first for the app-shell document: when online, ALWAYS serve (and re-cache)
// the current deploy's HTML, then fall back to the last cached shell only when the
// network actually fails (offline). This is deliberately NOT stale-while-revalidate:
// serving a one-deploy-stale shell is unsafe because the shell's module graph points
// at that build's content-hashed chunk names, and its LAZY chunks (the tool view, the
// profile view, …) were never cached during the session - so after a new deploy removes
// those files, the first navigation into a tool fetches a chunk that's gone and dies
// with "Failed to fetch dynamically imported module". Network-first eliminates that at
// the source; the cost is only the small HTML round-trip (the hashed JS/CSS it pulls
// stay cache-first, so first paint's heavy assets are still instant). Cold with no
// cache yet returns the 503 offline sentinel. (See also the vite:preloadError reload
// handler in main.ts, which recovers any client already holding a stale shell.)
async function networkFirstDocument(event) {
  const { request } = event;
  const cache = await caches.open(CACHE);
  const ownsShell = isShellNavigation(new URL(request.url).pathname);
  try {
    const fresh = await fetch(request);
    // Only a navigation the SPA actually owns may be written to the shell key -
    // storing a real static document there poisons the offline boot for every
    // other route. BYPASS_PATTERNS already keeps the known static paths out of
    // this function; this is the backstop for the next one somebody adds.
    if (fresh && fresh.ok) { if (ownsShell) cache.put(SHELL_URL, fresh.clone()); return fresh; }
    // Server reachable but unhappy (5xx) - a cached shell beats an error page,
    // but only where the shell is what the URL should have served anyway.
    const cached = ownsShell ? await matchShell(cache) : null;
    return cached || fresh;
  } catch {
    // Offline - serve the last good shell so the app still boots. A non-shell
    // document gets the offline sentinel instead: answering it with the app
    // would be the same lie the shell-key bug used to tell, just in reverse.
    const cached = ownsShell ? await matchShell(cache) : null;
    return cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

// The offline shell: this generation's SHELL_URL entry first, then the
// pre-downloaded app bucket's /index.html - so an install whose versioned
// cache was evicted (or never navigated since the last bump) still cold-boots
// from an explicit "download the app".
async function matchShell(cache) {
  return (await cache.match(SHELL_URL))
    || (await caches.match('/index.html', { cacheName: APP_CACHE }).catch(() => undefined))
    || null;
}

/**
 * Does this navigation path resolve to the SPA shell?
 *
 * The host rewrites every path that ISN'T a real file to index.html, so the test
 * is simply whether the last segment looks like a filename. `/`, `/pro`,
 * `/t/url-shot` are the app; `/info/privacy.html` and `/tool/qr-code.png` (the
 * hot-link render URLs) are real documents that happen to be reachable by a
 * top-level navigation, and must never be written to SHELL_URL.
 *
 * A trailing slash reads as a directory index (`/info/de/`), which is a real
 * document too - but those live under paths already in BYPASS_PATTERNS, and
 * treating a bare `/` as the shell is the whole point, so only a non-empty final
 * segment is inspected.
 */
function isShellNavigation(pathname) {
  const last = pathname.slice(pathname.lastIndexOf('/') + 1);
  return !last.includes('.');
}

// Race the network against NETWORK_TIMEOUT_MS. A fresh, ok response wins and
// refreshes the cache. A timeout / network error / non-ok response falls back to
// the cached copy (keeping the in-flight fetch alive via waitUntil so the cache
// still freshens for next time). With nothing cached, return whatever the
// network ultimately gives, or a 503 if it never arrives.
async function networkFirst(event) {
  const { request } = event;

  // A sideloaded tool's files live only in INSTALLED_CACHE (no network home), so serve
  // them CACHE-FIRST - a network round-trip would 404 or, worse, return the SPA shell.
  // Catalog tools are never written here, so they still take the network-first path below.
  const url = new URL(request.url);
  if (url.pathname.startsWith('/tools/')) {
    const installed = await caches.match(request, { cacheName: INSTALLED_CACHE }).catch(() => undefined);
    if (installed) return installed;
  }

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

  // Network lost the race (slow), failed, or returned non-ok → try this
  // generation's cache, then the pinned-tools bucket (a pinned tool must serve
  // even if it was never opened during this cache generation).
  const cached = await cache.match(request)
    || await caches.match(request, { cacheName: PIN_CACHE }).catch(() => undefined);
  if (cached) {
    event.waitUntil(network); // let the slow fetch finish and update the cache
    return cached;
  }
  return (await network) || new Response('Offline', { status: 503 });
}
