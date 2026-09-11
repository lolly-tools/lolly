// SPDX-License-Identifier: MPL-2.0
/**
 * Service-worker fetch-routing tests.
 *
 * `public/sw.js` ships as a classic (non-module) worker script, so it cannot be
 * imported: it registers `self.addEventListener` at top level and has no exports.
 * Instead the real file is read from disk and evaluated in a `node:vm` context
 * holding a minimal worker environment - a fake `self`, an in-memory Cache
 * Storage, and a `fetch` the test drives. The handlers under test are therefore
 * the SHIPPING ones, not a transcription of them.
 *
 * The regression this exists for: every successful navigation used to be written
 * to the `SHELL_URL` ('/') cache key, on the assumption that every navigation
 * resolves to the SPA's index.html. The /info docs site is ~41 pages × 27 locales
 * of real static HTML that does NOT, so opening the privacy policy replaced the
 * cached app shell with that page and the next offline load of the app served
 * documentation instead of the app.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';

const SW_SRC = fileURLToPath(new URL('../public/sw.js', import.meta.url));

/** Minimal in-memory stand-in for one Cache instance. */
class FakeCache {
  entries = new Map<string, string>();
  /** Response headers stored beside the body - the share-target stash keys each
   *  file's name off one, so the round-trip has to survive the cache. */
  meta = new Map<string, Record<string, string>>();
  /** Keys stored BEFORE the isolation headers shipped: their response carries no
   *  cross-origin-embedder-policy, the same form as the stale runtime entries the
   *  worker must refetch (sw.js isolationCompatible, 2026-09-02). */
  stale = new Set<string>();
  private key(req: { url?: string } | string): string {
    const key = typeof req === 'string' ? req : (req.url ?? '');
    return this.entries.has(key) ? key : new URL(key, 'https://x').pathname;
  }
  async match(req: { url?: string } | string) {
    const key = this.key(req);
    const body = this.entries.get(key);
    return body === undefined
      ? undefined
      : makeResponse(body, { coep: !this.stale.has(key), headers: this.meta.get(key) });
  }
  async put(req: { url?: string } | string, res: { _body: string; _headers?: Record<string, string> }) {
    const key = typeof req === 'string' ? req : (req.url ?? '');
    this.entries.set(key, res._body);
    if (res._headers) this.meta.set(key, res._headers);
    this.stale.delete(key);
  }
  async delete(req: { url?: string } | string) {
    const key = this.key(req);
    this.stale.delete(key);
    this.meta.delete(key);
    return this.entries.delete(key);
  }
  /** Request-shaped keys, the way Cache.keys() answers - the share stash walks them. */
  async keys() { return [...this.entries.keys()].map((url) => ({ url })); }
  async addAll(urls: string[]) { for (const u of urls) this.entries.set(u, `precached:${u}`); }
  async add(url: string) { this.entries.set(url, `precached:${url}`); }
}

/** A network response carries today's headers (isolation included); `coep: false`
 *  models a response stored before those headers existed. */
function makeResponse(body: string, init: { status?: number; coep?: boolean; headers?: Record<string, string> } = {}) {
  const status = init.status ?? 200;
  const names = new Set(init.coep === false ? ['content-type'] : ['content-type', 'cross-origin-embedder-policy']);
  const extra = init.headers ?? {};
  for (const n of Object.keys(extra)) names.add(n.toLowerCase());
  return {
    _body: body, status, ok: status >= 200 && status < 300, _headers: extra,
    headers: {
      has: (n: string) => names.has(n.toLowerCase()),
      get: (n: string) => extra[n.toLowerCase()] ?? null,
    },
    clone() { return this; },
  };
}

interface Harness {
  fetchHandler: (event: unknown) => void;
  caches: Map<string, FakeCache>;
  /** Set to make the network fail (simulates offline). */
  offline: { value: boolean };
  /** What the network returns, keyed by pathname. */
  server: Map<string, string>;
  install: () => Promise<void>;
  activate: () => Promise<void>;
}

/** Evaluate the real sw.js in a sandbox and hand back its registered handlers. */
function loadServiceWorker(): Harness {
  const src = readFileSync(SW_SRC, 'utf8');
  const listeners = new Map<string, (event: unknown) => void>();
  const cacheStore = new Map<string, FakeCache>();
  const offline = { value: false };
  const server = new Map<string, string>();

  const cachesApi = {
    async open(name: string) {
      if (!cacheStore.has(name)) cacheStore.set(name, new FakeCache());
      return cacheStore.get(name)!;
    },
    async keys() { return [...cacheStore.keys()]; },
    async delete(name: string) { return cacheStore.delete(name); },
    async match(req: { url: string }, opts: { cacheName?: string } = {}) {
      const c = opts.cacheName ? cacheStore.get(opts.cacheName) : undefined;
      return c ? c.match(req) : undefined;
    },
  };

  const sandbox = {
    self: {
      addEventListener: (type: string, fn: (event: unknown) => void) => listeners.set(type, fn),
      skipWaiting: () => Promise.resolve(),
      clients: { claim: () => Promise.resolve() },
      location: { origin: 'https://lolly.tools' },
    },
    caches: cachesApi,
    fetch: async (req: { url: string }) => {
      if (offline.value) throw new TypeError('Failed to fetch');
      const path = new URL(req.url).pathname;
      const body = server.get(path);
      return body === undefined ? makeResponse('not found', { status: 404 }) : makeResponse(body);
    },
    // The worker constructs responses from a string (the offline sentinel) and
    // from a shared file (the share-target stash), and redirects the share POST
    // back into the app - so the stand-in carries a body reader and `redirect`.
    Response: Object.assign(
      function (body: string | SharedFile, init: { status?: number; headers?: Record<string, string> } = {}) {
        return makeResponse(typeof body === 'string' ? body : body._body, init);
      },
      {
        redirect(url: string, status = 302) {
          return { ...makeResponse('', { status }), _redirect: url };
        },
      },
    ),
    URL, setTimeout, clearTimeout, Promise, console,
  };
  runInContext(src, createContext(sandbox));

  return {
    fetchHandler: listeners.get('fetch')!,
    caches: cacheStore,
    offline,
    server,
    install: async () => {
      let work: Promise<unknown> = Promise.resolve();
      listeners.get('install')!({ waitUntil: (p: Promise<unknown>) => { work = p; } });
      await work;
    },
    activate: async () => {
      let work: Promise<unknown> = Promise.resolve();
      listeners.get('activate')!({ waitUntil: (p: Promise<unknown>) => { work = p; } });
      await work;
    },
  };
}

