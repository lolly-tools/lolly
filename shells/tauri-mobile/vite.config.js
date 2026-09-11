import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import {
  embedContentPlugins, injectModelsBase, resolveEmbedMode,
} from '../tauri-shared/vite-embed.mjs';
import { tauriCspMeta } from '../tauri-shared/vite-csp.mjs';
// Borrowed from the web shell's config, which owns the format. See the plugin list.
import { precacheManifest } from '../web/vite.config.js';

const webShell  = resolve(__dirname, '../web');
const repoRoot  = resolve(__dirname, '../..');

// The web shell migrated .js → .ts but still references some files by a .js
// specifier (index.html's `/src/main.js` entry; a few `../lib/*.js` imports). The
// web shell's newer rolldown-vite resolves those implicitly; this shell pins an
// older Vite that does not, so map a MISSING .js to its sibling .ts. Only fires
// when the .js is absent and the .ts exists, so it never shadows a real .js.
function jsToTsFallback() {
  return {
    name: 'js-to-ts-fallback',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!source.endsWith('.js')) return null;
      let jsPath;
      if (source.startsWith('/')) jsPath = resolve(webShell, source.slice(1));
      else if (source.startsWith('.') && importer) jsPath = resolve(dirname(importer.split('?')[0]), source);
      else return null; // bare / node_modules specifier - leave alone
      if (existsSync(jsPath)) return null; // a real .js - don't touch it
      const tsPath = jsPath.slice(0, -3) + '.ts';
      return existsSync(tsPath) ? tsPath : null;
    },
  };
}

// Embedded content mode (plans/131 WP-A) - the machinery lives in
// ../tauri-shared/vite-embed.mjs, SHARED with the desktop shell so the two
// configs cannot drift (the old hand-kept copy here still had the cpSync
// dereference bug and embedded the ACTIVE profile whole). Mobile is the
// app-store shell, so its default is 'neutral' - the blank-brand toolset +
// a ~1 MB seed catalog, with brand content arriving from an instance or a
// loaded .lolly pack. LOLLY_EMBED_CATALOG=profile overrides for an internal
// brand-embedded build.
const EMBED_CATALOG = resolveEmbedMode(process.env.LOLLY_EMBED_CATALOG, 'neutral');

// Swap specific web-shell bridge modules for Tauri-native implementations.
// Implemented as a resolveId plugin rather than resolve.alias because the bridge
// imports are RELATIVE siblings ("./state.js" from bridge/index.js): a path regex
// can't match a relative specifier, so resolve.alias silently never fires and the
// web original loads instead. We match on the source's basename + the importer
// living in a bridge/ dir, so it works for BOTH the absolute fs importer
// (`vite build`) and the root-relative URL importer the dev server passes
// (`/src/bridge/index.js`).
//
// Mobile overrides four modules: state.js (filesystem state via
// tauri-plugin-fs), capabilities-provided.js (adds 'filesystem'), export.js, and
// assets.js (durable filesystem mirror for user uploads).
// It does NOT override capture.js. A mobile capture override was staged for
// url-shot-on-iOS and deleted 2026-09-05: the native command it invoked was
// never built (objc2-web-kit's WKWebView is macOS-only; see
// capabilities-provided.ts), so mobile keeps the web stub and 'capture' stays
// unavailable.
function overrideBridgeModules(map) {
  return {
    name: 'override-bridge-modules',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer) return null;
      if (!/[\\/]bridge[\\/]/.test(importer.split('?')[0])) return null;
      // Extension-LESS basename so it matches whether the web bridge imports
      // ./state.js OR ./state.ts. The bridge moved to explicit .ts specifiers
      // (JS→TS migration); keying on '.js' silently missed every override, so the
      // shell shipped web IndexedDB state instead of the filesystem one.
      const name = source.split('?')[0].replace(/^.*[\\/]/, '').replace(/\.[jt]s$/, '');
      return map[name] ?? null;
    },
  };
}

// The mobile shell ships a SMALL bundle (the shared pruneEmbeddedDownloads
// strips dist/models/), so the on-device ML models must be fetched from a
// model host at runtime rather than same-origin - exactly the desktop
// arrangement. An override may be passed in the environment (VITE_MODELS_BASE).
const MODELS_HOST = process.env.VITE_MODELS_BASE ?? 'https://lolli.li';

