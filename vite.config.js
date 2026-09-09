import { defineConfig } from 'vite';
import { resolve, extname, relative, join, sep, dirname } from 'node:path';
import { existsSync, statSync, readFileSync, cpSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// This file's directory (shells/web/). Computed from import.meta.url rather
// than the __dirname global only Vite's config bundler shims in, so plain node
// can import this module too - src/sw.test.ts imports the exported precache
// grouping helpers below.
const webDir = dirname(fileURLToPath(import.meta.url));
// Repo root is two directories up from shells/web/.
const repoRoot = resolve(webDir, '..', '..');

// A normal `vite build` remains useful for local preview/testing and produces an
// explicitly unsigned-development artifact. Deployments must go through
// `pnpm run build:web:release`, which sets this flag after signing the active
// catalog. Keep the assertion in Vite as a second gate so no alternate release
// wrapper can accidentally emit an unsigned app.
const catalogTrustMode = process.env.VITE_CATALOG_TRUST_MODE?.trim() || 'unsigned-dev';
if (!['verified', 'unsigned-dev'].includes(catalogTrustMode)) {
  throw new Error(`vite.config: invalid VITE_CATALOG_TRUST_MODE "${catalogTrustMode}"`);
}
if (process.env.LOLLY_RELEASE_BUILD === '1') {
  if (catalogTrustMode !== 'verified') {
    throw new Error('vite.config: release builds require VITE_CATALOG_TRUST_MODE=verified');
  }
  if (!process.env.VITE_CATALOG_PUBLIC_KEY_JWK?.trim()) {
    throw new Error('vite.config: release builds require VITE_CATALOG_PUBLIC_KEY_JWK');
  }
  const envelope = resolve(repoRoot, 'catalog/tools/index.sig.json');
  if (!existsSync(envelope)) {
    throw new Error('vite.config: release catalog signature is missing; run scripts/sign-catalog.ts first');
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.css':  'text/css',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.mp3':  'audio/mpeg',
  '.glb':  'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.mjs':  'text/javascript',
  '.wasm': 'application/wasm',
};

// Vite resolve.alias only rewrites JS import statements - it has no effect on
// browser fetch() calls. This plugin adds an actual HTTP handler for /tools/,
// /catalog/, and /schemas/ so that fetch('/tools/qr-code/tool.json') works in
// dev - and so the schema $id URLs (https://lolly.tools/schemas/*.schema.json)
// resolve to the real files in both dev and the production build.
function serveRepoStatic() {
  // This middleware short-circuits BEFORE Vite's own header middleware, so the
  // dev server's cross-origin-isolation headers (server.headers below) never
  // reach these responses unless set here too. Load-bearing for /ort-hf/: the
  // threaded ONNX runtime spawns its pthread pool from those .mjs files, and an
  // isolated owner SILENTLY refuses a worker script served without COEP - the
  // pool never forms and wasm init hangs forever (found the hard way, plans/127).
  // /info needs them likewise or the docs-in-app iframe stops embedding.
  const isolationHeaders = (res) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  };
  return {
    name: 'serve-repo-static',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0];

        // Serve the onnxruntime-web WASM runtime (public/ort/*.{mjs,wasm}) RAW,
        // ignoring any query. ORT loads its wasm-glue via a runtime dynamic
        // import(); Vite's client rewrites that to `/ort/x.mjs?import` and routes
        // it through the module-transform pipeline, where a public/ file isn't in
        // the module graph → 404 (the deep scan's "couldn't run" error). Serving
        // it here, before Vite's transform middleware, short-circuits with the raw
        // module so the import resolves. Dev-only; the prod build has no `?import`
        // and serves public/ort/ statically from dist/. (Populated at setup from
        // node_modules/onnxruntime-web/dist/*.{wasm,mjs}.) /ort-hf/ is the same
        // story for the speech worker's transformers.js-pinned ORT runtime
        // (public/ort-hf/<version>/, staged by scripts/copy-transformers-ort.ts).
        if (url?.startsWith('/ort/') || url?.startsWith('/ort-hf/')) {
          const filePath = resolve(webDir, 'public', url.slice(1));
          if (existsSync(filePath) && statSync(filePath).isFile()) {
            const data = readFileSync(filePath);
            res.setHeader('Content-Type', MIME[extname(filePath)] ?? 'application/octet-stream');
            res.setHeader('Content-Length', data.byteLength);
            isolationHeaders(res);
            res.end(data);
            return;
          }
        }

        // Serve /info/* directly from public/info/ before the SPA fallback runs.
        if (url?.startsWith('/info')) {
          const normalized = (url === '/info' || url === '/info/') ? '/info/index.html' : url;
          const filePath = resolve(webDir, 'public', normalized.slice(1));
          if (existsSync(filePath) && statSync(filePath).isFile()) {
            const data = readFileSync(filePath);
            res.setHeader('Content-Type', MIME[extname(filePath)] ?? 'text/html; charset=utf-8');
            res.setHeader('Content-Length', data.byteLength);
            isolationHeaders(res);
            res.end(data);
            return;
          }
        }

        if (!url?.startsWith('/tools/') && !url?.startsWith('/catalog/') && !url?.startsWith('/schemas/')) return next();
        const filePath = resolve(repoRoot, url.slice(1));
        if (!existsSync(filePath) || !statSync(filePath).isFile()) return next();
        const data = readFileSync(filePath);
        res.setHeader('Content-Type', MIME[extname(filePath)] ?? 'application/octet-stream');
        res.setHeader('Content-Length', data.byteLength);
        isolationHeaders(res);
        res.end(data);
      });
    },
    closeBundle() {
      const outDir = resolve(webDir, 'dist');
      for (const dir of ['catalog', 'tools', 'schemas']) {
        const src = resolve(repoRoot, dir);
        // dereference: tools/ and catalog are profile VIEWS (symlink farms built
        // by scripts/use-profile.ts) - copy the real files, not the links.
        if (existsSync(src)) cpSync(src, resolve(outDir, dir), { recursive: true, dereference: true });
      }
    },
  };
}