/** Drive one request through the fetch handler and return the served body.
 *  Background work handed to waitUntil (cache freshens) is awaited too, so a
 *  test can assert on its effects. */
async function drive(h: Harness, url: string, mode: string): Promise<string | null> {
  const request = { method: 'GET', url, mode };
  // Held on an object, not a `let`: TypeScript's control-flow analysis cannot see
  // the assignment happen inside respondWith, so a local would narrow to `never`.
  const out: { responded: Promise<{ _body: string }> | null } = { responded: null };
  const background: Promise<unknown>[] = [];
  h.fetchHandler({ request, respondWith: (p: Promise<{ _body: string }>) => { out.responded = p; }, waitUntil: (p: Promise<unknown>) => background.push(p) });
  if (!out.responded) return null;   // handler declined → browser handles it (bypass)
  const body = (await out.responded)._body;
  await Promise.allSettled(background);
  return body;
}

/** A file as an OS share sheet hands it over: name, type, size, and its bytes. */
interface SharedFile { name: string; type: string; size: number; _body: string }
const sharedFile = (name: string, type: string, body: string): SharedFile =>
  ({ name, type, size: body.length, _body: body });

/** Drive one share-target POST through the fetch handler and return its response
 *  (the redirect the worker answers with), or null when the handler declined. */
async function share(h: Harness, files: SharedFile[], path = '/share-target') {
  const request = {
    method: 'POST',
    url: `https://lolly.tools${path}`,
    mode: 'navigate',
    formData: async () => ({ getAll: (field: string) => (field === 'files' ? files : []) }),
  };
  const out: { responded: Promise<{ _redirect?: string; status: number }> | null } = { responded: null };
  h.fetchHandler({ request, respondWith: (p: Promise<{ _redirect?: string; status: number }>) => { out.responded = p; }, waitUntil: () => {} });
  return out.responded ? await out.responded : null;
}

/** Drive one navigation through the fetch handler and return the served body. */
const navigate = (h: Harness, url: string): Promise<string | null> => drive(h, url, 'navigate');
/** Drive one subresource request (a script/font/wasm fetch, not a navigation). */
const subresource = (h: Harness, url: string): Promise<string | null> => drive(h, url, 'no-cors');

/** The generation cache the worker is currently writing to. */
function shellEntry(h: Harness): string | undefined {
  for (const [name, cache] of h.caches) {
    if (name.startsWith('lolly-v')) return cache.entries.get('/');
  }
  return undefined;
}