export default defineConfig({
  root: webShell,
  publicDir: resolve(webShell, 'public'),
  plugins: [
    // The app's Content Security Policy rides in as a <meta> tag: with a CSP in
    // tauri.conf.json, Tauri's codegen re-serialises every .html asset - the tool
    // templates included - and the signed digests no longer match.
    // Policy + rationale: ../tauri-shared/vite-csp.mjs.
    tauriCspMeta(),
    injectModelsBase(MODELS_HOST),
    jsToTsFallback(),
    overrideBridgeModules({
      'state': resolve(__dirname, 'bridge-overrides/state.ts'),
      'capabilities-provided': resolve(__dirname, 'bridge-overrides/capabilities-provided.ts'),
      'export': resolve(__dirname, 'bridge-overrides/export.ts'),
      // Durable user-asset storage: mirrors uploaded bytes + metadata + versions to
      // $APPDATA so a WKWebView storage purge can't lose them (plan 216 item 2).
      'assets': resolve(__dirname, 'bridge-overrides/assets.ts'),
      // There used to be a 'site-fetch' entry here, for a
      // shells/web/src/bridge/site-fetch.ts that was never added. Removed
      // 2026-09-05 (dead: the map key matched no web module, so it never fired).
      // The Website source reaches the native site_fetch command a different
      // way - see README.md, "Website source transport".
    }),
    ...embedContentPlugins({
      repoRoot,
      outDirDefault: resolve(__dirname, 'dist'),
      mode: EMBED_CATALOG,
    }),
    // LAST: it scans the finished dist/, so it must run after embedContentPlugins'
    // pruneEmbeddedDownloads has removed dist/models/. Without it there is no
    // dist/precache.json, and every row of the "Available offline" manager is gated on
    // that file (partAvailable in views/profile.ts) - so the whole model list reads
    // "Not offered by this server" even when the model host is serving fine.
    precacheManifest(),
  ],
  // Match shells/web/vite.config.js: the web shell renders ZzFXM songs and encodes
  // video in MODULE workers (src/lib/zzfxm-worker.ts, src/bridge/video-encode.worker.ts),
  // and Vite's default worker format is `iife`, which rollup refuses for a
  // code-splitting build. This config does not extend the web one - it rebuilds the
  // options object by hand - so every such setting has to be repeated here. The
  // worker build needs injectModelsBase too (top-level `define`/plugins are not
  // forwarded to worker bundles) or the speech workers 404 for /models/.
  worker: { format: 'es', plugins: () => [injectModelsBase(MODELS_HOST)] },
  // The dev server pre-bundles deps with esbuild, whose default target rejects
  // harfbuzzjs's top-level await (text-to-path WASM). Without this the dev server
  // boots then crashes as soon as a module pulls in harfbuzz.
  optimizeDeps: {
    esbuildOptions: { target: 'esnext' },
  },
  server: {
    // On-device dev (a physical iPhone/Android) loads the frontend over the LAN,
    // not localhost: `tauri ios dev` detects the Mac's LAN IP, exports it as
    // TAURI_DEV_HOST, and points the app there. Vite must actually LISTEN on that
    // interface or the device (and tauri's health check) time out - the failure
    // that read "Could not connect to http://<lan-ip>:5174 after 180s". Bind to
    // TAURI_DEV_HOST when set, else 0.0.0.0 so the device can still reach it; the
    // simulator (localhost) is covered by 0.0.0.0 too. Pin HMR to the same host so
    // the websocket doesn't try to reach `localhost` from the phone.
    host: process.env.TAURI_DEV_HOST || '0.0.0.0',
    // Separate port from desktop dev server to allow running both simultaneously.
    port: 5174,
    strictPort: true,
    ...(process.env.TAURI_DEV_HOST
      ? { hmr: { protocol: 'ws', host: process.env.TAURI_DEV_HOST, port: 5183 } }
      : {}),
    fs: { allow: [repoRoot] },
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    // iOS WKWebView / Android System WebView are modern WebKit/Chromium, so target
    // esnext. The default (es2020) forbids top-level await, which harfbuzzjs relies
    // on - without this `vite build` fails in esbuild transpile, breaking build:ios.
    target: 'esnext',
  },
});