// Emit dist/precache.json - the enumerable answer to "what IS the whole app?".
// Vite has no servable manifest of its output (build.manifest is off, and it
// wouldn't cover publicDir anyway), so until this existed nothing could
// precache the ~350 lazy chunks: the SW precaches only '/', every other chunk
// cached organically on first use, and a pinned tool whose editor chunk never
// loaded online died offline with a reload card. The profile view's
// "Available offline" manager (src/lib/offline-manager.ts) downloads these
// groups into the SW's persistent page-owned buckets:
//
//   app - index.html + every hashed chunk under /assets/ + the bundled UI
//         fonts + icons/share stubs. Everything a fully-offline boot of ANY
//         view needs, minus content that has its own pipeline (below).
//   ort - the onnxruntime-web runtime files ORT actually loads at scan time
//         (ort-wasm-*; the ort.*.mjs package entrypoints ship inside the
//         /assets/ bundle and are never fetched from /ort/), PLUS the speech
//         worker's pinned transformers.js runtime under /ort-hf/<version>/ -
//         both read back through the SW's lolly-ort bucket. ~95 MB + ~22 MB,
//         opt-in.
//
//   speech - the on-device voice models (/models/kokoro/, plus /models/whisper/
//         when staged), downloaded by the 'speech' offline part into the
//         transformers-cache + lolly-speech buckets the speech runtime reads
//         (plans/41-tts-stt-programme.md section 3). Opt-in, ~110 MB.
//
// Deliberately NOT listed: /catalog/ + /tools/ (the catalog sync + pin engine
// own those, with checksums), /info/ (docs build emits its own manifest.json),
// /models/trustmark/ bytes ride the `models` group as size metadata only
// (lib/trustmark.ts caches those in IndexedDB itself), sw.js
// (the browser owns SW lifecycle). Runs at closeBundle, AFTER serveRepoStatic's
// copies, by scanning the real dist/ output - so it can never drift from what
// actually shipped. `version` hashes the listing; the manager stores it as its
// re-sync watermark (new deploy → new hash → "update your download").
// Split the scanned dist/ listing into the download groups offline-manager.ts
// reads. Exported for the grouping test in src/sw.test.ts.
export function groupPrecacheFiles(all) {
  // The app group is the offline boot payload: everything EXCEPT the opt-in
  // runtime/model binaries - /ort/, /ort-hf/ (the speech worker's runtime,
  // which the SW can only serve from lolly-ort, never lolly-app) and /models/
  // - and except any ORT wasm the BUNDLER re-emits into /assets/.
  //
  // That last exclusion used to be worth 46.2 MB of the app group's 82.7
  // (measured 2026-08-25), back when rolldown followed ORT's
  // `new URL('ort-wasm-simd-threaded.jsep.wasm', import.meta.url)` and emitted a
  // hash-named COPY under /assets/ of a binary already staged at /ort/ and
  // /ort-hf/ - so the mandatory offline download carried the two biggest files on
  // the site in order to serve the opt-in runtime a second time, from a second
  // bucket. ortWasmFromPublic() now stops that emission at source, so on a current
  // build this filter matches nothing; it stays as the backstop for the day an ORT
  // or transformers.js upgrade introduces a wasm URL shaped differently enough to
  // slip past that rewrite. Matched by name (`/assets/ort-wasm-*`), NOT by
  // extension: /assets/harfbuzz-*.wasm (390 KB, the text-to-path shaper behind
  // SVG/PDF outline export) has no copy anywhere else, so an extension-wide filter
  // would take offline vector export out with the duplicates.
  const app = all.filter(f =>
    !f.url.startsWith('/ort/') && !f.url.startsWith('/ort-hf/') && !f.url.startsWith('/models/')
    && !/^\/assets\/ort-wasm-/.test(f.url));
  // The runtime wasm each ONNX runtime loads (ort-wasm-*), split by OWNER so each
  // offline part is self-complete: `ort` is the 1.27 build at /ort/ (the verify
  // deep-scan detectors), `ortHf` is transformers.js's pinned build at
  // /ort-hf/<version>/ (the Kokoro/Whisper speech worker). They used to share one
  // `ort` group the VERIFY part downloaded, so pre-downloading Speech alone still
  // fetched the ~22 MB /ort-hf/ runtime on first synthesis; owning it here lets the
  // speech part be truly offline-complete. Neither group takes the ort.*.mjs
  // files sitting beside them: those are the package dist entrypoints, and the
  // build bundles its own copies, so nothing ever fetches them from /ort/ or
  // /ort-hf/. That bundling used to drag the wasm in with it and emit the
  // /assets/ort-wasm-*.wasm copies the app filter above drops - so what leaked out
  // of a plain "everything under /assets/" app group was never the ~200 KB of
  // stray .mjs this comment once implied, it was 46.2 MB of duplicated runtime.
  // These two groups are the only shipped copy again now that ortWasmFromPublic()
  // keeps the wasm out of the bundle.
  const ort = all.filter(f => /^\/ort\/ort-wasm-/.test(f.url));
  const ortHf = all.filter(f => /^\/ort-hf\/[^/]+\/ort-wasm-/.test(f.url));
  // The verify part's models are the TrustMark decoders ONLY - downloaded via
  // lib/trustmark.ts's own IDB path, listed here so the part can state its true
  // size up front. /models/kokoro/ is deliberately NOT here: it belongs to the
  // 'speech' group below (plans/41-tts-stt-programme.md section 3) - counting it in
  // would make the verify part's size lie by ~95 MB.
  const models = all.filter(f => f.url.startsWith('/models/trustmark/'));
  // The speech part's voice models: Kokoro today, Whisper when its STT models
  // are staged. offline-manager.ts splits the group between transformers.js's
  // 'transformers-cache' bucket (model/config/tokenizer) and the worker's
  // 'lolly-speech' bucket (voice matrices) - the caches the runtime reads.
  const speech = all.filter(f => f.url.startsWith('/models/kokoro/') || f.url.startsWith('/models/whisper/'));
  // The AI-upscaler models (host.upscale, engine 1.101) - downloaded via
  // lib/upscaler.ts's own IDB path (the shared ORT model fetcher), listed here so
  // the offline-download manager can state the part's true size up front. Like the
  // verify/speech models, /models/upscale/ is SW-bypassed (single IDB copy).
  const upscale = all.filter(f => f.url.startsWith('/models/upscale/'));
  // The background-removal models (host.matte, engine 1.103) - downloaded via
  // lib/matter.ts's own IDB path (the shared ORT model fetcher), listed here so
  // the offline-download manager can state the part's true size up front. Like the
  // upscale/speech/verify models, /models/matte/ is SW-bypassed (single IDB copy).
  const matte = all.filter(f => f.url.startsWith('/models/matte/'));
  // The OCR models (host.ocr, plans/125) - a detector + recogniser + char dict,
  // downloaded via lib/ocr.ts's own IDB path (the shared ORT model fetcher), listed
  // here so the offline-download manager can state the part's size up front. Like
  // the other model parts, /models/ocr/ is SW-bypassed (single IDB copy).
  const ocr = all.filter(f => f.url.startsWith('/models/ocr/'));
  // The reword model (plans/127, SmolLM2-360M-Instruct) - loaded by the reword
  // worker through transformers.js, which caches under path keys in its own
  // 'transformers-cache' bucket, exactly like the speech models. The 'reword'
  // offline part downloads this group into that bucket (offline-manager.ts), so
  // a pre-download means zero bytes move on first use. Empty on builds where
  // the model is not staged, and the profile row hides itself then.
  const reword = all.filter(f => f.url.startsWith('/models/reword/'));
  // The Ask embedding model (plans/103 M1, all-MiniLM-L6-v2 q8) - loaded by the
  // ask embed worker through transformers.js into the same 'transformers-cache'
  // bucket as speech/reword. The 'ask' offline part downloads this group there,
  // so a pre-download means zero bytes move on first use. Empty on builds where
  // the model is not staged, and the profile row hides itself then.
  const embed = all.filter(f => f.url.startsWith('/models/embed/'));
  // The AI-text detector (plans/126 WP-A) - loaded by the ai-detect worker
  // through transformers.js into the same 'transformers-cache' bucket. Fills
  // through the verify/catalog panels' consent button; empty on builds where
  // no model is staged.
  const aiDetect = all.filter(f => f.url.startsWith('/models/ai-detect/'));
  return { app, ort, ortHf, models, speech, upscale, matte, ocr, reword, embed, aiDetect };
}