describe('service worker: the app shell key', () => {
  test('an SPA navigation is cached as the shell and served offline', async () => {
    const h = loadServiceWorker();
    h.server.set('/', 'APP_SHELL');
    assert.equal(await navigate(h, 'https://lolly.tools/'), 'APP_SHELL');
    assert.equal(shellEntry(h), 'APP_SHELL', 'a real SPA navigation must populate the shell key');

    h.offline.value = true;
    assert.equal(await navigate(h, 'https://lolly.tools/pro'), 'APP_SHELL',
      'offline, an extensionless route falls back to the cached shell');
  });

  test('a docs navigation does NOT replace the cached app shell', async () => {
    const h = loadServiceWorker();
    h.server.set('/', 'APP_SHELL');
    h.server.set('/info/privacy.html', 'PRIVACY_POLICY_PAGE');
    await navigate(h, 'https://lolly.tools/');
    assert.equal(shellEntry(h), 'APP_SHELL');

    // Reading the privacy policy - the exact reproduction of the bug.
    await navigate(h, 'https://lolly.tools/info/privacy.html');
    assert.equal(shellEntry(h), 'APP_SHELL',
      'visiting an /info page must leave the cached app shell untouched');

    h.offline.value = true;
    assert.equal(await navigate(h, 'https://lolly.tools/'), 'APP_SHELL',
      'the offline app must still boot into the app, not into documentation');
  });

  test('/info serves network-first and never populates the shell key', async () => {
    const h = loadServiceWorker();
    h.server.set('/', 'APP_SHELL');
    h.server.set('/info/using.html', 'USING_PAGE');
    await navigate(h, 'https://lolly.tools/');
    assert.equal(await navigate(h, 'https://lolly.tools/info/using.html'), 'USING_PAGE',
      'online, /info serves the live page');
    assert.equal(shellEntry(h), 'APP_SHELL',
      'an /info navigation must leave the shell key untouched');
  });

  test('a navigation to a real file is never stored as the shell', async () => {
    // The backstop for paths that are NOT in BYPASS_PATTERNS: the hot-link render
    // URLs (/tool/<id>.<ext>) are reachable by a top-level navigation and return
    // an image, which would be just as wrong under the shell key.
    const h = loadServiceWorker();
    h.server.set('/', 'APP_SHELL');
    h.server.set('/tool/qr-code.png', 'PNG_BYTES');
    await navigate(h, 'https://lolly.tools/');
    await navigate(h, 'https://lolly.tools/tool/qr-code.png');
    assert.equal(shellEntry(h), 'APP_SHELL',
      'an extension in the last path segment means it is not the SPA shell');
  });

  test('offline, a non-shell document gets the offline sentinel, not the app', async () => {
    const h = loadServiceWorker();
    h.server.set('/', 'APP_SHELL');
    await navigate(h, 'https://lolly.tools/');
    h.offline.value = true;
    assert.equal(await navigate(h, 'https://lolly.tools/tool/qr-code.png'), 'Offline',
      'answering a document request with the app shell is the same lie in reverse');
  });

  test('install precaches the app shell and nothing else', async () => {
    // Whatever install writes into the generation bucket is a copy every later load is
    // served from until the next CACHE bump, so the list is the app shell alone.
    // /catalog/previews/bundle.json used to be on it, and the cost was paid twice: a
    // duplicate fetch on every cold load, and - when the file changed FORMAT (inlined
    // SVG payload → manifest of URLs, the v15 bump) - a held copy of the old shape that
    // lib/preview-bundle.ts can no longer read. Precached, that copy outlives the deploy;
    // left to the /catalog/previews/ SWR route, it is one stale hop that self-heals.
    const h = loadServiceWorker();
    await h.install();
    const generation = [...h.caches.entries()].find(([name]) => name.startsWith('lolly-v'));
    assert.ok(generation, 'install must open the versioned generation cache');
    assert.deepEqual([...generation[1].entries.keys()], ['/'],
      'PRECACHE_URLS is the shell alone - nothing else may ride the install');
  });

  test('activate drops the previous generation, remediating an already-poisoned shell', async () => {
    const h = loadServiceWorker();
    const stale = new FakeCache();
    stale.entries.set('/', 'PRIVACY_POLICY_PAGE');   // what v11 installs are holding
    h.caches.set('lolly-v11', stale);
    h.caches.set('lolly-pins', new FakeCache());

    await h.activate();

    assert.ok(!h.caches.has('lolly-v11'), 'the poisoned generation must be deleted on activate');
    assert.ok(h.caches.has('lolly-pins'), 'the unversioned pin bucket must survive a generation bump');
  });

  test('activate keeps every page-owned offline-download bucket', async () => {
    // The "Available offline" buckets (lib/offline-manager.ts) hold what the
    // user explicitly downloaded, and the speech buckets hold the ~92 MB
    // Kokoro model ('transformers-cache' - transformers.js's OWN bucket name)
    // plus the voice bins ('lolly-speech', lib/speech-kokoro-worker.ts) - a SW
    // deploy must never take any of them back. Before v14 the generation sweep
    // deleted the two speech buckets on every update.
    //
    // This list is the whole of PERSISTENT_CACHES, deliberately: every entry a
    // CACHE bump must NOT touch is asserted here, so the routine "bump the
    // generation because sw.js changed" (v15 for the bundle.json format change)
    // is covered by a test rather than by reading the filter in activate. The two
    // added with that bump are 'lolly-installed' (sideloaded .lolly tools, which
    // have NO network home - wiping it uninstalls them) and 'lolly-ort-hf'.
    const KEEP = [
      'lolly-pins', 'lolly-installed', 'lolly-app', 'lolly-ort', 'lolly-ort-hf',
      'lolly-info', 'transformers-cache', 'lolly-speech',
    ];
    const h = loadServiceWorker();
    for (const name of KEEP) h.caches.set(name, new FakeCache());
    h.caches.set('lolly-v11', new FakeCache());

    await h.activate();

    for (const name of KEEP) {
      assert.ok(h.caches.has(name), `${name} must survive a generation bump`);
    }
    assert.ok(!h.caches.has('lolly-v11'));
  });
});