// Content hash for files whose URL does NOT already encode their bytes.
// /assets/ chunks are content-hash-named (a change renames them), the /ort/ +
// /models/ binaries are release-versioned and too big to hash every build, and
// /ort-hf/ carries its release version in the path - everything else (fonts,
// icons, share stubs, index.html, voice, viz-presets) keeps a stable name, so
// a same-size content change is invisible to a size compare. The hash is what
// offline-manager.ts's cachedMatches uses to catch that. Exported for the
// grouping test in src/sw.test.ts.
export const precacheNeedsHash = (url) =>
  !url.startsWith('/assets/') && !url.startsWith('/ort/') && !url.startsWith('/ort-hf/') && !url.startsWith('/models/');

// Fill in /models/** entries the dist scan could not see. The Vercel app deploys
// exclude shells/web/public/models from the upload (.vercelignore) and serve
// /models/** through a rewrite to the static model host (deploy/models-host/),
// so on those builds the files are simply not on disk - but the offline download
// manager and the desktop models-welcome sheet still read model URLs + sizes
// from precache.json. The committed listing (models-manifest.json, regenerated
// by scripts/gen-models-manifest.ts when a model is promoted) supplies exactly
// the entries the scan is missing; any url the scan DID see keeps its scanned
// size, so a build with the files on disk (local, self-hosted nginx) is
// byte-identical to before. Exported for the sw.test.ts pin.
export function mergeModelsManifest(all, manifest) {
  const seen = new Set(all.map(f => f.url));
  const filled = manifest.filter(f => f && typeof f.url === 'string' && f.url.startsWith('/models/') && !seen.has(f.url));
  return filled.length ? [...all, ...filled].sort((a, b) => a.url.localeCompare(b.url)) : all;
}