describe('service worker: the offline-download buckets', () => {
  test('offline, a downloaded /info page serves from lolly-info, per URL', async () => {
    const h = loadServiceWorker();
    const info = new FakeCache();
    info.entries.set('/info/using.html', 'DOWNLOADED_USING_PAGE');
    info.entries.set('/info/index.html', 'DOWNLOADED_INDEX');
    h.caches.set('lolly-info', info);

    h.offline.value = true;
    assert.equal(await navigate(h, 'https://lolly.tools/info/using.html'), 'DOWNLOADED_USING_PAGE');
    assert.equal(await navigate(h, 'https://lolly.tools/info/'), 'DOWNLOADED_INDEX',
      'a directory URL must normalise to its index.html key');
    assert.equal(await navigate(h, 'https://lolly.tools/info/missing.html'), 'Offline',
      'a page that was never downloaded gets the sentinel, not a wrong page');
  });

  test('online, a successful /info fetch refreshes an already-downloaded copy in passing', async () => {
    const h = loadServiceWorker();
    const info = new FakeCache();
    info.entries.set('/info/using.html', 'STALE_DOWNLOAD');
    h.caches.set('lolly-info', info);
    h.server.set('/info/using.html', 'FRESH_PAGE');

    assert.equal(await navigate(h, 'https://lolly.tools/info/using.html'), 'FRESH_PAGE');
    assert.equal(info.entries.get('/info/using.html'), 'FRESH_PAGE',
      'the held copy must track the live site, not freeze at download time');
  });

  test('online, a page never downloaded is NOT hoarded into lolly-info', async () => {
    const h = loadServiceWorker();
    h.server.set('/info/using.html', 'USING_PAGE');
    await navigate(h, 'https://lolly.tools/info/using.html');
    assert.ok(!h.caches.get('lolly-info')?.entries.has('/info/using.html'),
      'only the explicit docs download decides what lives in the bucket');
  });

  test('a runtime entry cached before the isolation headers is refetched, never served (2026-09-02)', async () => {
    // The persistent buckets pinned pre-COEP responses for good. The threaded runtime
    // starts its pthread helpers as nested workers from the cached loader URL, and a
    // cross-origin-isolated page refuses a worker script with no COEP - silently, so
    // TTS, speech-to-text and the image models sat at 100% forever. A stale hit is
    // dropped and refetched; the bytes were never the problem, the headers were.
    const h = loadServiceWorker();
    const url = 'https://lolly.tools/ort/ort-wasm-simd-threaded.jsep.mjs';
    const bucket = new FakeCache();
    h.caches.set('lolly-ort', bucket);
    bucket.entries.set(url, 'OLD_LOADER');
    bucket.stale.add(url);
    h.server.set('/ort/ort-wasm-simd-threaded.jsep.mjs', 'NEW_LOADER');
    assert.equal(await subresource(h, url), 'NEW_LOADER', 'a COEP-less cached loader must not be served');
    assert.equal(bucket.entries.get(url), 'NEW_LOADER', 'the bucket now holds the refetched copy');
    assert.equal(bucket.stale.has(url), false, 'and it is no longer stale');
    assert.equal(await subresource(h, url), 'NEW_LOADER', 'the healed entry serves cache-first again');
  });

  test('a stale /ort-hf entry in the legacy bucket is refetched into the speech bucket', async () => {
    const h = loadServiceWorker();
    const url = 'https://lolly.tools/ort-hf/1.22.0/ort-wasm-simd-threaded.jsep.mjs';
    const legacy = new FakeCache();
    h.caches.set('lolly-ort', legacy);
    legacy.entries.set(url, 'OLD_HF');
    legacy.stale.add(url);
    h.server.set('/ort-hf/1.22.0/ort-wasm-simd-threaded.jsep.mjs', 'NEW_HF');
    assert.equal(await subresource(h, url), 'NEW_HF');
    assert.equal(h.caches.get('lolly-ort-hf')?.entries.get(url), 'NEW_HF', 'refetched into the primary bucket');
    assert.equal(legacy.entries.has(url), false, 'the stale legacy copy is dropped');
  });

  test('offline, a stale runtime entry is still served rather than a 503', async () => {
    const h = loadServiceWorker();
    const url = 'https://lolly.tools/ort/ort-wasm-simd-threaded.wasm';
    const bucket = new FakeCache();
    h.caches.set('lolly-ort', bucket);
    bucket.entries.set(url, 'OLD_WASM');
    bucket.stale.add(url);
    h.offline.value = true;
    assert.equal(await subresource(h, url), 'OLD_WASM', 'whatever worked for an offline user keeps working');
  });

  test('/ort is cache-first from lolly-ort and self-populates on first use', async () => {
    const h = loadServiceWorker();
    h.server.set('/ort/ort-wasm-simd-threaded.wasm', 'WASM_BYTES');

    assert.equal(await subresource(h, 'https://lolly.tools/ort/ort-wasm-simd-threaded.wasm'), 'WASM_BYTES');
    h.offline.value = true;
    assert.equal(await subresource(h, 'https://lolly.tools/ort/ort-wasm-simd-threaded.wasm'), 'WASM_BYTES',
      'once fetched, the runtime must serve offline from its bucket');
  });

  test('/ort-hf (the speech worker\'s pinned transformers.js runtime) serves offline from its own bucket', async () => {
    // The served path is versioned (/ort-hf/<onnxruntime-web version>/ - 
    // scripts/copy-transformers-ort.ts), so a transformers.js upgrade is a cache
    // MISS instead of a stale wasm pinned forever. The speech part OWNS this runtime
    // now (lolly-ort-hf); a network fetch fills that bucket and serves it offline.
    const h = loadServiceWorker();
    const url = 'https://lolly.tools/ort-hf/1.22.0-dev.20250409-89f8206ba4/ort-wasm-simd-threaded.jsep.wasm';
    h.server.set('/ort-hf/1.22.0-dev.20250409-89f8206ba4/ort-wasm-simd-threaded.jsep.wasm', 'HF_WASM_BYTES');

    assert.equal(await subresource(h, url), 'HF_WASM_BYTES');
    h.offline.value = true;
    assert.equal(await subresource(h, url), 'HF_WASM_BYTES',
      'once fetched, /ort-hf/ serves offline from lolly-ort-hf');
  });

  test('/ort-hf falls back to the legacy lolly-ort bucket - Verify pre-downloaders are not stranded', async () => {
    // Migration: before the ort/ortHf split, the runtime was downloaded by the VERIFY
    // part into lolly-ort. The SW now checks lolly-ort-hf first, then lolly-ort, so a
    // user who pre-downloaded it via Verify keeps offline speech without a re-download.
    const h = loadServiceWorker();
    const path = '/ort-hf/1.22.0-dev.20250409-89f8206ba4/ort-wasm-simd-threaded.jsep.wasm';
    const legacy = new FakeCache();
    legacy.entries.set(path, 'LEGACY_HF_BYTES');
    h.caches.set('lolly-ort', legacy);
    h.offline.value = true;
    assert.equal(await subresource(h, `https://lolly.tools${path}`), 'LEGACY_HF_BYTES',
      'offline, with the runtime only in the legacy lolly-ort bucket, /ort-hf/ is still served');
  });

  test('the whole app group serves offline - not just /assets/: voice, viz-presets, share stubs', async () => {
    // Regression pin for the review finding that downloadApp filled lolly-app
    // with /voice/, /viz-presets/, /t/ etc. but no fetch-handler rule ever
    // read the bucket for those paths - "downloaded" yet unservable.
    const h = loadServiceWorker();
    const app = new FakeCache();
    app.entries.set('/voice/welcome.mp3', 'MP3_BYTES');
    app.entries.set('/viz-presets/stock.json', 'PRESETS');
    app.entries.set('/t/qr-code.html', 'SHARE_STUB');
    h.caches.set('lolly-app', app);

    h.offline.value = true;
    assert.equal(await subresource(h, 'https://lolly.tools/voice/welcome.mp3'), 'MP3_BYTES');
    assert.equal(await subresource(h, 'https://lolly.tools/viz-presets/stock.json'), 'PRESETS');
    assert.equal(await subresource(h, 'https://lolly.tools/t/qr-code.html'), 'SHARE_STUB');
  });

  test('online, the generic app fallback never intercepts or hoards the network copy', async () => {
    const h = loadServiceWorker();
    h.server.set('/viz-presets/stock.json', 'LIVE_PRESETS');
    assert.equal(await subresource(h, 'https://lolly.tools/viz-presets/stock.json'), 'LIVE_PRESETS');
    assert.ok(!h.caches.get('lolly-app')?.entries.has('/viz-presets/stock.json'),
      'only the explicit app download writes the bucket');
  });

  test('the shell cold-boots from the downloaded app bucket when the generation cache is empty', async () => {
    const h = loadServiceWorker();
    const app = new FakeCache();
    app.entries.set('/index.html', 'DOWNLOADED_SHELL');
    h.caches.set('lolly-app', app);

    h.offline.value = true;
    assert.equal(await navigate(h, 'https://lolly.tools/pro'), 'DOWNLOADED_SHELL',
      'an explicit "download the app" must survive a wiped/fresh CACHE generation');
  });

  test('offline, an extensionless /info locale URL resolves to its downloaded index.html', async () => {
    const h = loadServiceWorker();
    const info = new FakeCache();
    info.entries.set('/info/de/index.html', 'GERMAN_DOCS_INDEX');
    h.caches.set('lolly-info', info);

    h.offline.value = true;
    assert.equal(await navigate(h, 'https://lolly.tools/info/de'), 'GERMAN_DOCS_INDEX',
      '/info/de (no trailing slash) is how a typed locale URL arrives');
  });

  test('immutable assets fall back to the pre-downloaded lolly-app bucket', async () => {
    // A fresh CACHE generation is empty; a user who pre-downloaded the app must
    // still get every chunk and font offline.
    const h = loadServiceWorker();
    const app = new FakeCache();
    app.entries.set('https://lolly.tools/assets/lazy-view-abc123.js', 'CHUNK');
    app.entries.set('https://lolly.tools/fonts/Outfit-latin%5Bwght%5D.woff2', 'FONT');
    h.caches.set('lolly-app', app);

    h.offline.value = true;
    assert.equal(await subresource(h, 'https://lolly.tools/assets/lazy-view-abc123.js'), 'CHUNK');
    assert.equal(await subresource(h, 'https://lolly.tools/fonts/Outfit-latin%5Bwght%5D.woff2'), 'FONT',
      '/fonts/ must have an offline path - before v13 it had no rule at all');
  });
});