// Exported, and outDir-aware, so the DESKTOP shell can run it too. It used to hard-code
// resolve(webDir, 'dist'), which is right for this build and wrong for every other: the
// Tauri shells set their own build.outDir (their vite root is ../web but their output is
// their own dist/), so the scan looked at the wrong directory and no precache.json was
// emitted at all. The desktop app then had no manifest to read, and the "Available
// offline" manager in views/profile.ts - whose every model row is gated on `!!precache` -
// showed "Not offered by this server" for all of them, on a build whose model host was
// serving perfectly well. Reading the resolved config makes it correct for whoever runs it.
export function precacheManifest() {
  const SKIP = new Set(['catalog', 'tools', 'schemas', 'info', 'sw.js', 'precache.json']);
  const needsHash = precacheNeedsHash;
  const walk = (dir, base) => {
    const out = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      // Finder droppings and other dotfiles are not app payload (.well-known,
      // a dot-DIRECTORY with real policy files, stays).
      if (entry.name.startsWith('.') && entry.name !== '.well-known') continue;
      const full = join(dir, entry.name);
      // sep-normalised so the emitted URLs are stable on Windows checkouts too
      const rel = relative(base, full).split(sep).join('/');
      if (SKIP.has(rel.split('/')[0])) continue;
      if (entry.isDirectory()) out.push(...walk(full, base));
      else if (entry.isFile()) {
        const url = '/' + rel;
        const file = { url, size: statSync(full).size };
        if (needsHash(url)) {
          file.hash = createHash('sha256').update(readFileSync(full)).digest('base64url').slice(0, 16);
        }
        out.push(file);
      }
    }
    return out;
  };
  let resolvedOutDir = null;
  return {
    name: 'lolly-precache-manifest',
    apply: 'build',
    configResolved(config) {
      // build.outDir may be relative to root or absolute; resolve() handles both.
      resolvedOutDir = resolve(config.root ?? webDir, config.build?.outDir ?? 'dist');
    },
    closeBundle() {
      const outDir = resolvedOutDir ?? resolve(webDir, 'dist');
      if (!existsSync(outDir)) return;
      let all = walk(outDir, outDir).sort((a, b) => a.url.localeCompare(b.url));
      // Models pruned from this build (the rewrite-served Vercel deploys) still
      // belong in the manifest - see mergeModelsManifest above.
      const modelsListing = resolve(webDir, 'models-manifest.json');
      if (existsSync(modelsListing)) {
        try { all = mergeModelsManifest(all, JSON.parse(readFileSync(modelsListing, 'utf8'))); }
        catch (e) { console.warn('[precache] models-manifest.json unreadable - models entries may be missing:', e); }
      }
      const groups = groupPrecacheFiles(all);
      const version = createHash('sha256')
        .update(all.map(f => `${f.url}:${f.size}:${f.hash ?? ''}`).join('\n'))
        .digest('base64url').slice(0, 16);
      writeFileSync(resolve(outDir, 'precache.json'), JSON.stringify({ version, groups }));
    },
  };
}

// Bake per-brand browser/PWA chrome into index.html at build time. The static
// theme-color in index.html is SUSE pine (#0c322c); on any OTHER brand (e.g. the
// blank lolly.art profile) that would wrongly tint the mobile address bar / PWA
// titlebar SUSE green, and the SUSE webfont preload would just 404. Resolve the
// active profile (LOLLY_PROFILE env on Vercel → the repo-root .lolly-profile
// sticky file → the suse default) and, for a non-SUSE brand, neutralise the
// theme-color and drop the dead SUSE font preload. SUSE builds are untouched.
// (Longer term the colour should come from the active brand's own tokens.)
function brandChrome() {
  const NEUTRAL = '#4f84ba'; // the app's canonical brand fallback (brand-vars.ts)
  let profile = process.env.LOLLY_PROFILE?.trim();
  if (!profile) {
    try { profile = readFileSync(resolve(repoRoot, '.lolly-profile'), 'utf8').trim(); } catch { /* no sticky file */ }
  }
  if (!profile) profile = 'suse';
  const isSuse = profile === 'suse';
  // Canonical host for the origin guard baked into index.html. index.html hardcodes
  // the SUSE default ('lolly.tools'); an unknown brand gets '' so the guard no-ops
  // rather than force-redirecting somewhere wrong. As of 2026-08-30 lolly-start also
  // canonicalises to lolly.tools (the lolly.art/start split folded in), so lolly.tools
  // no longer bounces and lolly.art redirects TO lolly.tools.
  const CANON_BY_PROFILE = { suse: 'lolly.tools', 'lolly-start': 'lolly.tools' };
  return {
    name: 'lolly-brand-chrome',
    transformIndexHtml(html) {
      if (isSuse) return html; // index.html already carries the SUSE chrome
      return html
        .replace("var CANON = 'lolly.tools';", `var CANON = '${CANON_BY_PROFILE[profile] ?? ''}';`)
        .replace('<meta name="theme-color" content="#0c322c" />', `<meta name="theme-color" content="${NEUTRAL}" />`)
        // Every SUSE face preload, not just the upright one - index.html carries
        // two (SUSE + SUSEMono) since plans/155 task 1.3, hence the /g. Match on
        // the `/fonts/SUSE` path prefix rather than the filename: `[wght]` is
        // spelled literally in index.html but percent-encoded in the built output
        // (see fontPreloadUrls), so a `SUSE\[wght\]` literal here would match in
        // one and not the other - and a strip that silently no-ops leaves non-SUSE
        // brands shipping preloads for faces their pack never paints. This hook is
        // a normal-order transformIndexHtml and fontPreloadUrls' is order:'post',
        // so the strip always sees the literal form regardless of plugin order.
        .replace(/\n\s*<link rel="preload" as="font"[^>]*\/fonts\/SUSE[^>]*>/g, '');
    },
  };
}

// Re-apply vite's OWN css-side URL normalisation to the /fonts/ preload hrefs in
// index.html, so a preload and the @font-face it is meant to satisfy name one
// identical URL string.
//
// The shell's UI faces carry the upstream filenames `SUSE[wght].woff2` /
// `SUSEMono[wght].woff2` (the fvar axis tag is part of the name), and vite
// normalises those brackets in OPPOSITE directions on its two pipelines:
//   - CSS:  styles/fonts.css says url('/fonts/SUSE[wght].woff2'); the public-file
//     branch runs the path through `encodeURI` (vite/dist/node/chunks/node.js
//     `encodeURIPath` at the publicAssetUrlRE replace), so the BUILT css requests
//     `/fonts/SUSE%5Bwght%5D.woff2`.
//   - HTML: an asset attribute is `decodeURI`d first and re-emitted through
//     `partialEncodeURIPath`, which escapes `%` and nothing else - so the built
//     HTML carries the LITERAL `[wght]` whatever index.html spelled.
// A preload matches on the URL string alone, so out of the box the 83 KB upright
// face was fetched twice on every cold load. Hand-writing `%5Bwght%5D` into
// index.html (the first pass at plans/155 task 1.3) fixed nothing - vite decoded
// it straight back and dist/index.html came out byte-identical to the broken
// form. Encoding here instead is the one place that survives, and it calls
// `encodeURI` - the same function the css pipeline uses - so the two sides cannot
// drift apart into two spellings again.
//
// Build-only: the dev server rewrites neither pipeline, so in dev the literal
// hrefs in index.html already match the css it serves.
//
// This is the workaround, NOT the cure. The cure named by plans/155 task 1.3 is
// renaming the faces to bracket-free filenames, since brackets are exactly what
// makes the two normalisations differ. That rename is blocked outside this shell:
// the same bracketed names are baked into the docs submodule (docs/build.ts's
// @font-face block and its per-page font preload) and into the 4,373 generated
// pages under public/info/ that ship from this same origin, so renaming without
// regenerating the docs site would 404 the docs' own fonts.
function fontPreloadUrls() {
  return {
    name: 'lolly-font-preload-urls',
    apply: 'build',
    transformIndexHtml: {
      // 'post' so this runs after every other transformIndexHtml hook - notably
      // brandChrome(), which may have removed the whole preload run for a
      // non-SUSE brand, leaving nothing here to encode.
      order: 'post',
      handler(html) {
        return html.replace(
          /(<link rel="preload" as="font"[^>]*\shref=")(\/fonts\/[^"]*)(")/g,
          // A href that already contains a percent escape is left alone:
          // encodeURI would turn its `%` into `%25` and produce a third,
          // equally wrong spelling.
          (whole, head, href, tail) => (href.includes('%') ? whole : head + encodeURI(href) + tail),
        );
      },
    },
  };
}

// Strip model STAGING dirs from the production build. scripts/fetch-{matte,upscale}-
// models.ts stage a candidate model under public/models/<cat>/.candidates/ for
// evaluation before it is promoted into its served /models/<cat>/ path - and the DEV
// server serves them (so a candidate can be tested at that URL), which is why they live
// under public/. But vite copies publicDir wholesale, so a plain build would SHIP them
// too: ~700 MB of dead weight nothing references (they are dot-dirs, so precacheManifest's
// walk already skips them - no manifest/group/client points at them; they were reachable
// only incidentally). Delete them from dist so they never ship via ANY path - local dist,
// git-integration, or the loldev-ship archive. Build-only (`apply: 'build'`), so dev-server
// candidate evaluation is untouched. Runs before precacheManifest for tidiness; the scan
// skips dot-dirs regardless, so the emitted manifest is byte-identical either way.
function stripModelCandidates() {
  return {
    name: 'lolly-strip-model-candidates',
    apply: 'build',
    closeBundle() {
      const modelsDir = resolve(webDir, 'dist', 'models');
      if (!existsSync(modelsDir)) return;
      for (const cat of readdirSync(modelsDir, { withFileTypes: true })) {
        if (!cat.isDirectory()) continue;
        const cand = resolve(modelsDir, cat.name, '.candidates');
        if (existsSync(cand)) rmSync(cand, { recursive: true, force: true });
      }
    },
  };
}