describe('service worker: the PWA share target', () => {
  const stash = (h: Harness): FakeCache | undefined => h.caches.get('lolly-share-inbox');

  test('a shared file is parked with its name and the browser is sent to the app', async () => {
    const h = loadServiceWorker();
    const res = await share(h, [sharedFile('Q3 deck.pptx', 'application/vnd.ms-x', 'DECK_BYTES')]);
    assert.equal(res?.status, 303, 'a share POST is answered with a redirect, never a page');
    assert.equal(res?._redirect, '/?share-target=1', 'and it opens the app, where the page drains the stash');

    const parked = stash(h);
    assert.deepEqual([...(parked?.entries.keys() ?? [])], ['/share-target/stash/0']);
    assert.equal(parked?.entries.get('/share-target/stash/0'), 'DECK_BYTES');
    const held = await parked?.match('/share-target/stash/0');
    assert.equal(held?.headers.get('x-lolly-share-name'), 'Q3%20deck.pptx',
      'the filename rides a header, percent-encoded so a non-ASCII name stays a legal header value');
    assert.equal(held?.headers.get('content-type'), 'application/vnd.ms-x');
  });

  test('several files are parked in order; the next share replaces them', async () => {
    const h = loadServiceWorker();
    await share(h, [sharedFile('a.png', 'image/png', 'A'), sharedFile('b.png', 'image/png', 'B')]);
    assert.deepEqual([...(stash(h)?.entries.keys() ?? [])],
      ['/share-target/stash/0', '/share-target/stash/1']);

    await share(h, [sharedFile('c.png', 'image/png', 'C')]);
    assert.deepEqual([...(stash(h)?.entries.entries() ?? [])], [['/share-target/stash/0', 'C']],
      'the stash is a handoff, not a queue - the page always takes the whole of it');
  });

  test('a share carrying no file still opens the app', async () => {
    // Sharing a plain link or note posts the same form with no `files` part. The
    // worker must not leave the browser sitting on an empty POST response.
    const h = loadServiceWorker();
    const res = await share(h, []);
    assert.equal(res?._redirect, '/?share-target=1');
    assert.equal(stash(h)?.entries.size ?? 0, 0);
  });

  test('only a POST to the share path is a share', async () => {
    const h = loadServiceWorker();
    h.server.set('/', 'APP_SHELL');
    h.server.set('/share-target', 'APP_SHELL');
    // A GET of the same path is an ordinary navigation, and a POST anywhere else
    // is left to the network - the handler must decline it.
    assert.equal(await navigate(h, 'https://lolly.tools/share-target'), 'APP_SHELL');
    assert.equal(stash(h), undefined, 'a GET writes nothing to the inbox');
    assert.equal(await share(h, [sharedFile('a.png', 'image/png', 'A')], '/api/anything'), null,
      'the worker answers no other POST');
  });

  test('a share survives a worker update', async () => {
    // The stash is written by the worker and read by the page on the next boot,
    // so a generation bump in between must not throw the file away.
    const h = loadServiceWorker();
    await share(h, [sharedFile('a.png', 'image/png', 'A')]);
    await h.activate();
    assert.equal(stash(h)?.entries.get('/share-target/stash/0'), 'A');
  });
});