// The `new URL('<name>.wasm', import.meta.url)` sites inside onnxruntime-web's
// emscripten glue. Anchored on the `ort-wasm-` prefix, NOT on `.wasm`: the same
// pattern in harfbuzzjs is what emits /assets/harfbuzz-*.wasm (390 KB, the shaper
// behind offline SVG/PDF outline export), and that one has no copy anywhere else
// on the origin - it must keep being bundled.
const ORT_WASM_URL_RE = /\bnew\s+URL\(\s*(['"`])(ort-wasm[\w.-]*\.wasm)\1\s*,\s*import\.meta\.url\s*,?\s*\)/;

// Stop the bundler shipping a SECOND copy of every ONNX runtime binary.
//
// onnxruntime-web and @huggingface/transformers (which nests its own pinned
// onnxruntime-web) are imported as real modules, so the `new URL('<name>.wasm',
// import.meta.url)` in their glue is exactly what vite:asset-import-meta-url
// resolves and emits as a build asset. That was 46.2 MB of dist/assets' 80 MB
// (measured 2026-08-25): two /assets/ort-wasm-simd-threaded.jsep-<hash>.wasm
// files, 25.6 MB and 20.6 MB, sha256-identical to the copies already sitting at
// /ort/ort-wasm-simd-threaded.jsep.wasm and
// /ort-hf/<version>/ort-wasm-simd-threaded.jsep.wasm - re-uploaded every deploy.
//
// Both originals are staged into public/ by `pnpm run build:ort` (scripts/copy-
// ort.ts + copy-transformers-ort.ts) and both are what actually loads: lib/ort.ts
// owns the shell's ONLY `import('onnxruntime-web')` and sets
// `ort.env.wasm.wasmPaths = '/ort/'` in the same then() that resolves the module,
// and every transformers.js worker sets `env.backends.onnx.wasm.wasmPaths =
// ORT_HF_BASE` before its first pipeline call. With wasmPaths set ORT resolves
// through `locateFile`, so these `new URL` sites are the unreachable else-branch.
//
// Deleting the branch would be worse than leaving it - a fallback that 404s is a
// trap. So rewrite its literal to the same-origin staged path instead: the
// fallback stops being a duplicate and starts being correct.
//
// The rewrite must also stop vite RE-emitting the new path, and an absolute
// '/ort/...' would not do that on its own - vite:asset-import-meta-url resolves a
// leading-slash url against publicDir, where the staged file is sitting. The
// `/* @vite-ignore */` between `new URL(` and the string is what prevents it,
// twice over: vite's assetImportMetaUrlRE wants a string literal immediately
// after the paren, so the comment takes the expression out of the match entirely,
// and if that regex ever grows comment tolerance the handler's own hasViteIgnoreRE
// check skips it (both in vite/dist/node/chunks/node.js).
//
// Applies in dev as well as build: the branch is dead in both, and a dev-only
// difference inside a fallback is how a prod-only bug gets written. Exported so
// src/sw.test.ts can run the rewrite over the REAL installed onnxruntime-web and
// assert nothing emittable survives - an ORT upgrade that reshapes the pattern
// has to fail a test rather than quietly put the 46.2 MB back.
export function ortWasmFromPublic() {
  // Read the pinned transformers.js runtime dir from the generated constant its
  // workers import, so a build:ort version bump can never leave the rewritten
  // fallback pointing at a release that is no longer staged.
  const hfBase = readFileSync(resolve(webDir, 'src', 'lib', 'ort-hf-base.ts'), 'utf8')
    .match(/ORT_HF_BASE\s*=\s*'([^']+)'/)?.[1];
  if (!hfBase) throw new Error('vite.config: no ORT_HF_BASE in src/lib/ort-hf-base.ts - run pnpm run build:ort');
  let isBuild = false;
  return {
    name: 'lolly-ort-wasm-from-public',
    // This plugin only removes the duplicates while it is registered TWICE - in the main
    // `plugins` array and in `worker.plugins` (see the comment there). For a build where it
    // sat in `plugins` alone, dist/assets carried both binaries (46.2 MB, 2026-08-26) even
    // though the rewrite itself was right, because every ORT-importing chunk except one was
    // built by the worker pass, which has its own plugin container.
    //
    // Dead ends checked on the way there, so nobody re-derives them:
    //   - vite:asset-import-meta-url DOES honour `/* @vite-ignore */` (vite 8's plugin tests
    //     hasViteIgnoreRE over the span between the call start and the url literal, which is
    //     exactly where the rewrite puts it), so the marker is not the problem;
    //   - it is NOT a hook-ordering race: moving the rewrite to `load`, which precedes every
    //     transform, changed nothing;
    //   - rolldown 1.1 has no native new-URL-to-asset path (no such option in its bindings),
    //     so vite's plugin is the only emitter.
    //
    // Nothing user-facing depends on any of this: the emitted copies were never fetched (ORT
    // resolves /ort/ through wasmPaths, transformers.js its pinned /ort-hf/<version>/), so
    // what it buys is deploy upload weight, not first load - and correctness of the fallback
    // outranks the size win, which is why the rewrite retargets the literal rather than
    // deleting the branch.
    enforce: 'pre',
    configResolved(config) { isBuild = config.command === 'build'; },
    transform(code, id) {
      const modId = id.split('\\').join('/');
      if (!modId.includes('/onnxruntime-web/dist/')) return null;
      // The nested copy under @huggingface/transformers is a DIFFERENT ORT release
      // from the top-level dependency (1.22.0-dev vs 1.27) - they are staged to
      // separate prefixes for that reason, and crossing them would hand a runtime
      // the wrong build's binary.
      const base = modId.includes('/@huggingface/transformers/') ? hfBase : '/ort/';
      let hit = false;
      const out = code.replace(new RegExp(ORT_WASM_URL_RE.source, 'g'), (_match, quote, file) => {
        const url = base + file;
        // A rewrite that points at a file nobody staged turns a working fallback
        // into a 404, so fail the build rather than ship it. build:web runs
        // build:ort first so it is always present by now; the dev server has no
        // such guarantee, hence build-only.
        if (isBuild && !existsSync(resolve(webDir, 'public', url.slice(1)))) {
          throw new Error(`vite.config: ${id} loads ${file}, but public${url} is missing - run pnpm run build:ort`);
        }
        hit = true;
        return `new URL(/* @vite-ignore */ ${quote}${url}${quote}, import.meta.url)`;
      });
      // Sourcemap deliberately dropped: build.sourcemap is never set here, so it
      // is vite's default off, and these are minified vendor bundles with nothing
      // useful to remap anyway.
      return hit ? { code: out, map: null } : null;
    },
  };
}

export default defineConfig({
  publicDir: 'public',
  // stripModelCandidates before precacheManifest: remove the /models/*/.candidates
  // staging dirs from dist before the manifest scan. precacheManifest LAST: its
  // closeBundle scans dist/ after serveRepoStatic's closeBundle has copied
  // catalog/tools/schemas in (it skips those, but the ordering keeps the scan
  // deterministic either way). fontPreloadUrls' position here is cosmetic - it
  // declares order:'post', so it runs after brandChrome() wherever it sits, and
  // ortWasmFromPublic's is too - it declares enforce:'pre'.
  plugins: [serveRepoStatic(), brandChrome(), fontPreloadUrls(), ortWasmFromPublic(), stripModelCandidates(), precacheManifest()],
  // The Neurospicy player + video music-bed exporter render ZzFXM songs in a
  // module worker (src/lib/zzfxm-worker.ts, which ESM-imports the engine). Emit
  // it as an ES module so the import graph survives the build unchanged.
  //
  // `plugins` is NOT a redundant copy of the array above. Vite bundles each worker
  // entry in a separate pass whose plugin container is built from `worker.plugins()`
  // ALONE - resolveConfig's createWorkerPlugins takes only that list and re-adds
  // vite's own internals; the main `plugins` array is never inherited. That is what
  // kept 46.2 MB of duplicate ORT binaries in dist/assets while ortWasmFromPublic's
  // rewrite was already correct: only the main graph's ort.bundle.min chunk came out
  // rewritten, while the workers' own copy of it and the four transformers.web-*
  // worker chunks kept their `new URL(...)` sites for vite:asset-import-meta-url -
  // which DOES run in the worker pass - to emit as build assets.
  // Only this plugin is repeated: the other five act at closeBundle over the whole
  // dist or on index.html, neither of which a worker pass has.
  worker: { format: 'es', plugins: () => [ortWasmFromPublic()] },
  // onnxruntime-web (lazy-loaded by the /verify deep-scan: lib/trustmark.ts +
  // lib/contentseal.ts) must NOT go through Vite's esbuild dep pre-bundler - it
  // rewrites the package's `import.meta.url`-relative wasm/worker loading and the
  // dynamic `import('onnxruntime-web')` then throws at runtime (surfaced as the
  // deep scan's 'error' / "couldn't run in this browser"). Excluding it makes Vite
  // serve the package's own ESM untouched; the wasm binaries load at runtime from
  // /ort/ via `ort.env.wasm.wasmPaths` (populated into public/ort/ at setup), not
  // through the bundler. Standard onnxruntime-web + Vite requirement.
  optimizeDeps: { exclude: ['onnxruntime-web'] },
  resolve: {
    alias: {
      '@lolly/engine': resolve(repoRoot, 'engine/src/index.ts'),
      // jspdf lazy-imports html2canvas (199 KB / 46 KB gz, + its own dompurify)
      // ONLY inside its `.html()`/`addHTML()` method, which lolly never calls.
      // Alias it to an empty stub so it's never built or shipped. (dompurify is
      // NOT stubbed - picker.ts uses the standalone copy directly.)
      'html2canvas': resolve(webDir, 'html2canvas-stub.js'),
    },
  },
  server: {
    // Bind to 0.0.0.0 so the dev server is reachable from other devices on the LAN
    // (Vite prints a `Network:` URL alongside `Local:`). This is what lets a real HDR
    // Chromium / WebKit device open the Colour Lab and check the headroom/nits axis on
    // actual hardware. The HDR RENDER path (Tier B cICP <img>, Tier A WebGL canvas) needs
    // no secure context, so it works over plain http://<lan-ip>. What does NOT work over
    // http on the LAN: WebCodecs (video export + the CanvasSink filmstrip decode) and
    // crossOriginIsolated (threaded ONNX for depth/upscale), both of which require a
    // secure context - test those over localhost, or front this with mkcert/a tunnel for
    // an HTTPS LAN origin (no TLS is wired here, to avoid a cert dependency).
    host: true,
    fs: { allow: [repoRoot] },
    // Cross-origin isolation, matching vercel.json's production headers
    // (plans/127): COOP+COEP make crossOriginIsolated true, which is what lets
    // onnxruntime-wasm run MULTI-threaded (the reword/speech workers) instead
    // of silently single-threaded. `credentialless` (not require-corp) so
    // no-cors media like the SomaFM streams keeps loading; Safari ignores it
    // and simply stays non-isolated (WebGPU is the primary path there). The
    // OAuth popup flows survive isolation via BroadcastChannel - see
    // oauth-return.html and bridge/identity.ts.
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
    proxy: {
      // dev-only: the standalone CA service - node services/ca/server.mjs
      // (string shorthand preserves the /api/ca path prefix, which the handler routes on).
      '/api/ca': 'http://localhost:8787',
      // dev-only: the Penpot RPC pass-through (services/penpot/vercel-entry.ts)
      // only exists as a Vercel function, so a dev origin has nothing at
      // /api/penpot and the profile card's "Load projects" 404s. Bounce it to
      // the deployed function - same allowlist, same token custody, and the
      // card's "sent through lolly.tools" copy stays true in dev. changeOrigin
      // rewrites Host so Vercel routes it to the right project.
      '/api/penpot': { target: 'https://lolly.tools', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // Split the heavy render-only engine deps into their own chunks. `@lolly/engine`
        // is aliased straight to its barrel (above), so package.json `sideEffects` never
        // applies and the whole engine otherwise lands in one shared chunk the gallery/
        // catalog boot preloads. engine-render is imported only from LAZY views (tool,
        // projects, picker, pro, compose, featured-render - all dynamic-imported), so as
        // its own chunk it loads with those views instead of blocking first paint.
        //
        // Uses rolldown's `advancedChunks` (not the `manualChunks` compat shim): the
        // shim's tiny groups get merged back into the chunk that imports them, which
        // was silently folding engine-util below back into engine-render. Per-group
        // `minSize: 0` + `minShareCount: 1` keep every group as a real, separate chunk.
        advancedChunks: {
          minSize: 0,
          minShareCount: 1,
          groups: [
            { name: 'handlebars', test: /\/node_modules\/handlebars\//, minSize: 0, minShareCount: 1 },
            { name: 'ajv', test: /\/node_modules\/ajv\//, minSize: 0, minShareCount: 1 },
            // Pure engine util files (tokens/tool-url/embed) - NO runtime/template/
            // loader/validate dependency, so no Handlebars/Ajv. runtime.ts imports
            // them, so without their own chunk rolldown tree-shakes the tiny boot-time
            // helpers the entry legitimately needs - createTokenSet + isTokenValue/
            // isAssetRef (tokens.ts; used by bridge/tokens.ts token & asset resolution)
            // and isToolUrl (tool-url.ts) - INTO engine-render, dragging the whole
            // render/validate blob (+ Ajv + Handlebars, ~83 KB gz) into the entry's
            // static graph so it modulepreloads at first paint. Isolating them lets the
            // entry import from this light chunk while the lazy views still get the
            // helpers on demand. MUST precede engine-render so these files land here.
            // TOKEN_EXT - one string, but design-version.ts (reached from bridge/assets.ts at
            // first paint) needs it, and taking it from tokens.ts parked the whole colour
            // cluster (tokens + css-color + brand-derive + color-faces = the 12.9 KB gz
            // engine-util chunk below) on the preload set for that one edge. token-ext.ts is
            // the leaf those boot importers now read. WITHOUT this group rolldown co-locates
            // the leaf straight back into engine-util and the split buys nothing - the same
            // mechanism the engine-bytes/engine-version notes describe. MUST precede
            // engine-util. Measured 2026-08-26: -13.8 KB gz off boot (plans/155 WP-3).
            { name: 'engine-token-ext', test: /engine\/src\/token-ext\.ts$/, minSize: 0, minShareCount: 1 },
            { name: 'engine-util', test: /engine\/src\/tokens\.ts$/, minSize: 0, minShareCount: 1 },
            // tool-url.ts + embed.ts used to share the engine-util group above. They
            // belong OFF that group: nothing on the boot path imports either (a grep
            // of shells/web/src finds only lazy views and comment references), but
            // tokens.ts IS a boot import, so co-locating them meant their ~10 KB of
            // source rode the preload set for free. Same isolation reasoning as
            // engine-util itself - a separate group, still ahead of engine-render, so
            // the lazy views get them on demand without dragging Handlebars/Ajv.
            { name: 'engine-toolurl', test: /engine\/src\/(tool-url|embed)\.ts$/, minSize: 0, minShareCount: 1 },
            // ENGINE_VERSION - one string constant, but loader.ts imports it too, so
            // default chunking parks version.ts INSIDE engine-render. lib/instance.ts
            // (sync base URL, boot) and the geom kernel both read it, and that single
            // edge drags engine-render + Handlebars + Ajv + engine-c2pa (~156 KB gz)
            // onto the preload set. MUST precede engine-render.
            { name: 'engine-version', test: /engine\/src\/version\.ts$/, minSize: 0, minShareCount: 1 },
            // bytes.ts - the shared byte/crypto primitive leaf (concatBytes, sha256,
            // sha256Hex, bytesToHex, base64ToBytes) every binary format module in the
            // engine imports. ~0.6 KB, and genuinely on the boot path: design-version.ts
            // (reached from bridge/assets.ts at first paint) re-exports sha256Hex from
            // it. x509.ts imports it too, so WITHOUT this group rolldown co-locates
            // bytes.ts INTO engine-x509 and that one boot edge drags the cert parser +
            // der-read (~2.4 KB gz) back onto the preload set - the exact mechanism the
            // engine-util note above describes, measured again on 2026-08-10. MUST
            // precede engine-x509 / engine-c2pa / engine-render.
            { name: 'engine-bytes', test: /engine\/src\/bytes\.ts$/, minSize: 0, minShareCount: 1 },
            // x509 cert parser (pemToDer + the DER walk). NOT a boot dependency any
            // more - bridge/identity.ts is a lazy facade and catalog-integrity.ts is
            // dynamically imported by catalog/integrity.ts - but it keeps its own chunk
            // so it never co-locates into engine-c2pa, where its next boot edge would
            // drag the whole 17 KB c2pa blob onto the preload set. MUST precede
            // engine-c2pa.
            { name: 'engine-x509', test: /engine\/src\/x509\.ts$/, minSize: 0, minShareCount: 1 },
            // Catalog signature verification (catalog-integrity.ts) - inert unless a
            // build pins VITE_CATALOG_PUBLIC_KEY_JWK, and imported dynamically by
            // catalog/integrity.ts for exactly that reason. Its own chunk regardless,
            // so it can never co-locate into engine-render and put the render/validate
            // blob (+ Handlebars + Ajv) behind a catalog sync. MUST precede
            // engine-render. Its only engine deps are engine-x509 + engine-bytes above.
            { name: 'engine-integrity', test: /engine\/src\/catalog-integrity\.ts$/, minSize: 0, minShareCount: 1 },
            // Vector geometry kernel (host.geom, v1.64): bezier flattening, the
            // polynomial root solver, path booleans/offset/stroke-to-fill/spline
            // lowering - ~28 KB gz. Nothing in the shell reads host.geom; only tool
            // hooks and the (lazy) free-canvas vector-ops do. Without its OWN group
            // these files co-locate with the small icon-theme/photo-treatment/
            // session-record helpers the gallery genuinely needs at first paint, so
            // deferring the bridge's import alone would not move the bytes - same
            // mechanism the engine-util/engine-version notes above describe.
            { name: 'engine-geom', test: /engine\/src\/(geom-api\.ts|geom\/)/, minSize: 0, minShareCount: 1 },
            // Perceptual colour tools (host.color, v1.40) + the ICC/gamut machinery
            // makeColorApi eagerly reaches (icc.ts alone is 62 KB of source). Same
            // story as geom: tool-hook-only, installed by lib/mount-runtime.ts before
            // the first runtime, and a separate group so it can actually leave boot.
            { name: 'engine-color', test: /engine\/src\/(color-tools|gamut|icc|gamut-source|gradient-spec|brand-schemes)\.ts$/, minSize: 0, minShareCount: 1 },
            // On-device C2PA sign/verify + CBOR codec (~17 KB gz). Only the lazy
            // /valid view and export-with-provenance run these - keep them off the
            // render-blocking gallery boot path.
            { name: 'engine-c2pa', test: /engine\/src\/(c2pa|c2pa-verify)\.ts$/, minSize: 0, minShareCount: 1 },
            // The engine's render + manifest-validate source (runtime/template →
            // Handlebars, loader/validate → Ajv). Only the lazy views import these.
            // Vite's dynamic-import preload helper (the virtual `vite/preload-helper`
            // module every chunk with an `import()` pulls in). Rolldown seats it beside
            // the FIRST module that lazy-loads something; when engine/src/runtime.ts
            // gained its lazy C2PA imports (engine 1.183) that became the engine-render
            // group, and the entry chunk then statically imported engine-render -
            // handlebars + ajv on boot - for a 40-line helper. Its own group, ahead of
            // everything else, so the seat can never move again.
            { name: 'vite-preload', test: /vite\/preload-helper/, minSize: 0, minShareCount: 1 },
            // The HostV1 optional-API list (packages/core host-v1/apis.ts: presentApis /
            // missingRequires, ~300 B). Both the boot path (gallery's tool-support
            // check) and the engine runtime (the `requires` mount refusal) import it;
            // its own group keeps rolldown from ever co-locating it into engine-render
            // (the same trap the engine-bytes note above records). Must precede
            // engine-render: the first matching group wins.
            { name: 'core-apis', test: /packages\/core\/src\/host-v1\/apis\.ts$/, minSize: 0, minShareCount: 1 },
            // The saved-state dependency walk and lazy runtime both use version
            // pins. Keep this pure identity codec out of the render chunk.
            { name: 'engine-asset-version', test: /engine\/src\/asset-version\.ts$/, minSize: 0, minShareCount: 1 },
            { name: 'engine-render', test: /engine\/src\/(runtime|template|loader|validate)\.ts$/, minSize: 0, minShareCount: 1 },
          ],
        },
      },
    },
  },
});