describe('precache.json grouping (vite.config.js)', () => {
  // The manifest groups are what offline-manager.ts downloads into the SW's
  // buckets, so their routing is SW behaviour by proxy: a file in the wrong
  // group lands in a bucket no fetch rule ever reads back. Regression pins for
  // the review findings that /ort-hf/ rode the `app` group (lolly-app can
  // never serve it - ORT_PATTERN routes /ort-hf/ to lolly-ort) and that
  // /models/kokoro/ inflated the verify part's models size by ~95 MB, and that
  // the bundler's re-emitted /assets/ort-wasm-*.wasm copies (46.2 MB of the
  // app group's 82.7, byte-identical to the /ort/ + /ort-hf/ originals the
  // groups below own) rode the mandatory offline download.
  //
  // A current build emits no such copy at all (ortWasmFromPublic, covered by the
  // describe below), so the /assets/ort-wasm-* entry in this fixture is a
  // hypothetical - the filter it exercises is the backstop for an ORT upgrade
  // that gets past the rewrite, and it has to keep working while unused.
  const urls = [
    '/index.html',
    '/assets/index-abc123.js',
    '/assets/harfbuzz-CTCWZ5ti.wasm',
    '/assets/ort-wasm-simd-threaded.jsep-DC5y_g6C.wasm',
    '/fonts/Outfit-latin[wght].woff2',
    '/ort/ort-wasm-simd-threaded.wasm',
    '/ort/ort.min.mjs',
    '/ort-hf/1.22.0-dev.20250409-89f8206ba4/ort-wasm-simd-threaded.jsep.wasm',
    '/ort-hf/1.22.0-dev.20250409-89f8206ba4/ort-wasm-simd-threaded.mjs',
    '/models/trustmark/decoder_Q.onnx',
    '/models/kokoro/onnx/model_quantized.onnx',
    '/models/kokoro/voices/af_heart.bin',
    '/models/whisper/onnx/encoder_model_quantized.onnx',
    '/models/upscale/realesr-general-x4v3.onnx',
    '/models/matte/u2netp.onnx',
    '/models/reword/smollm2-360m-instruct/onnx/model_q4.onnx',
    '/models/embed/onnx/model_quantized.onnx',
    '/models/ai-detect/modernbert-raid-mage/onnx/model_quantized.onnx',
  ];

  test('groups route each path to the bucket the SW actually serves it from', async () => {
    const { groupPrecacheFiles } = await import('../vite.config.js');
    const all = urls.map(url => ({ url, size: 1 }));
    const groups = groupPrecacheFiles(all);
    const names = (list: { url: string }[]) => list.map(f => f.url);

    assert.deepEqual(
      names(groups.app),
      ['/index.html', '/assets/index-abc123.js', '/assets/harfbuzz-CTCWZ5ti.wasm', '/fonts/Outfit-latin[wght].woff2'],
      'the app group must exclude /ort/, /ort-hf/ and /models/ (lolly-app never serves those) AND the bundler-emitted '
      + '/assets/ort-wasm-* duplicates - while KEEPING /assets/harfbuzz-*.wasm, which exists nowhere else and is what '
      + 'shapes text into paths for offline SVG/PDF export');
    assert.deepEqual(names(groups.ort), [
      '/ort/ort-wasm-simd-threaded.wasm',
    ], 'the ort group is the /ort/ runtime ONLY (verify\'s deep-scan detectors) - the speech runtime moved to its own ortHf group');
    assert.deepEqual(names(groups.ortHf), [
      '/ort-hf/1.22.0-dev.20250409-89f8206ba4/ort-wasm-simd-threaded.jsep.wasm',
      '/ort-hf/1.22.0-dev.20250409-89f8206ba4/ort-wasm-simd-threaded.mjs',
    ], 'the ortHf group is transformers.js\'s ort-wasm-* runtime - owned by the speech part so downloading Speech is offline-complete');
    // The dropped duplicate must land in NO group: the ort/ortHf groups are anchored on
    // the /ort/ + /ort-hf/ paths, so re-homing it there would only move the 46.2 MB into
    // the opt-in parts, where the originals it duplicates already sit.
    assert.deepEqual(
      Object.entries(groups).filter(([, list]) => names(list).includes('/assets/ort-wasm-simd-threaded.jsep-DC5y_g6C.wasm')),
      [],
      'the bundler\'s /assets/ copy of an ORT runtime belongs to no offline group - /ort/ and /ort-hf/ ship the same bytes');
    assert.deepEqual(names(groups.models), ['/models/trustmark/decoder_Q.onnx'],
      'verify\'s models are the TrustMark ones only - kokoro belongs to the speech part');
    assert.deepEqual(names(groups.speech), [
      '/models/kokoro/onnx/model_quantized.onnx',
      '/models/kokoro/voices/af_heart.bin',
      '/models/whisper/onnx/encoder_model_quantized.onnx',
    ], 'the speech group is the kokoro + whisper model sets - nothing else');
    assert.deepEqual(names(groups.upscale), ['/models/upscale/realesr-general-x4v3.onnx'],
      'the upscale group is the AI-upscaler models only (host.upscale) - SW-bypassed like the others');
    assert.deepEqual(names(groups.matte), ['/models/matte/u2netp.onnx'],
      'the matte group is the background-removal models only (host.matte) - SW-bypassed like the others');
    assert.deepEqual(names(groups.reword), ['/models/reword/smollm2-360m-instruct/onnx/model_q4.onnx'],
      'the reword group is the SmolLM2 model set only (plans/127) - it rides transformers-cache like speech, never the app bucket');
    assert.deepEqual(names(groups.embed), ['/models/embed/onnx/model_quantized.onnx'],
      'the embed group is the Ask matching model only (plans/103 M1) - it rides transformers-cache like speech and reword');
    assert.deepEqual(names(groups.aiDetect), ['/models/ai-detect/modernbert-raid-mage/onnx/model_quantized.onnx'],
      'the aiDetect group is the AI-text detector set only (plans/126 WP-A) - it rides transformers-cache like the others');
  });

  test('mergeModelsManifest fills only the /models/ entries the dist scan is missing', async () => {
    const { mergeModelsManifest } = await import('../vite.config.js');
    const scanned = [
      { url: '/index.html', size: 10 },
      { url: '/models/kokoro/onnx/model_quantized.onnx', size: 999 },   // on disk - scanned truth wins
    ];
    const listing = [
      { url: '/models/kokoro/onnx/model_quantized.onnx', size: 5 },     // stale size must NOT override
      { url: '/models/upscale/realesr-general-x4v3.onnx', size: 7 },    // pruned from dist - filled in
      { url: '/assets/evil.js', size: 1 },                              // non-model listing rows are ignored
    ];
    const merged = mergeModelsManifest(scanned, listing);
    assert.deepEqual(merged.map((f: { url: string; size: number }) => `${f.url}:${f.size}`), [
      '/index.html:10',
      '/models/kokoro/onnx/model_quantized.onnx:999',
      '/models/upscale/realesr-general-x4v3.onnx:7',
    ], 'the committed models listing fills gaps only - scanned files and non-model rows are untouched');
    // Nothing missing → the SAME array back (no re-sort churn, version hash stable).
    assert.equal(mergeModelsManifest(scanned, [listing[0]!]), scanned,
      'a listing fully covered by the scan changes nothing');
  });

  test('release-versioned binaries are exempt from content hashing', async () => {
    const { precacheNeedsHash } = await import('../vite.config.js');
    assert.equal(precacheNeedsHash('/ort/ort-wasm-simd-threaded.wasm'), false);
    assert.equal(precacheNeedsHash('/ort-hf/1.22.0-dev.20250409-89f8206ba4/ort-wasm-simd-threaded.wasm'), false,
      '/ort-hf/ carries its version in the path, like /ort/ and /models/');
    assert.equal(precacheNeedsHash('/models/trustmark/decoder_Q.onnx'), false);
    assert.equal(precacheNeedsHash('/fonts/Outfit-latin[wght].woff2'), true,
      'stable-named files still need the hash to catch same-size content changes');
  });
});

// These cover the ORT wasm URL REWRITE in isolation - that it finds every emittable site in
// the real installed packages, points each at the right staged prefix, and is registered in
// BOTH bundling passes. They still do not observe dist/assets, so a green run here is not by
// itself proof that the duplicates are gone; the build is what settles that.
describe('ORT wasm URL rewrite (vite.config.js)', () => {
  // The duplicate that made this necessary: onnxruntime-web's emscripten glue
  // falls back to `new URL('ort-wasm-simd-threaded.jsep.wasm', import.meta.url)`
  // when wasmPaths is unset, vite:asset-import-meta-url resolved that literal, and
  // dist/assets came out carrying 46.2 MB of runtime already staged at /ort/ and
  // /ort-hf/ (sha256-identical, verified 2026-08-25). Nothing ever fetched the
  // /assets/ copies - lib/ort.ts sets wasmPaths='/ort/' and every transformers.js
  // worker sets it to ORT_HF_BASE - they just uploaded on every deploy.
  //
  // Run over the REAL installed package rather than a fixture: the thing that
  // breaks this is an ORT release reshaping its loader, and a hand-written sample
  // of the old shape would keep passing through exactly that.
  const ORT_DIST = fileURLToPath(new URL('../../../node_modules/onnxruntime-web/dist/', import.meta.url));

  // vite's own detector, verbatim from vite/dist/node/chunks/node.js
  // (assetImportMetaUrlRE) - what it matches, it emits.
  const VITE_ASSET_RE = /\bnew\s+URL\s*\(\s*('[^']+'|"[^"]+"|`[^`]+`)\s*,\s*import\.meta\.url\s*(?:,\s*)?\)/g;
  const emittable = (code: string) =>
    [...code.matchAll(VITE_ASSET_RE)].map(m => m[1] ?? '').filter(u => u.includes('ort-wasm'));

  // `ort.bundle.min.mjs` is the entry the built chunk is named after; the plain
  // `.mjs` sibling is the same loader unminified, so a rewrite that only handled
  // one of the two would be a coin flip on the next dependency bump.
  for (const file of ['ort.bundle.min.mjs', 'ort.mjs']) {
    test(`${file}'s wasm fallback points at /ort/, not the bundle`, async () => {
      const { ortWasmFromPublic } = await import('../vite.config.js');
      const code = readFileSync(ORT_DIST + file, 'utf8');
      assert.ok(emittable(code).length > 0,
        `${file} no longer carries an emittable ort-wasm URL - if ORT changed how it loads its binary, `
        + 'this whole rewrite may be obsolete; confirm dist/assets is clean before deleting it');

      const out = ortWasmFromPublic().transform(code, ORT_DIST + file);
      assert.ok(out, 'the plugin must rewrite onnxruntime-web/dist sources');
      assert.deepEqual(emittable(out.code), [],
        'no ort-wasm URL may survive in a shape vite:asset-import-meta-url would emit as a build asset');
      assert.match(out.code, /new URL\(\/\* @vite-ignore \*\/ ['"`]\/ort\/ort-wasm-simd-threaded[\w.-]*\.wasm/,
        'the fallback must resolve to the same-origin copy scripts/copy-ort.ts stages into public/ort/');
    });
  }

  test('the nested transformers.js copy resolves to its own pinned runtime', async () => {
    // A DIFFERENT ORT release (1.22.0-dev) from the top-level dependency, staged
    // under its version by scripts/copy-transformers-ort.ts. Handing it /ort/'s
    // 1.27 binary would be an ABI mismatch, not a size win.
    const { ortWasmFromPublic } = await import('../vite.config.js');
    const { ORT_HF_BASE } = await import('./lib/ort-hf-base.ts');
    const nested = fileURLToPath(new URL(
      '../../../node_modules/@huggingface/transformers/node_modules/onnxruntime-web/dist/ort.bundle.min.mjs',
      import.meta.url));
    const out = ortWasmFromPublic().transform(readFileSync(ORT_DIST + 'ort.bundle.min.mjs', 'utf8'), nested);
    assert.ok(out, 'the plugin must rewrite the nested onnxruntime-web copy too');
    assert.ok(out.code.includes(`${ORT_HF_BASE}ort-wasm-simd-threaded.jsep.wasm`),
      'a wasm URL inside @huggingface/transformers must resolve to ORT_HF_BASE');
    assert.ok(!out.code.includes('"/ort/ort-wasm') && !out.code.includes("'/ort/ort-wasm"),
      'and must never fall back to the top-level /ort/ runtime');
  });

  test('the plugin is registered in the worker pass as well as the main one', async () => {
    // The rewrite was correct for months while 46.2 MB still shipped, because vite builds
    // every worker entry in a separate pass whose plugin container comes from
    // `worker.plugins()` alone - so a plugin listed only in `plugins` sees the main graph
    // and nothing else. Five of the six chunks that carried an ORT wasm URL were worker
    // chunks (four transformers.web-*, plus the workers' own copy of ort.bundle.min), so
    // dropping this registration puts nearly all of the duplication straight back with
    // every other test here still green.
    const { default: config } = await import('../vite.config.js');
    const registered = (list: unknown) => (Array.isArray(list) ? list.flat(Infinity) : [])
      .some(p => (p as { name?: string } | null)?.name === 'lolly-ort-wasm-from-public');
    assert.ok(registered(config.plugins), 'the main `plugins` array must carry the rewrite');
    // vite 8 takes `worker.plugins` as a FACTORY - it calls it once per nested worker
    // bundle chain. Passing an array still works, but only behind a deprecation warning.
    const workerPlugins = config.worker?.plugins;
    assert.equal(typeof workerPlugins, 'function', 'worker.plugins must be the factory form');
    assert.ok(registered((workerPlugins as () => unknown)()),
      'and the factory it returns must carry the rewrite too');
  });

  test('non-ORT wasm imports are left alone', async () => {
    // /assets/harfbuzz-*.wasm (390 KB) is the text-to-path shaper behind offline
    // SVG/PDF outline export and has no copy anywhere else on the origin - an
    // extension-wide rewrite would take vector export out with the duplicates.
    const { ortWasmFromPublic } = await import('../vite.config.js');
    const code = "export const u = new URL('harfbuzz.wasm', import.meta.url).href;"; // harfbuzzjs/dist/harfbuzz.js, verbatim shape
    assert.equal(ortWasmFromPublic().transform(code, '/x/node_modules/harfbuzzjs/dist/harfbuzz.js'), null);
    assert.equal(ortWasmFromPublic().transform(code, ORT_DIST + 'ort.mjs'), null,
      'even inside onnxruntime-web, only ort-wasm-* names are rewritten');
  });
});
